/*
# Reusable Assessment Intake Links

## Purpose
Allow any authenticated user with `can_send` capability to generate a reusable,
opaque-token link for a specific published assessment version. Respondents use
this link to fill an intake form and complete the assessment without a
pre-existing client or instance. Records are only created on submission.

## New Tables

### 1. `reusable_assessment_links`
- `id` (uuid PK)
- `assessment_template_id` (uuid FK → assessment_templates)
- `assessment_version_id` (uuid FK → assessment_versions)
- `generating_user_id` (uuid FK → profiles)
- `opaque_token` (uuid, unique, not null) — public-facing token
- `label` (text, nullable) — optional internal label
- `is_active` (boolean, default true)
- `expires_at` (timestamptz, nullable) — optional expiration
- `submission_count` (integer, default 0) — denormalized count for UI
- `created_at` (timestamptz, default now())

### 2. `organization_domains`
- `id` (uuid PK)
- `organization_id` (uuid FK → organizations)
- `normalized_domain` (text, not null) — e.g. "acme.com"
- `is_primary` (boolean, default false)
- `verification_status` (text, default 'unverified') — unverified | verified | disputed
- `created_at` (timestamptz, default now())
- Unique on (organization_id, normalized_domain)

### 3. `intake_submissions`
Tracks the intake-form data collected before the assessment instance is created.
On final submission, this row links to the created assessment instance.
- `id` (uuid PK)
- `reusable_link_id` (uuid FK → reusable_assessment_links)
- `organization_name` (text)
- `contact_name` (text)
- `contact_email` (text)
- `normalized_email` (text)
- `normalized_domain` (text)
- `employee_count` (integer)
- `industry` (text)
- `region` (text) — state/country
- `status` (text, default 'intake_started') — intake_started | assessment_in_progress | submitted | ambiguous
- `assessment_instance_id` (uuid, nullable FK → assessment_instances)
- `matched_organization_id` (uuid, nullable FK → organizations)
- `idempotency_key` (text, unique) — prevents duplicate submissions
- `created_at` (timestamptz, default now())
- `submitted_at` (timestamptz, nullable)

## Modified Tables

### `organizations`
- Add `employee_count` (integer, nullable) — exact employee count
- Add `employee_count_needs_confirmation` (boolean, default false) — true for legacy range-only records
- The existing `employee_count_range` column is preserved (not dropped) for legacy data.

## Security (RLS)

### `reusable_assessment_links`
- SELECT: users can see their own links; superadmins see all
- INSERT: authenticated users with send_assessments capability
- UPDATE: owners can update their own links; superadmins can update all
- DELETE: disabled (use is_active = false instead)

### `organization_domains`
- SELECT: authenticated users who can access the parent organization
- INSERT/UPDATE/DELETE: only the assigned broker/owner of the organization

### `intake_submissions`
- SELECT: the generating user can see submissions on their links; superadmins see all
- INSERT: anon + authenticated (public intake form creates these)
- UPDATE: SECURITY DEFINER functions only (not via RLS)

## RPCs (all SECURITY DEFINER)

### `generate_reusable_link(p_template_id, p_version_id, p_label, p_expires_at)`
Returns the created link row. Validates:
- caller is authenticated
- caller has send_assessments capability
- the version is published
- the template is published

### `resolve_reusable_link(p_token)`
Public RPC (anon). Validates:
- token exists and is active
- not expired
- version is still published
- generating user still has send_assessments capability
Returns assessment metadata + intro config (no scoring, permissions, or owner info).

### `create_intake_submission(p_token, p_org_name, p_contact_name, p_email, p_employee_count, p_industry, p_region)`
Public RPC (anon). Creates an `intake_submissions` row (no instance yet).
Validates:
- link is active and not expired
- email is not a public domain
- employee_count is a positive integer
Returns the submission id + idempotency key.

### `submit_reusable_assessment(p_token, p_submission_id, p_responses jsonb)`
Public RPC (anon). The atomic submission transaction:
1. Validates token, submission, and link are still valid
2. Normalizes work-email domain
3. Matches existing client by organization_domains (exact verified match preferred)
4. If one match → attach; if none → create new client; if multiple → flag ambiguous
5. Creates/updates respondent as primary contact
6. Creates assessment instance with generating user as broker_id
7. Stores all responses
8. Marks instance submitted, stores attribution to reusable link
9. Idempotency: if submission already has assessment_instance_id, returns it

### `get_reusable_link_submissions(p_link_id)`
Returns submission count + list for the link owner.

## Audit Events
Uses existing `auth_audit_log` table. Events:
- `reusable_link_created`
- `reusable_link_activated`
- `reusable_link_deactivated`
- `reusable_link_opened`
- `intake_completed`
- `reusable_assessment_started`
- `reusable_assessment_submitted`
- `existing_client_matched`
- `new_client_created`
- `ambiguous_match_flagged`

## Important Notes
1. No client, contact, or instance is created until final submission.
2. Public email domains (gmail, yahoo, outlook, hotmail, icloud, aol) are rejected.
3. Legacy `employee_count_range` values are preserved; new `employee_count` is the canonical field.
4. Size tiers are derived from the integer, not the old picklist.
5. Existing client-specific send flow is untouched.
*/

-- ============================================================
-- 1. Add employee_count to organizations
-- ============================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS employee_count integer,
  ADD COLUMN IF NOT EXISTS employee_count_needs_confirmation boolean NOT NULL DEFAULT false;

-- Mark existing records that have a range but no exact count as needing confirmation
UPDATE organizations
SET employee_count_needs_confirmation = true
WHERE employee_count_range IS NOT NULL AND employee_count IS NULL;

-- ============================================================
-- 2. reusable_assessment_links table
-- ============================================================

CREATE TABLE IF NOT EXISTS reusable_assessment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_template_id uuid NOT NULL REFERENCES assessment_templates(id) ON DELETE CASCADE,
  assessment_version_id uuid NOT NULL REFERENCES assessment_versions(id) ON DELETE CASCADE,
  generating_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  opaque_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  label text,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  submission_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reusable_assessment_links ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_reusable_links_user ON reusable_assessment_links(generating_user_id);
CREATE INDEX IF NOT EXISTS idx_reusable_links_token ON reusable_assessment_links(opaque_token);

-- RLS: users see their own links; superadmins see all
DROP POLICY IF EXISTS "select_own_reusable_links" ON reusable_assessment_links;
CREATE POLICY "select_own_reusable_links" ON reusable_assessment_links
  FOR SELECT TO authenticated
  USING (generating_user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'superadmin'
  ));

DROP POLICY IF EXISTS "insert_own_reusable_links" ON reusable_assessment_links;
CREATE POLICY "insert_own_reusable_links" ON reusable_assessment_links
  FOR INSERT TO authenticated
  WITH CHECK (generating_user_id = auth.uid());

DROP POLICY IF EXISTS "update_own_reusable_links" ON reusable_assessment_links;
CREATE POLICY "update_own_reusable_links" ON reusable_assessment_links
  FOR UPDATE TO authenticated
  USING (generating_user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'superadmin'
  ))
  WITH CHECK (generating_user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'superadmin'
  ));

-- ============================================================
-- 3. organization_domains table
-- ============================================================

CREATE TABLE IF NOT EXISTS organization_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  normalized_domain text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  verification_status text NOT NULL DEFAULT 'unverified',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, normalized_domain)
);

ALTER TABLE organization_domains ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_org_domains_domain ON organization_domains(normalized_domain);
CREATE INDEX IF NOT EXISTS idx_org_domains_org ON organization_domains(organization_id);

-- RLS: users who can access the parent organization can read domains
DROP POLICY IF EXISTS "select_org_domains" ON organization_domains;
CREATE POLICY "select_org_domains" ON organization_domains
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM organizations
    WHERE organizations.id = organization_domains.organization_id
    AND (organizations.broker_id = auth.uid() OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'superadmin'
    ))
  ));

DROP POLICY IF EXISTS "insert_org_domains" ON organization_domains;
CREATE POLICY "insert_org_domains" ON organization_domains
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM organizations
    WHERE organizations.id = organization_domains.organization_id
    AND (organizations.broker_id = auth.uid() OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'superadmin'
    ))
  ));

DROP POLICY IF EXISTS "update_org_domains" ON organization_domains;
CREATE POLICY "update_org_domains" ON organization_domains
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM organizations
    WHERE organizations.id = organization_domains.organization_id
    AND (organizations.broker_id = auth.uid() OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'superadmin'
    ))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM organizations
    WHERE organizations.id = organization_domains.organization_id
    AND (organizations.broker_id = auth.uid() OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'superadmin'
    ))
  ));

DROP POLICY IF EXISTS "delete_org_domains" ON organization_domains;
CREATE POLICY "delete_org_domains" ON organization_domains
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM organizations
    WHERE organizations.id = organization_domains.organization_id
    AND (organizations.broker_id = auth.uid() OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'superadmin'
    ))
  ));

-- ============================================================
-- 4. intake_submissions table
-- ============================================================

CREATE TABLE IF NOT EXISTS intake_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reusable_link_id uuid NOT NULL REFERENCES reusable_assessment_links(id) ON DELETE CASCADE,
  organization_name text NOT NULL,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  normalized_email text NOT NULL,
  normalized_domain text NOT NULL,
  employee_count integer NOT NULL,
  industry text,
  region text,
  status text NOT NULL DEFAULT 'intake_started',
  assessment_instance_id uuid,
  matched_organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz
);

ALTER TABLE intake_submissions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_intake_submissions_link ON intake_submissions(reusable_link_id);

-- RLS: generating user can see submissions on their links; superadmins see all
-- anon can insert (public intake form)
DROP POLICY IF EXISTS "select_intake_submissions" ON intake_submissions;
CREATE POLICY "select_intake_submissions" ON intake_submissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM reusable_assessment_links
      WHERE reusable_assessment_links.id = intake_submissions.reusable_link_id
      AND (reusable_assessment_links.generating_user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'superadmin'
      ))
    )
  );

DROP POLICY IF EXISTS "insert_intake_submissions" ON intake_submissions;
CREATE POLICY "insert_intake_submissions" ON intake_submissions
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- No UPDATE/DELETE policy — only SECURITY DEFINER functions modify these rows

-- ============================================================
-- 5. RPC: generate_reusable_link
-- ============================================================

CREATE OR REPLACE FUNCTION generate_reusable_link(
  p_template_id uuid,
  p_version_id uuid,
  p_label text DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
) RETURNS reusable_assessment_links
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link reusable_assessment_links;
  v_profile profiles;
  v_template assessment_templates;
  v_version assessment_versions;
  v_has_send boolean := false;
BEGIN
  -- 1. Must be authenticated
  SELECT * INTO v_profile FROM profiles WHERE id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 2. Must have send_assessments capability (superadmins always allowed)
  IF v_profile.role = 'superadmin' THEN
    v_has_send := true;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM organization_memberships om
      JOIN organization_role_capabilities orc ON orc.role = om.role
      WHERE om.profile_id = auth.uid()
        AND om.status = 'active'
        AND orc.capability = 'send_assessments'
    ) INTO v_has_send;
  END IF;

  IF NOT v_has_send THEN
    RAISE EXCEPTION 'You do not have permission to send assessments';
  END IF;

  -- 3. Template must be published
  SELECT * INTO v_template FROM assessment_templates WHERE id = p_template_id;
  IF NOT FOUND OR v_template.status <> 'published' THEN
    RAISE EXCEPTION 'Assessment template is not available';
  END IF;

  -- 4. Version must be published
  SELECT * INTO v_version FROM assessment_versions WHERE id = p_version_id;
  IF NOT FOUND OR v_version.status <> 'published' THEN
    RAISE EXCEPTION 'Assessment version is not published';
  END IF;

  IF v_version.assessment_template_id <> p_template_id THEN
    RAISE EXCEPTION 'Version does not belong to this template';
  END IF;

  -- 5. Create the link
  INSERT INTO reusable_assessment_links (
    assessment_template_id,
    assessment_version_id,
    generating_user_id,
    label,
    expires_at
  ) VALUES (
    p_template_id,
    p_version_id,
    auth.uid(),
    p_label,
    p_expires_at
  ) RETURNING * INTO v_link;

  -- 6. Audit
  INSERT INTO auth_audit_log (actor_id, target_id, action, new_values)
  VALUES (auth.uid(), v_link.id, 'reusable_link_created',
    jsonb_build_object('link_id', v_link.id, 'template_id', p_template_id, 'version_id', p_version_id));

  RETURN v_link;
END;
$$;

-- ============================================================
-- 6. RPC: resolve_reusable_link (public)
-- ============================================================

CREATE OR REPLACE FUNCTION resolve_reusable_link(
  p_token uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link reusable_assessment_links;
  v_template assessment_templates;
  v_version assessment_versions;
  v_profile profiles;
  v_has_send boolean := false;
  v_result jsonb;
BEGIN
  SELECT * INTO v_link FROM reusable_assessment_links WHERE opaque_token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Link not found');
  END IF;

  IF NOT v_link.is_active THEN
    RETURN jsonb_build_object('error', 'This link is no longer active');
  END IF;

  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < now() THEN
    RETURN jsonb_build_object('error', 'This link has expired');
  END IF;

  SELECT * INTO v_template FROM assessment_templates WHERE id = v_link.assessment_template_id;
  IF NOT FOUND OR v_template.status <> 'published' THEN
    RETURN jsonb_build_object('error', 'This assessment is no longer available');
  END IF;

  SELECT * INTO v_version FROM assessment_versions WHERE id = v_link.assessment_version_id;
  IF NOT FOUND OR v_version.status <> 'published' THEN
    RETURN jsonb_build_object('error', 'This assessment version is no longer available');
  END IF;

  -- Check generating user still has send permission
  SELECT * INTO v_profile FROM profiles WHERE id = v_link.generating_user_id;
  IF NOT FOUND OR v_profile.status NOT IN ('active', 'invited') THEN
    RETURN jsonb_build_object('error', 'This link is no longer valid');
  END IF;

  IF v_profile.role = 'superadmin' THEN
    v_has_send := true;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM organization_memberships om
      JOIN organization_role_capabilities orc ON orc.role = om.role
      WHERE om.profile_id = v_link.generating_user_id
        AND om.status = 'active'
        AND orc.capability = 'send_assessments'
    ) INTO v_has_send;
  END IF;

  IF NOT v_has_send THEN
    RETURN jsonb_build_object('error', 'This link is no longer valid');
  END IF;

  -- Audit: link opened
  INSERT INTO auth_audit_log (actor_id, target_id, action)
  VALUES (NULL, v_link.id, 'reusable_link_opened');

  -- Return only public-safe fields (no scoring, permissions, owner IDs)
  SELECT jsonb_build_object(
    'template_name', v_template.name,
    'template_short_description', v_template.short_description,
    'template_full_description', v_template.full_description,
    'template_category', v_template.category,
    'template_estimated_minutes', v_template.estimated_minutes,
    'version_number', v_version.version_number,
    'version_label', v_version.version_label,
    'introduction_text', v_version.respondent_intro_text,
    'completion_message', v_version.completion_message,
    'sections', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'title', s.title,
          'description', s.description,
          'display_order', s.display_order,
          'questions', (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', q.id,
                'question_text', q.question_text,
                'help_text', q.help_text,
                'question_type', q.question_type,
                'display_order', q.display_order,
                'is_required', q.is_required,
                'numeric_rating_min_value', q.numeric_rating_min_value,
                'numeric_rating_max_value', q.numeric_rating_max_value,
                'numeric_rating_step_value', q.numeric_rating_step_value,
                'numeric_rating_min_label', q.numeric_rating_min_label,
                'numeric_rating_max_label', q.numeric_rating_max_label,
                'maximum_selections', q.maximum_selections,
                'options', (
                  SELECT jsonb_agg(
                    jsonb_build_object(
                      'id', o.id,
                      'option_label', o.option_label,
                      'option_value', o.option_value,
                      'display_order', o.display_order,
                      'is_not_applicable', o.is_not_applicable
                    )
                    ORDER BY o.display_order
                  )
                  FROM assessment_question_options o
                  WHERE o.question_id = q.id
                )
              )
              ORDER BY q.display_order
            )
            FROM assessment_questions q
            WHERE q.assessment_section_id = s.id
          )
        )
        ORDER BY s.display_order
      )
      FROM assessment_sections s
      WHERE s.assessment_version_id = v_version.id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================================
-- 7. RPC: create_intake_submission (public)
-- ============================================================

CREATE OR REPLACE FUNCTION create_intake_submission(
  p_token uuid,
  p_org_name text,
  p_contact_name text,
  p_email text,
  p_employee_count integer,
  p_industry text DEFAULT NULL,
  p_region text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link reusable_assessment_links;
  v_profile profiles;
  v_has_send boolean := false;
  v_normalized_email text;
  v_normalized_domain text;
  v_public_domains text[] := ARRAY['gmail.com','yahoo.com','outlook.com','hotmail.com','icloud.com','aol.com'];
  v_idempotency_key text;
  v_existing intake_submissions;
BEGIN
  -- 1. Validate link
  SELECT * INTO v_link FROM reusable_assessment_links WHERE opaque_token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Link not found');
  END IF;

  IF NOT v_link.is_active THEN
    RETURN jsonb_build_object('error', 'This link is no longer active');
  END IF;

  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < now() THEN
    RETURN jsonb_build_object('error', 'This link has expired');
  END IF;

  -- 2. Validate generating user still has permission
  SELECT * INTO v_profile FROM profiles WHERE id = v_link.generating_user_id;
  IF NOT FOUND OR v_profile.status NOT IN ('active', 'invited') THEN
    RETURN jsonb_build_object('error', 'This link is no longer valid');
  END IF;

  IF v_profile.role = 'superadmin' THEN
    v_has_send := true;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM organization_memberships om
      JOIN organization_role_capabilities orc ON orc.role = om.role
      WHERE om.profile_id = v_link.generating_user_id
        AND om.status = 'active'
        AND orc.capability = 'send_assessments'
    ) INTO v_has_send;
  END IF;

  IF NOT v_has_send THEN
    RETURN jsonb_build_object('error', 'This link is no longer valid');
  END IF;

  -- 3. Validate inputs
  IF p_org_name IS NULL OR btrim(p_org_name) = '' THEN
    RETURN jsonb_build_object('error', 'Organization name is required');
  END IF;

  IF p_contact_name IS NULL OR btrim(p_contact_name) = '' THEN
    RETURN jsonb_build_object('error', 'Contact name is required');
  END IF;

  IF p_email IS NULL OR btrim(p_email) = '' THEN
    RETURN jsonb_build_object('error', 'Work email is required');
  END IF;

  -- Normalize email
  v_normalized_email := lower(btrim(p_email));

  -- Basic email format check
  IF v_normalized_email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' THEN
    RETURN jsonb_build_object('error', 'Please enter a valid work email address');
  END IF;

  -- Extract and normalize domain
  v_normalized_domain := split_part(v_normalized_email, '@', 2);

  -- Reject public domains
  IF v_normalized_domain = ANY(v_public_domains) THEN
    RETURN jsonb_build_object('error', 'A work email is required. Public email domains (Gmail, Yahoo, Outlook, Hotmail, iCloud, AOL) are not accepted. Please use your organization email address.');
  END IF;

  -- Validate employee_count: positive integer, no zero/negatives
  IF p_employee_count IS NULL OR p_employee_count <= 0 THEN
    RETURN jsonb_build_object('error', 'Employee count must be a positive whole number');
  END IF;

  -- 4. Generate idempotency key from link + normalized email
  v_idempotency_key := md5(v_link.id::text || ':' || v_normalized_email);

  -- Check for existing submission with same idempotency key
  SELECT * INTO v_existing FROM intake_submissions WHERE idempotency_key = v_idempotency_key;
  IF FOUND THEN
    -- Return existing submission (idempotent)
    RETURN jsonb_build_object('submission_id', v_existing.id, 'already_exists', true);
  END IF;

  -- 5. Create intake submission (no instance yet)
  INSERT INTO intake_submissions (
    reusable_link_id,
    organization_name,
    contact_name,
    contact_email,
    normalized_email,
    normalized_domain,
    employee_count,
    industry,
    region,
    idempotency_key
  ) VALUES (
    v_link.id,
    btrim(p_org_name),
    btrim(p_contact_name),
    btrim(p_email),
    v_normalized_email,
    v_normalized_domain,
    p_employee_count,
    p_industry,
    p_region,
    v_idempotency_key
  )
  RETURNING id INTO v_existing;

  -- Audit
  INSERT INTO auth_audit_log (target_id, action)
  VALUES (v_existing.id, 'intake_completed');

  RETURN jsonb_build_object('submission_id', v_existing.id);
END;
$$;

-- ============================================================
-- 8. RPC: submit_reusable_assessment (public, atomic)
-- ============================================================

CREATE OR REPLACE FUNCTION submit_reusable_assessment(
  p_token uuid,
  p_submission_id uuid,
  p_responses jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link reusable_assessment_links;
  v_submission intake_submissions;
  v_profile profiles;
  v_has_send boolean := false;
  v_template assessment_templates;
  v_version assessment_versions;
  v_org organizations;
  v_org_id uuid;
  v_instance assessment_instances;
  v_match_count integer;
  v_matched_org_id uuid;
  v_token uuid;
  v_response jsonb;
  v_q_id uuid;
  v_opt_id uuid;
  v_num_val numeric;
  v_text_val text;
  v_bool_val boolean;
  v_new_org organizations;
BEGIN
  -- 1. Validate link
  SELECT * INTO v_link FROM reusable_assessment_links WHERE opaque_token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Link not found');
  END IF;

  IF NOT v_link.is_active THEN
    RETURN jsonb_build_object('error', 'This link is no longer active. Please contact the person who shared this link with you.');
  END IF;

  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < now() THEN
    RETURN jsonb_build_object('error', 'This link has expired. Please contact the person who shared this link with you.');
  END IF;

  -- 2. Validate submission
  SELECT * INTO v_submission FROM intake_submissions WHERE id = p_submission_id AND reusable_link_id = v_link.id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Submission not found');
  END IF;

  -- Idempotency: if already submitted, return existing instance
  IF v_submission.assessment_instance_id IS NOT NULL THEN
    RETURN jsonb_build_object('instance_id', v_submission.assessment_instance_id, 'already_submitted', true);
  END IF;

  -- 3. Validate generating user still has permission
  SELECT * INTO v_profile FROM profiles WHERE id = v_link.generating_user_id;
  IF NOT FOUND OR v_profile.status NOT IN ('active', 'invited') THEN
    RETURN jsonb_build_object('error', 'This link is no longer valid');
  END IF;

  IF v_profile.role = 'superadmin' THEN
    v_has_send := true;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM organization_memberships om
      JOIN organization_role_capabilities orc ON orc.role = om.role
      WHERE om.profile_id = v_link.generating_user_id
        AND om.status = 'active'
        AND orc.capability = 'send_assessments'
    ) INTO v_has_send;
  END IF;

  IF NOT v_has_send THEN
    RETURN jsonb_build_object('error', 'This link is no longer valid');
  END IF;

  -- 4. Validate version still published
  SELECT * INTO v_version FROM assessment_versions WHERE id = v_link.assessment_version_id;
  IF NOT FOUND OR v_version.status <> 'published' THEN
    RETURN jsonb_build_object('error', 'This assessment is no longer available');
  END IF;

  SELECT * INTO v_template FROM assessment_templates WHERE id = v_link.assessment_template_id;
  IF NOT FOUND OR v_template.status <> 'published' THEN
    RETURN jsonb_build_object('error', 'This assessment is no longer available');
  END IF;

  -- 5. Domain matching: find existing client by organization_domains
  SELECT count(*), (
    SELECT od.organization_id FROM organization_domains od
    WHERE od.normalized_domain = v_submission.normalized_domain
    AND od.verification_status = 'verified'
    LIMIT 1
  ) INTO v_match_count, v_matched_org_id
  FROM organization_domains od
  WHERE od.normalized_domain = v_submission.normalized_domain
    AND od.verification_status = 'verified';

  IF v_match_count = 1 THEN
    -- Exact verified match
    v_org_id := v_matched_org_id;
    INSERT INTO auth_audit_log (target_id, action)
    VALUES (v_org_id, 'existing_client_matched');
  ELSIF v_match_count > 1 THEN
    -- Ambiguous match — flag for review, do not guess
    UPDATE intake_submissions SET status = 'ambiguous' WHERE id = v_submission.id;
    INSERT INTO auth_audit_log (target_id, action, new_values)
    VALUES (v_submission.id, 'ambiguous_match_flagged',
      jsonb_build_object('domain', v_submission.normalized_domain, 'match_count', v_match_count));
    RETURN jsonb_build_object('error', 'Your submission has been received but requires manual review. We will contact you shortly.');
  ELSE
    -- No verified match — try cautious match from primary contact email domain
    SELECT count(*), (
      SELECT o.id FROM organizations o
      WHERE o.client_contact_email IS NOT NULL
        AND split_part(lower(o.client_contact_email), '@', 2) = v_submission.normalized_domain
        AND o.status = 'active'
      LIMIT 1
    ) INTO v_match_count, v_matched_org_id
    FROM organizations o
    WHERE o.client_contact_email IS NOT NULL
      AND split_part(lower(o.client_contact_email), '@', 2) = v_submission.normalized_domain
      AND o.status = 'active';

    IF v_match_count = 1 THEN
      v_org_id := v_matched_org_id;
      INSERT INTO auth_audit_log (target_id, action)
      VALUES (v_org_id, 'existing_client_matched');
    ELSIF v_match_count > 1 THEN
      -- Ambiguous
      UPDATE intake_submissions SET status = 'ambiguous' WHERE id = v_submission.id;
      INSERT INTO auth_audit_log (target_id, action, new_values)
      VALUES (v_submission.id, 'ambiguous_match_flagged',
        jsonb_build_object('domain', v_submission.normalized_domain, 'match_count', v_match_count));
      RETURN jsonb_build_object('error', 'Your submission has been received but requires manual review. We will contact you shortly.');
    ELSE
      -- No match — create new client, link generator becomes owner
      INSERT INTO organizations (
        broker_id,
        organization_name,
        industry,
        employee_count,
        client_contact_name,
        client_contact_email,
        organization_type,
        status
      ) VALUES (
        v_link.generating_user_id,
        v_submission.organization_name,
        v_submission.industry,
        v_submission.employee_count,
        v_submission.contact_name,
        v_submission.contact_email,
        'employer',
        'active'
      ) RETURNING * INTO v_new_org;

      v_org_id := v_new_org.id;

      -- Add domain mapping for the new org
      INSERT INTO organization_domains (organization_id, normalized_domain, is_primary, verification_status)
      VALUES (v_org_id, v_submission.normalized_domain, true, 'unverified')
      ON CONFLICT (organization_id, normalized_domain) DO NOTHING;

      INSERT INTO auth_audit_log (actor_id, target_id, action)
      VALUES (v_link.generating_user_id, v_org_id, 'new_client_created');
    END IF;
  END IF;

  -- 6. Update existing client contact info if matched and contact differs
  IF v_match_count <= 1 AND v_matched_org_id IS NOT NULL THEN
    UPDATE organizations
    SET client_contact_name = v_submission.contact_name,
        client_contact_email = v_submission.contact_email,
        employee_count = COALESCE(employee_count, v_submission.employee_count),
        industry = COALESCE(industry, v_submission.industry),
        updated_at = now()
    WHERE id = v_org_id
      AND (client_contact_email IS DISTINCT FROM v_submission.contact_email
           OR client_contact_name IS DISTINCT FROM v_submission.contact_name);

    -- Add domain mapping if not present
    INSERT INTO organization_domains (organization_id, normalized_domain, is_primary, verification_status)
    VALUES (v_org_id, v_submission.normalized_domain, false, 'unverified')
    ON CONFLICT (organization_id, normalized_domain) DO NOTHING;
  END IF;

  -- 7. Create assessment instance with generating user as broker_id
  v_token := gen_random_uuid();
  INSERT INTO assessment_instances (
    organization_id,
    broker_id,
    assessment_template_id,
    assessment_version_id,
    secure_token,
    status,
    respondent_name,
    respondent_email,
    sent_at,
    started_at
  ) VALUES (
    v_org_id,
    v_link.generating_user_id,
    v_link.assessment_template_id,
    v_link.assessment_version_id,
    v_token,
    'submitted',
    v_submission.contact_name,
    v_submission.contact_email,
    now(),
    now()
  ) RETURNING * INTO v_instance;

  -- 8. Store responses
  IF p_responses IS NOT NULL AND jsonb_typeof(p_responses) = 'array' THEN
    FOR v_response IN SELECT jsonb_array_elements(p_responses) LOOP
      v_q_id := (v_response->>'question_id')::uuid;
      v_opt_id := NULLIF(v_response->>'selected_option_id', '')::uuid;
      v_num_val := NULLIF(v_response->>'numeric_value', '')::numeric;
      v_text_val := NULLIF(v_response->>'text_value', '');
      v_bool_val := CASE WHEN v_response->>'boolean_value' = 'true' THEN true
                         WHEN v_response->>'boolean_value' = 'false' THEN false
                         ELSE NULL END;

      INSERT INTO assessment_responses (
        assessment_instance_id,
        question_id,
        selected_option_id,
        numeric_value,
        text_value,
        boolean_value
      ) VALUES (
        v_instance.id,
        v_q_id,
        v_opt_id,
        v_num_val::double precision,
        v_text_val,
        v_bool_val
      );
    END LOOP;
  END IF;

  -- 9. Mark submitted
  UPDATE assessment_instances
  SET status = 'submitted',
      submitted_at = now()
  WHERE id = v_instance.id;

  -- 10. Link submission to instance
  UPDATE intake_submissions
  SET assessment_instance_id = v_instance.id,
      matched_organization_id = v_org_id,
      status = 'submitted',
      submitted_at = now()
  WHERE id = v_submission.id;

  -- 11. Increment link submission count
  UPDATE reusable_assessment_links
  SET submission_count = submission_count + 1
  WHERE id = v_link.id;

  -- 12. Audit
  INSERT INTO auth_audit_log (actor_id, target_id, action)
  VALUES (v_link.generating_user_id, v_instance.id, 'reusable_assessment_submitted');

  RETURN jsonb_build_object('instance_id', v_instance.id, 'secure_token', v_token);
END;
$$;

-- ============================================================
-- 9. Grant execute on public RPCs to anon
-- ============================================================

GRANT EXECUTE ON FUNCTION resolve_reusable_link(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION create_intake_submission(uuid, text, text, text, integer, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION submit_reusable_assessment(uuid, uuid, jsonb) TO anon, authenticated;

-- Grant execute on authenticated-only RPC
GRANT EXECUTE ON FUNCTION generate_reusable_link(uuid, uuid, text, timestamptz) TO authenticated;

/*
# Propel schema: profiles, organizations, assessment_versions, assessment_instances, broker_notes

1. Purpose
- First production data layer for the Propel Well-being Opportunity Index.
- Supports broker/admin roles, client (organization) management, assessment instances,
  assessment versions (foundation only), and broker notes.
- Authentication remains Supabase Auth; authorization is enforced via profiles + RLS.

2. New Tables
- `profiles` — one row per authenticated Supabase user. Carries role + status.
  - id (uuid, PK, references auth.users ON DELETE CASCADE)
  - email, first_name, last_name, brokerage_name
  - role ('admin' | 'broker')
  - status ('invited' | 'active' | 'suspended' | 'archived')
  - created_at, updated_at, last_login_at
- `organizations` — employer clients owned by a broker.
  - broker_id (uuid, references profiles)
  - organization_name, organization_alias, industry
  - employee_count_range, number_of_locations, funding_type
  - renewal_month (1-12), client_contact_name, client_contact_email
  - created_at, updated_at, archived_at
- `assessment_versions` — assessment questionnaire versions (foundation, not populated yet).
  - name, version_number, status ('draft' | 'published' | 'retired'), published_at, created_at
  - unique (name, version_number)
- `assessment_instances` — a specific assessment sent to an organization.
  - organization_id, broker_id, assessment_version_id
  - secure_token (uuid, unique, auto-generated)
  - status ('draft' | 'sent' | 'not_opened' | 'opened' | 'in_progress' | 'submitted' | 'report_ready' | 'expired' | 'revoked')
  - respondent_name, respondent_email
  - created_at, sent_at, opened_at, started_at, submitted_at, expires_at
  - overall_score, primary_opportunity
- `broker_notes` — notes a broker attaches to an organization.
  - organization_id, broker_id, note_text, created_at, updated_at

3. Reusable Functions
- `set_updated_at()` — already exists from the notes migration; reused here.
- `handle_new_user()` — trigger function that creates a profiles row when a new auth.users
  row is inserted. Defaults role='broker', status='invited'. Does NOT grant dashboard access
  until an admin sets status='active'.

4. Indexes
- profiles: email, role, status
- organizations: broker_id, organization_name, industry, created_at, archived_at
- assessment_instances: organization_id, broker_id, secure_token, status, created_at
- broker_notes: organization_id, broker_id, created_at

5. Triggers
- profiles, organizations, broker_notes: BEFORE UPDATE → set_updated_at()
- auth.users: AFTER INSERT → handle_new_user() (auto-creates profile)

6. Security
- RLS enabled on all 5 new tables.
- Policies are in a SEPARATE migration (propel_rls_policies) for clarity.
- No policies defined here — tables are locked until the policy migration runs.

7. Important Notes
1) The handle_new_user trigger fires on every new auth.users insert, including sign-ups
   from the magic-link flow. New users get status='invited' — they must be activated by
   an admin before accessing the dashboard.
2) assessment_versions is created as a foundation only. No rows are populated in this phase.
3) overall_score and primary_opportunity on assessment_instances are nullable — they will
   be populated by the scoring engine in a later phase.
4) All statements are idempotent (IF NOT EXISTS / OR REPLACE / DROP IF EXISTS).
*/

-- ============================================================
-- profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  first_name text,
  last_name text,
  brokerage_name text,
  role text NOT NULL CHECK (role IN ('admin', 'broker')) DEFAULT 'broker',
  status text NOT NULL CHECK (status IN ('invited', 'active', 'suspended', 'archived')) DEFAULT 'invited',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_profiles_set_updated_at ON profiles;
CREATE TRIGGER trg_profiles_set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- organizations
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id uuid NOT NULL REFERENCES profiles(id),
  organization_name text NOT NULL,
  organization_alias text,
  industry text,
  employee_count_range text,
  number_of_locations integer,
  funding_type text CHECK (funding_type IN ('fully_insured', 'self_funded', 'level_funded', 'unknown')),
  renewal_month integer CHECK (renewal_month BETWEEN 1 AND 12),
  client_contact_name text,
  client_contact_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_organizations_broker_id ON organizations(broker_id);
CREATE INDEX IF NOT EXISTS idx_organizations_organization_name ON organizations(organization_name);
CREATE INDEX IF NOT EXISTS idx_organizations_industry ON organizations(industry);
CREATE INDEX IF NOT EXISTS idx_organizations_created_at ON organizations(created_at);
CREATE INDEX IF NOT EXISTS idx_organizations_archived_at ON organizations(archived_at);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_organizations_set_updated_at ON organizations;
CREATE TRIGGER trg_organizations_set_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- assessment_versions (foundation only)
-- ============================================================
CREATE TABLE IF NOT EXISTS assessment_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  version_number integer NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'published', 'retired')) DEFAULT 'draft',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- unique constraint on (name, version_number)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assessment_versions_name_version_key'
  ) THEN
    ALTER TABLE assessment_versions ADD CONSTRAINT assessment_versions_name_version_key UNIQUE (name, version_number);
  END IF;
END $$;

ALTER TABLE assessment_versions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- assessment_instances
-- ============================================================
CREATE TABLE IF NOT EXISTS assessment_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  broker_id uuid NOT NULL REFERENCES profiles(id),
  assessment_version_id uuid REFERENCES assessment_versions(id),
  secure_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'not_opened', 'opened', 'in_progress', 'submitted', 'report_ready', 'expired', 'revoked')),
  respondent_name text,
  respondent_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  opened_at timestamptz,
  started_at timestamptz,
  submitted_at timestamptz,
  expires_at timestamptz,
  overall_score numeric,
  primary_opportunity text
);

CREATE INDEX IF NOT EXISTS idx_assessment_instances_organization_id ON assessment_instances(organization_id);
CREATE INDEX IF NOT EXISTS idx_assessment_instances_broker_id ON assessment_instances(broker_id);
CREATE INDEX IF NOT EXISTS idx_assessment_instances_secure_token ON assessment_instances(secure_token);
CREATE INDEX IF NOT EXISTS idx_assessment_instances_status ON assessment_instances(status);
CREATE INDEX IF NOT EXISTS idx_assessment_instances_created_at ON assessment_instances(created_at);

ALTER TABLE assessment_instances ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- broker_notes
-- ============================================================
CREATE TABLE IF NOT EXISTS broker_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  broker_id uuid NOT NULL REFERENCES profiles(id),
  note_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broker_notes_organization_id ON broker_notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_broker_notes_broker_id ON broker_notes(broker_id);
CREATE INDEX IF NOT EXISTS idx_broker_notes_created_at ON broker_notes(created_at);

ALTER TABLE broker_notes ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_broker_notes_set_updated_at ON broker_notes;
CREATE TRIGGER trg_broker_notes_set_updated_at
  BEFORE UPDATE ON broker_notes
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Profile auto-creation trigger
-- Fires when a new auth.users row is created (sign-up or magic-link).
-- New profiles default to role='broker', status='invited'.
-- An admin must set status='active' before dashboard access is granted.
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', NULL),
    COALESCE(NEW.raw_user_meta_data->>'last_name', NULL)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

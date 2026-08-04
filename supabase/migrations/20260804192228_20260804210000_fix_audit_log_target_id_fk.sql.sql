-- Fix: auth_audit_log.target_id has FK to auth.users(id).
-- The reusable-link RPCs were inserting non-user UUIDs (link IDs, submission IDs, org IDs)
-- into target_id, violating the FK constraint.
-- Fix: set target_id to NULL for non-user entities and store the entity ID in new_values jsonb.

-- ============================================================
-- Recreate generate_reusable_link with corrected audit
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
  SELECT * INTO v_profile FROM profiles WHERE id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

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

  SELECT * INTO v_template FROM assessment_templates WHERE id = p_template_id;
  IF NOT FOUND OR v_template.status <> 'published' THEN
    RAISE EXCEPTION 'Assessment template is not available';
  END IF;

  SELECT * INTO v_version FROM assessment_versions WHERE id = p_version_id;
  IF NOT FOUND OR v_version.status <> 'published' THEN
    RAISE EXCEPTION 'Assessment version is not published';
  END IF;

  IF v_version.assessment_template_id <> p_template_id THEN
    RAISE EXCEPTION 'Version does not belong to this template';
  END IF;

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

  -- Audit: actor is the user, target_id is NULL (link is not a user), entity in new_values
  INSERT INTO auth_audit_log (actor_id, action, new_values)
  VALUES (auth.uid(), 'reusable_link_created',
    jsonb_build_object('link_id', v_link.id, 'template_id', p_template_id, 'version_id', p_version_id));

  RETURN v_link;
END;
$$;

-- ============================================================
-- Recreate resolve_reusable_link with corrected audit
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

  -- Audit: anon action, target_id is NULL (link is not a user), entity in new_values
  INSERT INTO auth_audit_log (action, new_values)
  VALUES ('reusable_link_opened', jsonb_build_object('link_id', v_link.id));

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
-- Recreate create_intake_submission with corrected audit
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

  IF p_org_name IS NULL OR btrim(p_org_name) = '' THEN
    RETURN jsonb_build_object('error', 'Organization name is required');
  END IF;

  IF p_contact_name IS NULL OR btrim(p_contact_name) = '' THEN
    RETURN jsonb_build_object('error', 'Contact name is required');
  END IF;

  IF p_email IS NULL OR btrim(p_email) = '' THEN
    RETURN jsonb_build_object('error', 'Work email is required');
  END IF;

  v_normalized_email := lower(btrim(p_email));

  IF v_normalized_email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' THEN
    RETURN jsonb_build_object('error', 'Please enter a valid work email address');
  END IF;

  v_normalized_domain := split_part(v_normalized_email, '@', 2);

  IF v_normalized_domain = ANY(v_public_domains) THEN
    RETURN jsonb_build_object('error', 'A work email is required. Public email domains (Gmail, Yahoo, Outlook, Hotmail, iCloud, AOL) are not accepted. Please use your organization email address.');
  END IF;

  IF p_employee_count IS NULL OR p_employee_count <= 0 THEN
    RETURN jsonb_build_object('error', 'Employee count must be a positive whole number');
  END IF;

  v_idempotency_key := md5(v_link.id::text || ':' || v_normalized_email);

  SELECT * INTO v_existing FROM intake_submissions WHERE idempotency_key = v_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object('submission_id', v_existing.id, 'already_exists', true);
  END IF;

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

  -- Audit: anon action, target_id is NULL (submission is not a user), entity in new_values
  INSERT INTO auth_audit_log (action, new_values)
  VALUES ('intake_completed', jsonb_build_object('submission_id', v_existing.id));

  RETURN jsonb_build_object('submission_id', v_existing.id);
END;
$$;

-- ============================================================
-- Recreate submit_reusable_assessment with corrected audit
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

  SELECT * INTO v_submission FROM intake_submissions WHERE id = p_submission_id AND reusable_link_id = v_link.id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Submission not found');
  END IF;

  IF v_submission.assessment_instance_id IS NOT NULL THEN
    RETURN jsonb_build_object('instance_id', v_submission.assessment_instance_id, 'already_submitted', true);
  END IF;

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

  SELECT * INTO v_version FROM assessment_versions WHERE id = v_link.assessment_version_id;
  IF NOT FOUND OR v_version.status <> 'published' THEN
    RETURN jsonb_build_object('error', 'This assessment is no longer available');
  END IF;

  SELECT * INTO v_template FROM assessment_templates WHERE id = v_link.assessment_template_id;
  IF NOT FOUND OR v_template.status <> 'published' THEN
    RETURN jsonb_build_object('error', 'This assessment is no longer available');
  END IF;

  -- Domain matching
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
    v_org_id := v_matched_org_id;
    -- Audit: actor is generator, target_id is NULL (org is not a user), entity in new_values
    INSERT INTO auth_audit_log (actor_id, action, new_values)
    VALUES (v_link.generating_user_id, 'existing_client_matched',
      jsonb_build_object('organization_id', v_org_id, 'domain', v_submission.normalized_domain));
  ELSIF v_match_count > 1 THEN
    UPDATE intake_submissions SET status = 'ambiguous' WHERE id = v_submission.id;
    INSERT INTO auth_audit_log (action, new_values)
    VALUES ('ambiguous_match_flagged',
      jsonb_build_object('submission_id', v_submission.id, 'domain', v_submission.normalized_domain, 'match_count', v_match_count));
    RETURN jsonb_build_object('error', 'Your submission has been received but requires manual review. We will contact you shortly.');
  ELSE
    -- Cautious contact match
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
      INSERT INTO auth_audit_log (actor_id, action, new_values)
      VALUES (v_link.generating_user_id, 'existing_client_matched',
        jsonb_build_object('organization_id', v_org_id, 'domain', v_submission.normalized_domain, 'match_source', 'contact_email'));
    ELSIF v_match_count > 1 THEN
      UPDATE intake_submissions SET status = 'ambiguous' WHERE id = v_submission.id;
      INSERT INTO auth_audit_log (action, new_values)
      VALUES ('ambiguous_match_flagged',
        jsonb_build_object('submission_id', v_submission.id, 'domain', v_submission.normalized_domain, 'match_count', v_match_count, 'match_source', 'contact_email'));
      RETURN jsonb_build_object('error', 'Your submission has been received but requires manual review. We will contact you shortly.');
    ELSE
      -- Create new client
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

      INSERT INTO organization_domains (organization_id, normalized_domain, is_primary, verification_status)
      VALUES (v_org_id, v_submission.normalized_domain, true, 'unverified')
      ON CONFLICT (organization_id, normalized_domain) DO NOTHING;

      -- Audit: actor is generator, target_id is NULL (org is not a user), entity in new_values
      INSERT INTO auth_audit_log (actor_id, action, new_values)
      VALUES (v_link.generating_user_id, 'new_client_created',
        jsonb_build_object('organization_id', v_org_id, 'organization_name', v_submission.organization_name));
    END IF;
  END IF;

  -- Update existing client contact info if matched
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

    INSERT INTO organization_domains (organization_id, normalized_domain, is_primary, verification_status)
    VALUES (v_org_id, v_submission.normalized_domain, false, 'unverified')
    ON CONFLICT (organization_id, normalized_domain) DO NOTHING;
  END IF;

  -- Create assessment instance
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

  -- Store responses
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

  UPDATE assessment_instances
  SET status = 'submitted',
      submitted_at = now()
  WHERE id = v_instance.id;

  UPDATE intake_submissions
  SET assessment_instance_id = v_instance.id,
      matched_organization_id = v_org_id,
      status = 'submitted',
      submitted_at = now()
  WHERE id = v_submission.id;

  UPDATE reusable_assessment_links
  SET submission_count = submission_count + 1
  WHERE id = v_link.id;

  -- Audit: actor is generator, target_id is NULL (instance is not a user), entity in new_values
  INSERT INTO auth_audit_log (actor_id, action, new_values)
  VALUES (v_link.generating_user_id, 'reusable_assessment_submitted',
    jsonb_build_object('instance_id', v_instance.id, 'organization_id', v_org_id, 'link_id', v_link.id));

  RETURN jsonb_build_object('instance_id', v_instance.id, 'secure_token', v_token);
END;
$$;

-- Re-grant execute on public RPCs
GRANT EXECUTE ON FUNCTION resolve_reusable_link(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION create_intake_submission(uuid, text, text, text, integer, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION submit_reusable_assessment(uuid, uuid, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION generate_reusable_link(uuid, uuid, text, timestamptz) TO authenticated;

-- Fix: submit_reusable_assessment was setting status='submitted' BEFORE calling
-- finalize_assessment_submission, which then rejected the instance as already
-- submitted. Remove the premature status update; finalize_assessment_submission
-- sets status='submitted' itself after scoring.

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
  v_finalize_result assessment_results;
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

  -- Create assessment instance in 'in_progress' status so finalize_assessment_submission
  -- can accept it (it rejects instances already in 'submitted' status)
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
    'in_progress',
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

  -- Do NOT set status='submitted' here — finalize_assessment_submission does that
  -- after scoring. Setting it early causes finalize to reject the instance.

  UPDATE intake_submissions
  SET assessment_instance_id = v_instance.id,
      matched_organization_id = v_org_id,
      status = 'submitted',
      submitted_at = now()
  WHERE id = v_submission.id;

  UPDATE reusable_assessment_links
  SET submission_count = submission_count + 1
  WHERE id = v_link.id;

  -- Run the same scoring pipeline as the conventional flow
  -- finalize_assessment_submission computes scores, maturity, recommendations
  -- and sets the instance status to 'submitted'
  IF v_template.scoring_enabled THEN
    SELECT * INTO v_finalize_result FROM finalize_assessment_submission(v_token);
  ELSE
    -- For non-scored assessments, just mark as submitted
    UPDATE assessment_instances
    SET status = 'submitted', submitted_at = now()
    WHERE id = v_instance.id;
  END IF;

  INSERT INTO auth_audit_log (actor_id, action, new_values)
  VALUES (v_link.generating_user_id, 'reusable_assessment_submitted',
    jsonb_build_object('instance_id', v_instance.id, 'organization_id', v_org_id, 'link_id', v_link.id));

  RETURN jsonb_build_object('instance_id', v_instance.id, 'secure_token', v_token);
END;
$$;

GRANT EXECUTE ON FUNCTION submit_reusable_assessment(uuid, uuid, jsonb) TO anon, authenticated;

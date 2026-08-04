-- Update create_intake_submission to remove p_region parameter
-- Existing records with region data are preserved (column stays in the table)

CREATE OR REPLACE FUNCTION create_intake_submission(
  p_token uuid,
  p_org_name text,
  p_contact_name text,
  p_email text,
  p_employee_count integer,
  p_industry text DEFAULT NULL
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
    v_idempotency_key
  )
  RETURNING id INTO v_existing;

  INSERT INTO auth_audit_log (action, new_values)
  VALUES ('intake_completed', jsonb_build_object('submission_id', v_existing.id));

  RETURN jsonb_build_object('submission_id', v_existing.id);
END;
$$;

GRANT EXECUTE ON FUNCTION create_intake_submission(uuid, text, text, text, integer, text) TO anon, authenticated;

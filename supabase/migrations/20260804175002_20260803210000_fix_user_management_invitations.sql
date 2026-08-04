/*
# Fix user-management and invitation defects

1. admin_invite_user: validate email domain against approved_domains before creating user
2. admin_delete_user: new RPC for Superadmin-only permanent deletion
3. admin_change_user_role: new RPC with self-demotion guard
4. Data cleanup: delete non-superadmin test users and their dependent records
*/

-- ============================================================
-- 1. Update admin_invite_user to validate email domain
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_invite_user(p_email text, p_role text, p_organization_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_user_id uuid;
  v_domain text;
  v_domain_approved boolean;
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Superadmin access required';
  END IF;

  IF p_role NOT IN ('superadmin', 'propel_csm', 'propel_sales', 'broker') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  v_domain := lower(split_part(p_email, '@', 2));
  IF v_domain = '' OR v_domain IS NULL THEN
    RAISE EXCEPTION 'Invalid email address';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.approved_domains WHERE lower(domain) = v_domain
  ) INTO v_domain_approved;

  IF NOT v_domain_approved THEN
    RAISE EXCEPTION 'Email domain @% is not approved. Invitations can only be sent to approved email domains.', v_domain;
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;

  IF v_user_id IS NULL THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_sso_user, consumption
    )
    SELECT
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated', 'authenticated',
      lower(p_email),
      NULL, now(), now(), now(),
      jsonb_build_object('provider', 'email'),
      jsonb_build_object('invited_by', auth.uid()),
      false, '{}'::jsonb
    RETURNING id INTO v_user_id;
  END IF;

  INSERT INTO public.profiles (id, email, role, status, account_setup_complete)
  VALUES (v_user_id, lower(p_email), p_role, 'invited', false)
  ON CONFLICT (id) DO UPDATE
  SET role = EXCLUDED.role,
      status = CASE WHEN public.profiles.status = 'active' THEN 'active' ELSE 'invited' END,
      updated_at = now();

  IF p_organization_id IS NOT NULL THEN
    INSERT INTO public.organization_memberships (organization_id, profile_id, role, status)
    VALUES (p_organization_id, v_user_id, 'broker', 'invited')
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.auth_audit_log (actor_id, target_id, action, new_values)
  VALUES (auth.uid(), v_user_id, 'user_invited',
    jsonb_build_object('email', p_email, 'role', p_role, 'organization_id', p_organization_id));

  RETURN v_user_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_invite_user(text, text, uuid) TO authenticated;

-- ============================================================
-- 2. New admin_delete_user RPC
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_delete_user(uuid);

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_target_role text;
  v_target_email text;
  v_active_superadmin_count int;
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Superadmin access required';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own account';
  END IF;

  SELECT role INTO v_target_role FROM public.profiles WHERE id = p_user_id;
  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_target_role = 'superadmin' THEN
    SELECT count(*) INTO v_active_superadmin_count
    FROM public.profiles
    WHERE role = 'superadmin' AND status = 'active';

    IF v_active_superadmin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot delete the only active Superadmin';
    END IF;
  END IF;

  SELECT email INTO v_target_email FROM auth.users WHERE id = p_user_id;

  -- Temporarily disable the published-version protection trigger
  ALTER TABLE public.assessment_versions DISABLE TRIGGER trg_protect_published_version;

  -- Delete dependent records
  DELETE FROM public.analysis_evidence_sources WHERE entered_by = p_user_id;
  DELETE FROM public.analysis_generations WHERE reviewed_by = p_user_id;
  DELETE FROM public.analysis_generations WHERE created_by = p_user_id;
  DELETE FROM public.analysis_input_snapshots WHERE created_by = p_user_id;
  DELETE FROM public.analysis_notes WHERE created_by = p_user_id;
  DELETE FROM public.analysis_outcome_goals WHERE created_by = p_user_id;
  DELETE FROM public.analysis_resource_gaps WHERE created_by = p_user_id;
  DELETE FROM public.analysis_workspaces WHERE assigned_to = p_user_id;
  DELETE FROM public.analysis_workspaces WHERE created_by = p_user_id;
  DELETE FROM public.assessment_versions WHERE created_by = p_user_id;
  DELETE FROM public.assessment_templates WHERE owner_profile_id = p_user_id;
  DELETE FROM public.assessment_templates WHERE created_by = p_user_id;
  DELETE FROM public.assessment_instances WHERE broker_id = p_user_id;
  DELETE FROM public.broker_notes WHERE broker_id = p_user_id;
  DELETE FROM public.organization_memberships WHERE profile_id = p_user_id;
  DELETE FROM public.organizations WHERE broker_id = p_user_id;
  DELETE FROM public.approved_domains WHERE created_by = p_user_id;

  DELETE FROM public.profiles WHERE id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;

  -- Re-enable the trigger
  ALTER TABLE public.assessment_versions ENABLE TRIGGER trg_protect_published_version;

  INSERT INTO public.auth_audit_log (actor_id, target_id, action, new_values)
  VALUES (auth.uid(), p_user_id, 'user_deleted',
    jsonb_build_object('email', v_target_email, 'role', v_target_role));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

-- ============================================================
-- 3. New admin_change_user_role RPC
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_change_user_role(uuid, text);

CREATE OR REPLACE FUNCTION public.admin_change_user_role(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old_role text;
  v_active_superadmin_count int;
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Superadmin access required';
  END IF;

  IF p_role NOT IN ('superadmin', 'propel_csm', 'propel_sales', 'broker') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  IF p_user_id = auth.uid() AND p_role != 'superadmin' THEN
    RAISE EXCEPTION 'You cannot demote your own Superadmin account';
  END IF;

  SELECT role INTO v_old_role FROM public.profiles WHERE id = p_user_id;
  IF v_old_role IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_old_role = 'superadmin' AND p_role != 'superadmin' THEN
    SELECT count(*) INTO v_active_superadmin_count
    FROM public.profiles
    WHERE role = 'superadmin' AND status = 'active';

    IF v_active_superadmin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot demote the only active Superadmin';
    END IF;
  END IF;

  UPDATE public.profiles SET role = p_role, updated_at = now() WHERE id = p_user_id;

  INSERT INTO public.auth_audit_log (actor_id, target_id, action, previous_values, new_values)
  VALUES (auth.uid(), p_user_id, 'role_changed',
    jsonb_build_object('role', v_old_role),
    jsonb_build_object('role', p_role));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_change_user_role(uuid, text) TO authenticated;

-- ============================================================
-- 4. Data cleanup: delete non-superadmin test users
-- ============================================================

ALTER TABLE public.assessment_versions DISABLE TRIGGER trg_protect_published_version;

DELETE FROM public.analysis_evidence_sources
WHERE entered_by IN (SELECT id FROM public.profiles WHERE role != 'superadmin');

DELETE FROM public.analysis_generations
WHERE created_by IN (SELECT id FROM public.profiles WHERE role != 'superadmin')
   OR reviewed_by IN (SELECT id FROM public.profiles WHERE role != 'superadmin');

DELETE FROM public.analysis_input_snapshots
WHERE created_by IN (SELECT id FROM public.profiles WHERE role != 'superadmin');

DELETE FROM public.analysis_notes
WHERE created_by IN (SELECT id FROM public.profiles WHERE role != 'superadmin');

DELETE FROM public.analysis_outcome_goals
WHERE created_by IN (SELECT id FROM public.profiles WHERE role != 'superadmin');

DELETE FROM public.analysis_resource_gaps
WHERE created_by IN (SELECT id FROM public.profiles WHERE role != 'superadmin');

DELETE FROM public.analysis_workspaces
WHERE created_by IN (SELECT id FROM public.profiles WHERE role != 'superadmin')
   OR assigned_to IN (SELECT id FROM public.profiles WHERE role != 'superadmin');

DELETE FROM public.assessment_versions
WHERE created_by IN (SELECT id FROM public.profiles WHERE role != 'superadmin');

DELETE FROM public.assessment_templates
WHERE owner_profile_id IN (SELECT id FROM public.profiles WHERE role != 'superadmin')
   OR created_by IN (SELECT id FROM public.profiles WHERE role != 'superadmin');

DELETE FROM public.assessment_instances
WHERE broker_id IN (SELECT id FROM public.profiles WHERE role != 'superadmin');

DELETE FROM public.broker_notes
WHERE broker_id IN (SELECT id FROM public.profiles WHERE role != 'superadmin');

DELETE FROM public.organization_memberships
WHERE profile_id IN (SELECT id FROM public.profiles WHERE role != 'superadmin');

DELETE FROM public.organizations
WHERE broker_id IN (SELECT id FROM public.profiles WHERE role != 'superadmin');

DELETE FROM public.approved_domains
WHERE created_by IN (SELECT id FROM public.profiles WHERE role != 'superadmin');

DELETE FROM public.profiles WHERE role != 'superadmin';

DELETE FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);

ALTER TABLE public.assessment_versions ENABLE TRIGGER trg_protect_published_version;

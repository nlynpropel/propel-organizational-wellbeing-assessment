/*
# Safe user deactivation and deletion

1. admin_deactivate_user: set status=suspended, ban auth user, preserve all records
2. admin_reactivate_user: set status=active, unban auth user
3. admin_delete_user: replaced — only deletes unused accounts, never shared data, never disables triggers
4. admin_check_user_deletable: check eligibility before deletion
*/

-- ============================================================
-- 1. admin_deactivate_user
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_deactivate_user(p_user_id uuid)
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
    RAISE EXCEPTION 'You cannot deactivate your own account';
  END IF;

  SELECT role, email INTO v_target_role, v_target_email FROM public.profiles WHERE id = p_user_id;
  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Prevent deactivating the only active superadmin
  IF v_target_role = 'superadmin' THEN
    SELECT count(*) INTO v_active_superadmin_count
    FROM public.profiles
    WHERE role = 'superadmin' AND status = 'active';

    IF v_active_superadmin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot deactivate the only active Superadmin';
    END IF;
  END IF;

  -- Suspend profile (revokes application access via is_active_admin and RLS)
  UPDATE public.profiles
  SET status = 'suspended', updated_at = now()
  WHERE id = p_user_id;

  -- Set org memberships to suspended
  UPDATE public.organization_memberships
  SET status = 'suspended', updated_at = now()
  WHERE profile_id = p_user_id;

  -- Ban the auth user server-side (revokes all auth access)
  UPDATE auth.users
  SET banned_until = '2100-01-01T00:00:00Z'::timestamptz
  WHERE id = p_user_id;

  INSERT INTO public.auth_audit_log (actor_id, target_id, action, new_values)
  VALUES (auth.uid(), p_user_id, 'user_deactivated',
    jsonb_build_object('email', v_target_email, 'role', v_target_role));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_deactivate_user(uuid) TO authenticated;

-- ============================================================
-- 2. admin_reactivate_user
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_reactivate_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_target_email text;
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Superadmin access required';
  END IF;

  SELECT email INTO v_target_email FROM public.profiles WHERE id = p_user_id;
  IF v_target_email IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Reactivate profile
  UPDATE public.profiles
  SET status = 'active', updated_at = now()
  WHERE id = p_user_id;

  -- Reactivate org memberships
  UPDATE public.organization_memberships
  SET status = 'active', updated_at = now()
  WHERE profile_id = p_user_id;

  -- Unban the auth user
  UPDATE auth.users
  SET banned_until = NULL
  WHERE id = p_user_id;

  INSERT INTO public.auth_audit_log (actor_id, target_id, action, new_values)
  VALUES (auth.uid(), p_user_id, 'user_reactivated',
    jsonb_build_object('email', v_target_email));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_reactivate_user(uuid) TO authenticated;

-- ============================================================
-- 3. admin_check_user_deletable — eligibility check
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_check_user_deletable(p_user_id uuid)
RETURNS TABLE(eligible boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_record_count int;
  v_blockers text[];
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Superadmin access required';
  END IF;

  IF p_user_id = auth.uid() THEN
    RETURN QUERY SELECT false, 'You cannot delete your own account'::text;
    RETURN;
  END IF;

  -- Check for business records that must not be deleted
  SELECT count(*) INTO v_record_count FROM public.assessment_instances WHERE broker_id = p_user_id;
  IF v_record_count > 0 THEN
    v_blockers := array_append(v_blockers, v_record_count || ' assessment instance(s)');
  END IF;

  SELECT count(*) INTO v_record_count FROM public.assessment_templates WHERE owner_profile_id = p_user_id OR created_by = p_user_id;
  IF v_record_count > 0 THEN
    v_blockers := array_append(v_blockers, v_record_count || ' assessment template(s)');
  END IF;

  SELECT count(*) INTO v_record_count FROM public.assessment_versions WHERE created_by = p_user_id;
  IF v_record_count > 0 THEN
    v_blockers := array_append(v_blockers, v_record_count || ' assessment version(s)');
  END IF;

  SELECT count(*) INTO v_record_count FROM public.analysis_workspaces WHERE created_by = p_user_id OR assigned_to = p_user_id;
  IF v_record_count > 0 THEN
    v_blockers := array_append(v_blockers, v_record_count || ' analysis workspace(s)');
  END IF;

  SELECT count(*) INTO v_record_count FROM public.analysis_generations WHERE created_by = p_user_id OR reviewed_by = p_user_id;
  IF v_record_count > 0 THEN
    v_blockers := array_append(v_blockers, v_record_count || ' AI generation(s)');
  END IF;

  SELECT count(*) INTO v_record_count FROM public.analysis_notes WHERE created_by = p_user_id;
  IF v_record_count > 0 THEN
    v_blockers := array_append(v_blockers, v_record_count || ' analysis note(s)');
  END IF;

  SELECT count(*) INTO v_record_count FROM public.analysis_evidence_sources WHERE entered_by = p_user_id;
  IF v_record_count > 0 THEN
    v_blockers := array_append(v_blockers, v_record_count || ' evidence source(s)');
  END IF;

  SELECT count(*) INTO v_record_count FROM public.analysis_input_snapshots WHERE created_by = p_user_id;
  IF v_record_count > 0 THEN
    v_blockers := array_append(v_blockers, v_record_count || ' input snapshot(s)');
  END IF;

  SELECT count(*) INTO v_record_count FROM public.analysis_outcome_goals WHERE created_by = p_user_id;
  IF v_record_count > 0 THEN
    v_blockers := array_append(v_blockers, v_record_count || ' outcome goal(s)');
  END IF;

  SELECT count(*) INTO v_record_count FROM public.analysis_resource_gaps WHERE created_by = p_user_id;
  IF v_record_count > 0 THEN
    v_blockers := array_append(v_blockers, v_record_count || ' resource gap(s)');
  END IF;

  SELECT count(*) INTO v_record_count FROM public.broker_notes WHERE broker_id = p_user_id;
  IF v_record_count > 0 THEN
    v_blockers := array_append(v_blockers, v_record_count || ' broker note(s)');
  END IF;

  SELECT count(*) INTO v_record_count FROM public.organizations WHERE broker_id = p_user_id;
  IF v_record_count > 0 THEN
    v_blockers := array_append(v_blockers, v_record_count || ' organization(s)');
  END IF;

  SELECT count(*) INTO v_record_count FROM public.approved_domains WHERE created_by = p_user_id;
  IF v_record_count > 0 THEN
    v_blockers := array_append(v_blockers, v_record_count || ' approved domain(s)');
  END IF;

  IF array_length(v_blockers, 1) > 0 THEN
    RETURN QUERY SELECT false, 'User has associated records: ' || array_to_string(v_blockers, ', ') || '. Reassign or remove these records before deleting the user.';
    RETURN;
  END IF;

  RETURN QUERY SELECT true, 'User has no associated business records and can be safely deleted.'::text;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_check_user_deletable(uuid) TO authenticated;

-- ============================================================
-- 4. admin_delete_user — safe replacement
--    Never deletes shared data. Never disables triggers.
--    Only deletes: auth user, profile, memberships, pending invitations.
-- ============================================================

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
  v_eligible boolean;
  v_reason text;
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Superadmin access required';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own account';
  END IF;

  SELECT role, email INTO v_target_role, v_target_email FROM public.profiles WHERE id = p_user_id;
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

  -- Check eligibility — refuse if any business records exist
  SELECT eligible, reason INTO v_eligible, v_reason FROM public.admin_check_user_deletable(p_user_id);
  IF NOT v_eligible THEN
    RAISE EXCEPTION '%', v_reason;
  END IF;

  -- Delete only user-specific records (no shared data)
  DELETE FROM public.organization_memberships WHERE profile_id = p_user_id;

  -- Delete profile
  DELETE FROM public.profiles WHERE id = p_user_id;

  -- Delete auth user (cascades to any remaining FK references that are truly user-only)
  DELETE FROM auth.users WHERE id = p_user_id;

  -- Audit log (actor only — target is gone)
  INSERT INTO public.auth_audit_log (actor_id, target_id, action, new_values)
  VALUES (auth.uid(), p_user_id, 'user_deleted',
    jsonb_build_object('email', v_target_email, 'role', v_target_role));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

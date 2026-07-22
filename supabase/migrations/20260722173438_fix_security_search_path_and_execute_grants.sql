/*
# Fix Security Issues: Search Path + Execute Grants

## Issues Fixed
1. `touch_updated_at` has a mutable search_path (no `SET search_path` clause)
2. Trigger-only functions have EXECUTE grants to anon and/or authenticated
3. Helper functions (never called via RPC from frontend) have EXECUTE grants
4. Broker/admin functions callable by anon (should require authenticated JWT)

## Categorization

### Trigger-only (revoke from BOTH anon AND authenticated):
  enforce_workspace_not_finalized, enforce_workspace_status_transition

### Helper functions never called via frontend RPC (revoke from BOTH):
  can_access_client_org, can_access_workspace, generate_recommendations,
  has_capability, has_platform_admin,
  is_active_admin, is_active_broker, is_active_user,
  is_instance_owner, is_template_owner, is_version_owner, is_version_published

### Respondent-facing (token-based auth, keep anon + authenticated):
  resolve_assessment_by_token, submit_assessment_response,
  finalize_assessment_submission

### Broker/admin functions (revoke anon, keep authenticated):
  approve_workspace, create_analysis_snapshot, evaluate_workspace_readiness,
  finalize_workspace, resolve_accessible_client_orgs,
  resolve_service_organization_id, admin_list_all_profiles,
  calculate_assessment_scores, complete_account_setup,
  duplicate_assessment_version, regenerate_assessment_token,
  retire_assessment_version
*/

-- ============================================================
-- 1. Fix touch_updated_at search_path
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

-- ============================================================
-- 2. Revoke EXECUTE from anon on broker/admin functions
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.approve_workspace(p_workspace_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_analysis_snapshot(p_workspace_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.evaluate_workspace_readiness(p_workspace_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.finalize_workspace(p_workspace_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolve_accessible_client_orgs() FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolve_service_organization_id() FROM anon;

-- ============================================================
-- 3. Revoke EXECUTE from BOTH anon AND authenticated on trigger-only functions
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.enforce_workspace_not_finalized() FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_workspace_not_finalized() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_workspace_status_transition() FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_workspace_status_transition() FROM authenticated;

-- ============================================================
-- 4. Revoke EXECUTE from BOTH anon AND authenticated on helper functions
--    (these are only called internally by other SECURITY DEFINER functions)
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.can_access_client_org(p_org_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_access_client_org(p_org_id uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.can_access_workspace(p_workspace_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_access_workspace(p_workspace_id uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_recommendations(p_result_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_recommendations(p_result_id uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.has_capability(p_capability text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_capability(p_capability text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.has_platform_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_platform_admin() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_active_admin() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_active_broker() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_active_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_instance_owner(p_instance_id uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_template_owner(p_template_id uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_version_owner(p_version_id uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_version_published(p_version_id uuid) FROM authenticated;

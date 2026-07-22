/*
# Restore EXECUTE on authenticated for RLS-policy functions

## Problem
The previous migration revoked EXECUTE from `authenticated` on helper functions
that are used in RLS policies. RLS policies run as the current user, so if
`authenticated` lacks EXECUTE on these functions, all data access breaks
(profiles, assessments, workspaces, etc. all become inaccessible).

## Fix
Restore EXECUTE on `authenticated` for functions referenced in RLS policies:
  can_access_client_org, can_access_workspace, has_capability, has_platform_admin,
  is_active_admin, is_active_broker, is_instance_owner, is_template_owner,
  is_version_owner

These remain revoked from `anon` — anon users only call the three respondent-facing
SECURITY DEFINER functions (which bypass RLS by running as postgres), so anon
never directly evaluates RLS policies on these tables.

Functions NOT used in RLS policies stay revoked from both roles:
  is_active_user, is_version_published, generate_recommendations
(These are only called internally by other SECURITY DEFINER functions, which
run as the postgres owner and don't need explicit grants.)
*/

GRANT EXECUTE ON FUNCTION public.can_access_client_org(p_org_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_workspace(p_workspace_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_capability(p_capability text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_broker() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_instance_owner(p_instance_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_template_owner(p_template_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_version_owner(p_version_id uuid) TO authenticated;

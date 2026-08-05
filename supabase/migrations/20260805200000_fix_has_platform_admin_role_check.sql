/*
# Fix has_platform_admin() — stale role check after canonical roles rename

The canonical-roles migration (20260803171503) renamed every
organization_memberships row with role='platform_admin' to role='superadmin',
but has_platform_admin() was never updated to match. It has been checking for
a role value that no longer exists in the table, so it always returns false —
silently breaking every RLS policy and RPC that depends on it, including
resolve_accessible_client_orgs() (used by auto_create_workspace_and_snapshot,
the strategy-report-generation RPC).
*/

CREATE OR REPLACE FUNCTION public.has_platform_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.profile_id = auth.uid()
      AND om.role = 'superadmin'
      AND om.status = 'active'
  );
$$;
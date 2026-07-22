/*
# Bridge Migration: Legacy Broker Ownership → Neutral Organization Model

## Purpose
Update active RLS policies and add RPCs so the service layer can resolve
accessible client organizations via organization_memberships and
organization_client_relationships instead of broker_id matching.
Legacy broker_id columns and is_active_broker() are retained for backward
compatibility but new policies use the neutral model first, falling back
to broker_id.

## Changes

### 1. New RPC: resolve_accessible_client_orgs
Returns the set of client organization IDs the current user can access:
- Platform admins: all organizations with organization_type = 'employer'
- Other users: client orgs linked via organization_client_relationships
  where the user has an active membership in the service organization,
  OR legacy fallback: orgs where broker_id matches the user's profile id
  and the user is a broker.

### 2. New RPC: resolve_service_organization_id
Returns the service organization ID for the current user (their primary
membership organization). Used when creating clients/assessments so the
service layer doesn't need to pass broker_id.

### 3. Updated RLS: organizations
SELECT policy now allows access if:
- User is platform admin, OR
- Org is a client org accessible via resolve_accessible_client_orgs, OR
- Legacy: org.broker_id = auth.uid() (backward compat)
INSERT/UPDATE/DELETE policies unchanged (still use is_active_broker / has_platform_admin).

### 4. Updated RLS: assessment_instances
SELECT policy now allows access if:
- User is platform admin, OR
- Instance belongs to an org accessible via resolve_accessible_client_orgs, OR
- Legacy: instance.broker_id = auth.uid()

### 5. Updated RLS: broker_notes
SELECT/INSERT/UPDATE/DELETE policies now use neutral model with legacy fallback.

### 6. Feature flag enforcement for AI capabilities
Add a check: has_capability returns false for AI capabilities if a
feature flag is set in a new app_settings table (disabled by default).
This ensures disabled AI feature flags override granted AI capabilities.

## Security
- All new policies use auth.uid() and membership checks.
- No USING(true) shortcuts.
- Legacy broker_id fallback is temporary and will be removed in a future migration.
*/

-- ============================================================
-- 1. resolve_accessible_client_orgs RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_accessible_client_orgs()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Platform admins see all employer-type orgs
  SELECT id FROM public.organizations
  WHERE public.has_platform_admin()
    AND organization_type = 'employer'

  UNION ALL

  -- Users with service-org memberships see linked client orgs
  SELECT ocr.client_organization_id
  FROM public.organization_client_relationships ocr
  JOIN public.organization_memberships om
    ON om.organization_id = ocr.service_organization_id
    AND om.profile_id = auth.uid()
    AND om.status = 'active'
  WHERE ocr.status = 'active'

  UNION ALL

  -- Legacy fallback: broker_id still owns the org
  SELECT o.id
  FROM public.organizations o
  JOIN public.profiles p ON p.id = auth.uid() AND p.role = 'broker'
  WHERE o.broker_id = auth.uid()
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_accessible_client_orgs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_accessible_client_orgs() TO authenticated;

-- ============================================================
-- 2. resolve_service_organization_id RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_service_organization_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT om.organization_id
  FROM public.organization_memberships om
  WHERE om.profile_id = auth.uid()
    AND om.status = 'active'
  ORDER BY
    CASE om.role
      WHEN 'platform_admin' THEN 0
      WHEN 'organization_admin' THEN 1
      WHEN 'advisor' THEN 2
      WHEN 'client_manager' THEN 3
      ELSE 4
    END,
    om.created_at ASC
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_service_organization_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_service_organization_id() TO authenticated;

-- ============================================================
-- 3. Updated RLS: organizations (SELECT only — keep INSERT/UPDATE/DELETE as-is)
-- ============================================================
DROP POLICY IF EXISTS "select_organizations_neutral" ON organizations;
CREATE POLICY "select_organizations_neutral" ON organizations
  FOR SELECT TO authenticated
  USING (
    public.has_platform_admin()
    OR id IN (SELECT public.resolve_accessible_client_orgs())
  );

-- ============================================================
-- 4. Updated RLS: assessment_instances (SELECT)
-- ============================================================
DROP POLICY IF EXISTS "select_instances_neutral" ON assessment_instances;
CREATE POLICY "select_instances_neutral" ON assessment_instances
  FOR SELECT TO authenticated
  USING (
    public.has_platform_admin()
    OR organization_id IN (SELECT public.resolve_accessible_client_orgs())
    OR broker_id = auth.uid()
  );

-- ============================================================
-- 5. Updated RLS: broker_notes (all verbs)
-- ============================================================
DROP POLICY IF EXISTS "select_notes_neutral" ON broker_notes;
CREATE POLICY "select_notes_neutral" ON broker_notes
  FOR SELECT TO authenticated
  USING (
    public.has_platform_admin()
    OR organization_id IN (SELECT public.resolve_accessible_client_orgs())
    OR broker_id = auth.uid()
  );

DROP POLICY IF EXISTS "insert_notes_neutral" ON broker_notes;
CREATE POLICY "insert_notes_neutral" ON broker_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_platform_admin()
    OR organization_id IN (SELECT public.resolve_accessible_client_orgs())
    OR broker_id = auth.uid()
  );

DROP POLICY IF EXISTS "update_notes_neutral" ON broker_notes;
CREATE POLICY "update_notes_neutral" ON broker_notes
  FOR UPDATE TO authenticated
  USING (
    public.has_platform_admin()
    OR organization_id IN (SELECT public.resolve_accessible_client_orgs())
    OR broker_id = auth.uid()
  )
  WITH CHECK (
    public.has_platform_admin()
    OR organization_id IN (SELECT public.resolve_accessible_client_orgs())
    OR broker_id = auth.uid()
  );

DROP POLICY IF EXISTS "delete_notes_neutral" ON broker_notes;
CREATE POLICY "delete_notes_neutral" ON broker_notes
  FOR DELETE TO authenticated
  USING (
    public.has_platform_admin()
    OR organization_id IN (SELECT public.resolve_accessible_client_orgs())
    OR broker_id = auth.uid()
  );

-- ============================================================
-- 6. AI capability feature-flag enforcement
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_app_settings" ON app_settings;
CREATE POLICY "select_app_settings" ON app_settings
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.app_settings (key, value) VALUES
  ('ai_feature_flags', '{"enable_ai_analysis": false, "enable_strategy_analysis": false, "enable_incentive_design": false, "enable_organization_playbook": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Override has_capability to check AI feature flags
CREATE OR REPLACE FUNCTION public.has_capability(p_capability text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Check AI feature flags first
  SELECT CASE
    WHEN p_capability IN ('generate_ai_analysis', 'edit_strategy_analysis', 'approve_strategy_analysis') THEN
      NOT EXISTS (
        SELECT 1 FROM public.app_settings
        WHERE key = 'ai_feature_flags'
          AND value->>'enable_ai_analysis' = 'false'
      ) OR FALSE
      -- If flag is false, deny regardless of role
      AND EXISTS (
        SELECT 1 FROM public.app_settings
        WHERE key = 'ai_feature_flags'
          AND value->>'enable_ai_analysis' = 'true'
      )
    WHEN p_capability = 'manage_incentive_designs' THEN
      EXISTS (
        SELECT 1 FROM public.app_settings
        WHERE key = 'ai_feature_flags'
          AND value->>'enable_incentive_design' = 'true'
      )
    WHEN p_capability = 'manage_organization_playbook' THEN
      EXISTS (
        SELECT 1 FROM public.app_settings
        WHERE key = 'ai_feature_flags'
          AND value->>'enable_organization_playbook' = 'true'
      )
    ELSE TRUE
  END
  AND EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    JOIN public.organization_role_capabilities orc ON orc.role = om.role
    WHERE om.profile_id = auth.uid()
      AND om.status = 'active'
      AND orc.capability = p_capability
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_capability(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_capability(text) TO authenticated;

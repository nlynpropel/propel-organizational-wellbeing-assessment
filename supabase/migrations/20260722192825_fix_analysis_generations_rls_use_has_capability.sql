-- ============================================================
-- Fix: analysis_generations RLS must use has_capability()
-- to respect the enable_ai_analysis feature flag.
-- Also seed generate_ai_analysis for pilot roles.
-- ============================================================

-- 1. Drop existing policies that bypass has_capability()
DROP POLICY IF EXISTS "select_own_generations" ON analysis_generations;
DROP POLICY IF EXISTS "insert_generations" ON analysis_generations;
DROP POLICY IF EXISTS "update_generations" ON analysis_generations;
DROP POLICY IF EXISTS "delete_generations" ON analysis_generations;

-- 2. Recreate policies using has_capability() + can_access_workspace()
--    These match the pattern used by all other analysis tables.

CREATE POLICY "select_own_generations"
  ON analysis_generations FOR SELECT
  TO authenticated
  USING (can_access_workspace(workspace_id));

CREATE POLICY "insert_generations"
  ON analysis_generations FOR INSERT
  TO authenticated
  WITH CHECK (
    has_capability('generate_ai_analysis')
    AND can_access_workspace(workspace_id)
  );

CREATE POLICY "update_generations"
  ON analysis_generations FOR UPDATE
  TO authenticated
  USING (
    has_capability('edit_strategy_analysis')
    AND can_access_workspace(workspace_id)
  )
  WITH CHECK (
    has_capability('edit_strategy_analysis')
    AND can_access_workspace(workspace_id)
  );

CREATE POLICY "delete_generations"
  ON analysis_generations FOR DELETE
  TO authenticated
  USING (
    has_capability('edit_strategy_analysis')
    AND can_access_workspace(workspace_id)
  );

-- 3. Seed generate_ai_analysis for pilot roles only.
--    platform_admin already has it. Add organization_admin and advisor.
--    Do NOT grant to employer_admin, client_manager, or viewer.

INSERT INTO organization_role_capabilities (role, capability)
VALUES ('organization_admin', 'generate_ai_analysis')
ON CONFLICT DO NOTHING;

INSERT INTO organization_role_capabilities (role, capability)
VALUES ('advisor', 'generate_ai_analysis')
ON CONFLICT DO NOTHING;

-- 4. Verify the seeding
DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM organization_role_capabilities
    WHERE role = 'platform_admin' AND capability = 'generate_ai_analysis'
  ), 'platform_admin missing generate_ai_analysis';
  ASSERT EXISTS (
    SELECT 1 FROM organization_role_capabilities
    WHERE role = 'organization_admin' AND capability = 'generate_ai_analysis'
  ), 'organization_admin missing generate_ai_analysis';
  ASSERT EXISTS (
    SELECT 1 FROM organization_role_capabilities
    WHERE role = 'advisor' AND capability = 'generate_ai_analysis'
  ), 'advisor missing generate_ai_analysis';
  ASSERT NOT EXISTS (
    SELECT 1 FROM organization_role_capabilities
    WHERE role = 'employer_admin' AND capability = 'generate_ai_analysis'
  ), 'employer_admin should NOT have generate_ai_analysis';
  ASSERT NOT EXISTS (
    SELECT 1 FROM organization_role_capabilities
    WHERE role = 'client_manager' AND capability = 'generate_ai_analysis'
  ), 'client_manager should NOT have generate_ai_analysis';
  ASSERT NOT EXISTS (
    SELECT 1 FROM organization_role_capabilities
    WHERE role = 'viewer' AND capability = 'generate_ai_analysis'
  ), 'viewer should NOT have generate_ai_analysis';
END $$;
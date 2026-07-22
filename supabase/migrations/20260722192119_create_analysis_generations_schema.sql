-- ============================================================
-- AI Phase 1A: analysis_generations table + governance
-- ============================================================

CREATE TYPE generation_type AS ENUM ('strategy_poc');
CREATE TYPE generation_status AS ENUM (
  'queued',
  'generating',
  'draft_generated',
  'failed',
  'approved',
  'rejected'
);

CREATE TABLE analysis_generations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL REFERENCES analysis_workspaces(id) ON DELETE CASCADE,
  snapshot_id         uuid NOT NULL REFERENCES analysis_input_snapshots(id) ON DELETE RESTRICT,
  generation_type     generation_type NOT NULL DEFAULT 'strategy_poc',
  status              generation_status NOT NULL DEFAULT 'queued',
  model_name          text NOT NULL,
  prompt_version      text NOT NULL,
  input_snapshot_version integer NOT NULL,
  output_json         jsonb,
  error_message       text,
  created_by          uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  reviewed_by         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_analysis_generations_workspace
  ON analysis_generations(workspace_id, created_at DESC);
CREATE INDEX idx_analysis_generations_snapshot
  ON analysis_generations(snapshot_id);
CREATE INDEX idx_analysis_generations_status
  ON analysis_generations(status);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE analysis_generations ENABLE ROW LEVEL SECURITY;

-- Users can see generations for workspaces in their organization
CREATE POLICY "select_own_generations"
  ON analysis_generations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM analysis_workspaces aw
      JOIN organization_memberships om
        ON om.organization_id = aw.service_organization_id
      WHERE aw.id = analysis_generations.workspace_id
        AND om.profile_id = auth.uid()
        AND om.status = 'active'
    )
  );

-- Only users with generate_ai_analysis capability can insert
CREATE POLICY "insert_generations"
  ON analysis_generations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM analysis_workspaces aw
      JOIN organization_memberships om
        ON om.organization_id = aw.service_organization_id
      JOIN organization_role_capabilities orc
        ON orc.role = om.role
      WHERE aw.id = analysis_generations.workspace_id
        AND om.profile_id = auth.uid()
        AND om.status = 'active'
        AND orc.capability = 'generate_ai_analysis'
    )
  );

-- Only users with edit_strategy_analysis can update status fields
CREATE POLICY "update_generations"
  ON analysis_generations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM analysis_workspaces aw
      JOIN organization_memberships om
        ON om.organization_id = aw.service_organization_id
      JOIN organization_role_capabilities orc
        ON orc.role = om.role
      WHERE aw.id = analysis_generations.workspace_id
        AND om.profile_id = auth.uid()
        AND om.status = 'active'
        AND orc.capability IN ('edit_strategy_analysis', 'approve_strategy_analysis')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM analysis_workspaces aw
      JOIN organization_memberships om
        ON om.organization_id = aw.service_organization_id
      JOIN organization_role_capabilities orc
        ON orc.role = om.role
      WHERE aw.id = analysis_generations.workspace_id
        AND om.profile_id = auth.uid()
        AND om.status = 'active'
        AND orc.capability IN ('edit_strategy_analysis', 'approve_strategy_analysis')
    )
  );

-- Only users with edit_strategy_analysis can delete
CREATE POLICY "delete_generations"
  ON analysis_generations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM analysis_workspaces aw
      JOIN organization_memberships om
        ON om.organization_id = aw.service_organization_id
      JOIN organization_role_capabilities orc
        ON orc.role = om.role
      WHERE aw.id = analysis_generations.workspace_id
        AND om.profile_id = auth.uid()
        AND om.status = 'active'
        AND orc.capability = 'edit_strategy_analysis'
    )
  );

-- ============================================================
-- Validation function: reject snapshots below sufficient readiness
-- ============================================================
CREATE OR REPLACE FUNCTION validate_generation_readiness(
  p_snapshot_id uuid
) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM analysis_input_snapshots
    WHERE id = p_snapshot_id
      AND completeness_level IN ('sufficient', 'strong')
  );
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION validate_generation_readiness TO authenticated;
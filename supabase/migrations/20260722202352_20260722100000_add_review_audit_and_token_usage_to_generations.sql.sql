-- Add review audit fields and token usage tracking to analysis_generations

-- 1. Add review audit columns
ALTER TABLE analysis_generations
  ADD COLUMN IF NOT EXISTS original_output_json jsonb,
  ADD COLUMN IF NOT EXISTS reviewed_output_json jsonb,
  ADD COLUMN IF NOT EXISTS review_status text,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- 2. Add token usage columns
ALTER TABLE analysis_generations
  ADD COLUMN IF NOT EXISTS input_tokens integer,
  ADD COLUMN IF NOT EXISTS output_tokens integer,
  ADD COLUMN IF NOT EXISTS total_tokens integer;

-- 3. Backfill original_output_json for existing draft_generated rows
UPDATE analysis_generations
SET original_output_json = output_json
WHERE original_output_json IS NULL
  AND output_json IS NOT NULL
  AND status = 'draft_generated';

-- 4. Add constraint: review_status must be one of the allowed values
ALTER TABLE analysis_generations
  ADD CONSTRAINT analysis_generations_review_status_chk
  CHECK (review_status IS NULL OR review_status IN ('pending_review', 'approved', 'rejected'));

-- 5. Update RLS policies for review actions
--    Only users with generate_ai_analysis or approve_strategy_analysis can update review fields
--    We need a policy that allows the creator's org members to update review fields

-- Drop existing UPDATE policy if any
DROP POLICY IF EXISTS update_generations ON analysis_generations;

-- Create UPDATE policy: users can update generations they have access to via workspace org membership
CREATE POLICY update_generations ON analysis_generations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM analysis_workspaces w
      WHERE w.id = analysis_generations.workspace_id
      AND (
        -- Service org members
        EXISTS (
          SELECT 1 FROM organization_memberships om
          WHERE om.organization_id = w.service_organization_id
          AND om.profile_id = auth.uid()
          AND om.status = 'active'
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM analysis_workspaces w
      WHERE w.id = analysis_generations.workspace_id
      AND (
        EXISTS (
          SELECT 1 FROM organization_memberships om
          WHERE om.organization_id = w.service_organization_id
          AND om.profile_id = auth.uid()
          AND om.status = 'active'
        )
      )
    )
  );

-- 6. Add index for querying active generations by snapshot
CREATE INDEX IF NOT EXISTS idx_analysis_generations_snapshot_status
  ON analysis_generations (snapshot_id, status)
  WHERE status IN ('queued', 'generating');
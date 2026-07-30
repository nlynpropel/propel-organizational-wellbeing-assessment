/*
# Secure AI Generation Review Actions via RPC

## Summary
Replaces direct client-side UPDATE on analysis_generations with three
SECURITY DEFINER RPC functions that enforce capability checks server-side.
This prevents browser clients from bypassing authorization or modifying
immutable generation fields (original_output_json, output_json, model_name,
prompt_version, input_snapshot_version, token fields, created_by, snapshot_id,
workspace_id).

## Changes

### 1. Drop direct UPDATE RLS policy
The existing `update_generations` policy allowed any service-org member with
`edit_strategy_analysis` or `approve_strategy_analysis` to update ANY column
on the row — including immutable fields like output_json, original_output_json,
model_name, token counts, etc. This is removed entirely. After this migration,
no browser client can UPDATE analysis_generations directly through the PostgREST
API. All mutations must go through the RPC functions below.

### 2. RPC: save_generation_review_edits
- Capability required: `edit_strategy_analysis`
- Only updates `reviewed_output_json` on rows with status = 'draft_generated'
- Does NOT touch output_json, original_output_json, or any metadata field
- Normalizes evidence paths to canonical form before saving

### 3. RPC: approve_generation
- Capability required: `approve_strategy_analysis`
- Only operates on rows with status = 'draft_generated'
- Sets status = 'approved', review_status = 'approved', reviewed_by, reviewed_at
- Optionally saves reviewed_output_json if provided
- Does NOT touch output_json, original_output_json, or any metadata field

### 4. RPC: reject_generation
- Capability required: `approve_strategy_analysis`
- Only operates on rows with status = 'draft_generated'
- Sets status = 'rejected', review_status = 'rejected', reviewed_by, reviewed_at,
  rejection_reason
- Does NOT touch output_json, original_output_json, or any metadata field

### 5. Evidence path normalization helper
- `normalize_evidence_paths(jsonb)`: recursively walks the JSON and prefixes
  assessment-nested keys with `assessment.` so canonical paths are stored in
  both original_output_json (via edge function) and reviewed_output_json.

### Security
- All three RPCs are SECURITY DEFINER, SET search_path = public
- All three check workspace membership + capability via has_capability()
- All three verify the generation belongs to a workspace in the caller's org
- All three enforce status = 'draft_generated' (approved/rejected are read-only)
- Execute granted to authenticated only
- Direct UPDATE RLS policy removed — no client can bypass the RPCs
*/

-- ============================================================
-- 1. Drop direct UPDATE policy
-- ============================================================
DROP POLICY IF EXISTS "update_generations" ON analysis_generations;
-- Also drop any unquoted variant from prior migrations
DROP POLICY IF EXISTS update_generations ON analysis_generations;

-- ============================================================
-- 2. Evidence path normalization helper
-- ============================================================

CREATE OR REPLACE FUNCTION public.normalize_evidence_paths(p_data jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    CASE
      -- If the value is an object, recurse into each key
      WHEN jsonb_typeof(p_data) = 'object' THEN
        (
          SELECT jsonb_object_agg(
            key,
            CASE
              -- For evidence_references arrays, normalize the "path" field
              WHEN key = 'evidence_references' AND jsonb_typeof(value) = 'array' THEN
                (
                  SELECT jsonb_agg(
                    CASE
                      WHEN elem ? 'path' THEN
                        jsonb_set(
                          elem,
                          '{path}',
                          to_jsonb(
                            CASE
                              -- Already has assessment. prefix — leave as-is
                              WHEN (elem->>'path') LIKE 'assessment.%' THEN elem->>'path'
                              -- Check if first segment (before . or [) is a nested assessment key
                              WHEN split_part(elem->>'path', '.', 1) IN (
                                'strategy_dimension_scores',
                                'behavioral_readiness',
                                'contextual_responses',
                                'diagnostic_findings',
                                'template_name',
                                'template_description',
                                'instance_status',
                                'submitted_at',
                                'overall_score',
                                'maturity_band'
                              ) THEN 'assessment.' || (elem->>'path')
                              -- Extract key before bracket: "contextual_responses[1]" -> "contextual_responses"
                              WHEN regexp_replace(split_part(elem->>'path', '.', 1), '\[.*$', '') IN (
                                'strategy_dimension_scores',
                                'behavioral_readiness',
                                'contextual_responses',
                                'diagnostic_findings',
                                'template_name',
                                'template_description',
                                'instance_status',
                                'submitted_at',
                                'overall_score',
                                'maturity_band'
                              ) THEN 'assessment.' || (elem->>'path')
                              ELSE elem->>'path'
                            END
                          )
                        )
                      ELSE elem
                    END
                  )
                  FROM jsonb_array_elements(value) AS t(elem)
                )
              -- For other keys, recurse
              ELSE public.normalize_evidence_paths(value)
            END
          )
          FROM jsonb_each(p_data)
        )
      -- If the value is an array, recurse into each element
      WHEN jsonb_typeof(p_data) = 'array' THEN
        (
          SELECT jsonb_agg(public.normalize_evidence_paths(elem))
          FROM jsonb_array_elements(p_data) AS t(elem)
        )
      ELSE p_data
    END;
$$;

-- ============================================================
-- 3. save_generation_review_edits
-- ============================================================
CREATE OR REPLACE FUNCTION public.save_generation_review_edits(
  p_generation_id uuid,
  p_reviewed_output jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid;
  v_service_org_id uuid;
  v_current_status text;
BEGIN
  -- Get the generation's workspace and current status
  SELECT ag.workspace_id, ag.status::text
  INTO v_workspace_id, v_current_status
  FROM analysis_generations ag
  WHERE ag.id = p_generation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Generation not found';
  END IF;

  -- Only draft_generated generations can be edited
  IF v_current_status <> 'draft_generated' THEN
    RAISE EXCEPTION 'Only draft-generated generations can be edited (current status: %)', v_current_status;
  END IF;

  -- Verify workspace membership
  SELECT aw.service_organization_id
  INTO v_service_org_id
  FROM analysis_workspaces aw
  WHERE aw.id = v_workspace_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace not found';
  END IF;

  -- Verify user is an active member of the service organization
  IF NOT EXISTS (
    SELECT 1 FROM organization_memberships om
    WHERE om.organization_id = v_service_org_id
      AND om.profile_id = auth.uid()
      AND om.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized: user is not a member of this organization';
  END IF;

  -- Verify user has edit_strategy_analysis capability
  IF NOT public.has_capability('edit_strategy_analysis') THEN
    RAISE EXCEPTION 'Not authorized: edit_strategy_analysis capability required';
  END IF;

  -- Normalize evidence paths and save ONLY reviewed_output_json
  UPDATE analysis_generations
  SET reviewed_output_json = public.normalize_evidence_paths(p_reviewed_output)
  WHERE id = p_generation_id
    AND status = 'draft_generated';

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_generation_review_edits(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_generation_review_edits(uuid, jsonb) TO authenticated;

-- ============================================================
-- 4. approve_generation
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_generation(
  p_generation_id uuid,
  p_reviewed_output jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid;
  v_service_org_id uuid;
  v_current_status text;
BEGIN
  -- Get the generation's workspace and current status
  SELECT ag.workspace_id, ag.status::text
  INTO v_workspace_id, v_current_status
  FROM analysis_generations ag
  WHERE ag.id = p_generation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Generation not found';
  END IF;

  -- Only draft_generated generations can be approved
  IF v_current_status <> 'draft_generated' THEN
    RAISE EXCEPTION 'Only draft-generated generations can be approved (current status: %)', v_current_status;
  END IF;

  -- Verify workspace membership
  SELECT aw.service_organization_id
  INTO v_service_org_id
  FROM analysis_workspaces aw
  WHERE aw.id = v_workspace_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace not found';
  END IF;

  -- Verify user is an active member of the service organization
  IF NOT EXISTS (
    SELECT 1 FROM organization_memberships om
    WHERE om.organization_id = v_service_org_id
      AND om.profile_id = auth.uid()
      AND om.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized: user is not a member of this organization';
  END IF;

  -- Verify user has approve_strategy_analysis capability
  IF NOT public.has_capability('approve_strategy_analysis') THEN
    RAISE EXCEPTION 'Not authorized: approve_strategy_analysis capability required';
  END IF;

  -- Approve: set status, review fields, optionally save reviewed output
  UPDATE analysis_generations
  SET
    status = 'approved',
    review_status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    reviewed_output_json = CASE
      WHEN p_reviewed_output IS NOT NULL THEN public.normalize_evidence_paths(p_reviewed_output)
      ELSE reviewed_output_json
    END
  WHERE id = p_generation_id
    AND status = 'draft_generated';

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_generation(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_generation(uuid, jsonb) TO authenticated;

-- ============================================================
-- 5. reject_generation
-- ============================================================
CREATE OR REPLACE FUNCTION public.reject_generation(
  p_generation_id uuid,
  p_rejection_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid;
  v_service_org_id uuid;
  v_current_status text;
BEGIN
  -- Validate rejection reason is not empty
  IF p_rejection_reason IS NULL OR btrim(p_rejection_reason) = '' THEN
    RAISE EXCEPTION 'A rejection reason is required';
  END IF;

  -- Get the generation's workspace and current status
  SELECT ag.workspace_id, ag.status::text
  INTO v_workspace_id, v_current_status
  FROM analysis_generations ag
  WHERE ag.id = p_generation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Generation not found';
  END IF;

  -- Only draft_generated generations can be rejected
  IF v_current_status <> 'draft_generated' THEN
    RAISE EXCEPTION 'Only draft-generated generations can be rejected (current status: %)', v_current_status;
  END IF;

  -- Verify workspace membership
  SELECT aw.service_organization_id
  INTO v_service_org_id
  FROM analysis_workspaces aw
  WHERE aw.id = v_workspace_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace not found';
  END IF;

  -- Verify user is an active member of the service organization
  IF NOT EXISTS (
    SELECT 1 FROM organization_memberships om
    WHERE om.organization_id = v_service_org_id
      AND om.profile_id = auth.uid()
      AND om.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized: user is not a member of this organization';
  END IF;

  -- Verify user has approve_strategy_analysis capability
  IF NOT public.has_capability('approve_strategy_analysis') THEN
    RAISE EXCEPTION 'Not authorized: approve_strategy_analysis capability required';
  END IF;

  -- Reject: set status, review fields, rejection reason
  UPDATE analysis_generations
  SET
    status = 'rejected',
    review_status = 'rejected',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    rejection_reason = p_rejection_reason
  WHERE id = p_generation_id
    AND status = 'draft_generated';

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_generation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_generation(uuid, text) TO authenticated;

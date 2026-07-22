/*
# Analysis Input Snapshots & Readiness Evaluator

## Purpose
1. Server-side readiness evaluator that checks whether a workspace has
   sufficient inputs for AI analysis generation.
2. Immutable, normalized snapshots of all workspace inputs that future AI
   generation will reference.

## New Table: analysis_input_snapshots
- id (uuid PK)
- workspace_id (FK → analysis_workspaces, cascade)
- snapshot_version (integer, not null)
- input_json (jsonb, not null) — normalized, PII-free snapshot
- completeness_level (text, not null) — not_ready, limited, sufficient, strong
- created_by (FK → profiles, restrict)
- created_at (timestamptz, default now())

No updated_at — snapshots are immutable.

## RPCs
1. evaluate_workspace_readiness(p_workspace_id) → jsonb
   Returns { level, requirements: [{ key, label, status, detail }] }
   Status values: complete, incomplete, unavailable, optional.

2. create_analysis_snapshot(p_workspace_id) → jsonb
   Server-side only. Builds normalized input_json from all workspace data.
   Strips internal IDs, tokens, respondent PII, hidden scoring logic.
   Returns { snapshot_id, snapshot_version, completeness_level }.

## Security
- RLS on analysis_input_snapshots: SELECT via can_access_workspace,
  INSERT only via SECURITY DEFINER RPC (no direct client INSERT).
  No UPDATE or DELETE policies — snapshots are immutable.
- Both RPCs require edit_strategy_analysis capability.
*/

-- ============================================================
-- 1. analysis_input_snapshots table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.analysis_input_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.analysis_workspaces(id) ON DELETE CASCADE,
  snapshot_version integer NOT NULL,
  input_json jsonb NOT NULL,
  completeness_level text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.analysis_input_snapshots
  DROP CONSTRAINT IF EXISTS analysis_input_snapshots_completeness_check;
ALTER TABLE public.analysis_input_snapshots
  ADD CONSTRAINT analysis_input_snapshots_completeness_check
  CHECK (completeness_level IN ('not_ready', 'limited', 'sufficient', 'strong'));

-- One snapshot per version per workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_snapshots_workspace_version
  ON public.analysis_input_snapshots(workspace_id, snapshot_version);

CREATE INDEX IF NOT EXISTS idx_snapshots_workspace
  ON public.analysis_input_snapshots(workspace_id);

-- ============================================================
-- 2. RLS: analysis_input_snapshots
-- ============================================================
ALTER TABLE public.analysis_input_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_snapshots_accessible" ON analysis_input_snapshots;
CREATE POLICY "select_snapshots_accessible" ON analysis_input_snapshots
  FOR SELECT TO authenticated
  USING (public.can_access_workspace(workspace_id));

-- No INSERT/UPDATE/DELETE policies — only the RPC can insert,
-- and snapshots are immutable.

-- ============================================================
-- 3. RPC: evaluate_workspace_readiness
-- ============================================================
CREATE OR REPLACE FUNCTION public.evaluate_workspace_readiness(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_workspace public.analysis_workspaces%ROWTYPE;
  v_instance public.assessment_instances%ROWTYPE;
  v_goal_count integer;
  v_program_count integer;
  v_utilization_count integer;
  v_gap_count integer;
  v_note_count integer;
  v_evidence_count integer;
  v_has_scores boolean;
  v_requirements jsonb[] := '{}';
  v_level text := 'not_ready';
  v_complete_count integer := 0;
  v_total_required integer := 0;
BEGIN
  -- Access check
  IF NOT public.can_access_workspace(p_workspace_id) THEN
    RAISE EXCEPTION 'Workspace not found or access denied';
  END IF;

  SELECT * INTO v_workspace FROM public.analysis_workspaces WHERE id = p_workspace_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace not found';
  END IF;

  -- 1. Finalized assessment present
  SELECT * INTO v_instance
    FROM public.assessment_instances
    WHERE id = v_workspace.assessment_instance_id
      AND status IN ('submitted', 'report_ready');
  v_total_required := v_total_required + 1;
  IF FOUND THEN
    v_requirements := array_append(v_requirements, jsonb_build_object(
      'key', 'finalized_assessment', 'label', 'Finalized assessment',
      'status', 'complete', 'detail', v_instance.status
    ));
    v_complete_count := v_complete_count + 1;
  ELSE
    v_requirements := array_append(v_requirements, jsonb_build_object(
      'key', 'finalized_assessment', 'label', 'Finalized assessment',
      'status', 'incomplete', 'detail', 'No finalized assessment linked'
    ));
  END IF;

  -- 2. Assessment scores available
  v_total_required := v_total_required + 1;
  v_has_scores := v_instance IS NOT NULL AND v_instance.overall_score IS NOT NULL;
  IF v_has_scores THEN
    v_requirements := array_append(v_requirements, jsonb_build_object(
      'key', 'assessment_scores', 'label', 'Assessment scores',
      'status', 'complete', 'detail', 'Overall score available'
    ));
    v_complete_count := v_complete_count + 1;
  ELSE
    v_requirements := array_append(v_requirements, jsonb_build_object(
      'key', 'assessment_scores', 'label', 'Assessment scores',
      'status', 'incomplete', 'detail', 'No scores calculated yet'
    ));
  END IF;

  -- 3. At least one desired outcome
  SELECT count(*) INTO v_goal_count
    FROM public.analysis_outcome_goals WHERE workspace_id = p_workspace_id;
  v_total_required := v_total_required + 1;
  IF v_goal_count > 0 THEN
    v_requirements := array_append(v_requirements, jsonb_build_object(
      'key', 'desired_outcomes', 'label', 'Desired outcomes',
      'status', 'complete', 'detail', v_goal_count || ' outcome(s) defined'
    ));
    v_complete_count := v_complete_count + 1;
  ELSE
    v_requirements := array_append(v_requirements, jsonb_build_object(
      'key', 'desired_outcomes', 'label', 'Desired outcomes',
      'status', 'incomplete', 'detail', 'No outcomes defined'
    ));
  END IF;

  -- 4. Program inventory reviewed
  SELECT count(*) INTO v_program_count
    FROM public.client_programs
    WHERE client_organization_id = v_workspace.client_organization_id;
  v_total_required := v_total_required + 1;
  IF v_program_count > 0 THEN
    v_requirements := array_append(v_requirements, jsonb_build_object(
      'key', 'program_inventory', 'label', 'Program inventory',
      'status', 'complete', 'detail', v_program_count || ' program(s) listed'
    ));
    v_complete_count := v_complete_count + 1;
  ELSE
    v_requirements := array_append(v_requirements, jsonb_build_object(
      'key', 'program_inventory', 'label', 'Program inventory',
      'status', 'incomplete', 'detail', 'No programs entered'
    ));
  END IF;

  -- 5. Utilization entered or explicitly marked unavailable
  SELECT count(*) INTO v_utilization_count
    FROM public.program_utilization_records WHERE workspace_id = p_workspace_id;
  v_total_required := v_total_required + 1;
  IF v_utilization_count > 0 THEN
    v_requirements := array_append(v_requirements, jsonb_build_object(
      'key', 'utilization_data', 'label', 'Utilization data',
      'status', 'complete', 'detail', v_utilization_count || ' record(s)'
    ));
    v_complete_count := v_complete_count + 1;
  ELSE
    -- Check if there's a note marking utilization as unavailable
    SELECT count(*) INTO v_utilization_count
      FROM public.analysis_notes
      WHERE workspace_id = p_workspace_id
        AND note_type = 'data_limitation'
        AND content ILIKE '%utilization%unavailable%';
    IF v_utilization_count > 0 THEN
      v_requirements := array_append(v_requirements, jsonb_build_object(
        'key', 'utilization_data', 'label', 'Utilization data',
        'status', 'unavailable', 'detail', 'Explicitly marked unavailable'
      ));
    ELSE
      v_requirements := array_append(v_requirements, jsonb_build_object(
        'key', 'utilization_data', 'label', 'Utilization data',
        'status', 'incomplete', 'detail', 'No utilization data entered'
      ));
    END IF;
  END IF;

  -- 6. Resource gaps reviewed
  SELECT count(*) INTO v_gap_count
    FROM public.analysis_resource_gaps WHERE workspace_id = p_workspace_id;
  v_total_required := v_total_required + 1;
  IF v_gap_count > 0 THEN
    v_requirements := array_append(v_requirements, jsonb_build_object(
      'key', 'resource_gaps', 'label', 'Resource gaps',
      'status', 'complete', 'detail', v_gap_count || ' gap(s) identified'
    ));
    v_complete_count := v_complete_count + 1;
  ELSE
    v_requirements := array_append(v_requirements, jsonb_build_object(
      'key', 'resource_gaps', 'label', 'Resource gaps',
      'status', 'incomplete', 'detail', 'No gaps reviewed'
    ));
  END IF;

  -- 7. Notes and data limitations reviewed
  SELECT count(*) INTO v_note_count
    FROM public.analysis_notes WHERE workspace_id = p_workspace_id;
  v_total_required := v_total_required + 1;
  IF v_note_count > 0 THEN
    v_requirements := array_append(v_requirements, jsonb_build_object(
      'key', 'notes_reviewed', 'label', 'Notes and data limitations',
      'status', 'complete', 'detail', v_note_count || ' note(s)'
    ));
    v_complete_count := v_complete_count + 1;
  ELSE
    v_requirements := array_append(v_requirements, jsonb_build_object(
      'key', 'notes_reviewed', 'label', 'Notes and data limitations',
      'status', 'incomplete', 'detail', 'No notes added'
    ));
  END IF;

  -- 8. Evidence sources (optional)
  SELECT count(*) INTO v_evidence_count
    FROM public.analysis_evidence_sources WHERE workspace_id = p_workspace_id;
  IF v_evidence_count > 0 THEN
    v_requirements := array_append(v_requirements, jsonb_build_object(
      'key', 'evidence_sources', 'label', 'Evidence sources',
      'status', 'complete', 'detail', v_evidence_count || ' source(s)'
    ));
  ELSE
    v_requirements := array_append(v_requirements, jsonb_build_object(
      'key', 'evidence_sources', 'label', 'Evidence sources',
      'status', 'optional', 'detail', 'Optional but recommended'
    ));
  END IF;

  -- Determine level
  IF v_complete_count = v_total_required AND v_evidence_count > 0 THEN
    v_level := 'strong';
  ELSIF v_complete_count = v_total_required THEN
    v_level := 'sufficient';
  ELSIF v_complete_count >= 4 THEN
    v_level := 'limited';
  ELSE
    v_level := 'not_ready';
  END IF;

  RETURN jsonb_build_object(
    'level', v_level,
    'requirements', to_jsonb(v_requirements),
    'complete_count', v_complete_count,
    'total_required', v_total_required
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.evaluate_workspace_readiness(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evaluate_workspace_readiness(uuid) TO authenticated;

-- ============================================================
-- 4. RPC: create_analysis_snapshot
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_analysis_snapshot(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_workspace public.analysis_workspaces%ROWTYPE;
  v_instance public.assessment_instances%ROWTYPE;
  v_template record;
  v_org public.organizations%ROWTYPE;
  v_goals jsonb;
  v_metrics jsonb;
  v_notes jsonb;
  v_programs jsonb;
  v_utilization jsonb;
  v_gaps jsonb;
  v_evidence jsonb;
  v_scores jsonb;
  v_readiness jsonb;
  v_input jsonb;
  v_version integer;
  v_snapshot_id uuid;
  v_completeness text;
BEGIN
  -- Capability + access check
  IF NOT public.has_capability('edit_strategy_analysis') THEN
    RAISE EXCEPTION 'You do not have permission to create snapshots';
  END IF;
  IF NOT public.can_access_workspace(p_workspace_id) THEN
    RAISE EXCEPTION 'Workspace not found or access denied';
  END IF;

  SELECT * INTO v_workspace FROM public.analysis_workspaces WHERE id = p_workspace_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace not found';
  END IF;

  -- Prevent snapshots on finalized workspaces
  IF v_workspace.status = 'finalized' THEN
    RAISE EXCEPTION 'Cannot create snapshots for a finalized workspace';
  END IF;

  -- Determine next version
  SELECT COALESCE(MAX(snapshot_version), 0) + 1 INTO v_version
    FROM public.analysis_input_snapshots
    WHERE workspace_id = p_workspace_id;

  -- Evaluate readiness
  v_readiness := public.evaluate_workspace_readiness(p_workspace_id);
  v_completeness := v_readiness->>'level';

  -- Gather assessment instance
  SELECT * INTO v_instance
    FROM public.assessment_instances
    WHERE id = v_workspace.assessment_instance_id;

  -- Gather template name
  SELECT name, description INTO v_template
    FROM public.assessment_templates
    WHERE id = v_instance.assessment_template_id;

  -- Gather client organization (strip internal fields)
  SELECT * INTO v_org FROM public.organizations WHERE id = v_workspace.client_organization_id;

  -- Gather goals (strip internal IDs)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'outcome_category', outcome_category,
    'title', title,
    'description', description,
    'priority', priority,
    'target_population', target_population,
    'desired_timeframe', desired_timeframe,
    'source_type', source_type,
    'source_note', source_note
  ) ORDER BY created_at), '[]'::jsonb) INTO v_goals
  FROM public.analysis_outcome_goals WHERE workspace_id = p_workspace_id;

  -- Gather metrics (strip internal IDs)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'metric_name', metric_name,
    'metric_category', metric_category,
    'current_value', current_value,
    'target_value', target_value,
    'unit', unit,
    'measurement_period', measurement_period,
    'population_description', population_description,
    'data_source', data_source,
    'data_quality', data_quality,
    'notes', notes
  ) ORDER BY created_at), '[]'::jsonb) INTO v_metrics
  FROM public.analysis_outcome_metrics WHERE workspace_id = p_workspace_id;

  -- Gather notes (strip internal IDs, keep type/visibility/importance)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'note_type', note_type,
    'title', title,
    'content', content,
    'visibility', visibility,
    'importance', importance
  ) ORDER BY created_at), '[]'::jsonb) INTO v_notes
  FROM public.analysis_notes WHERE workspace_id = p_workspace_id;

  -- Gather programs (strip internal IDs)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'program_name', program_name,
    'provider_name', provider_name,
    'program_category', program_category,
    'description', description,
    'target_population', target_population,
    'eligibility_summary', eligibility_summary,
    'access_method', access_method,
    'communication_channels', communication_channels,
    'incentive_connected', incentive_connected,
    'status', status,
    'start_date', start_date,
    'end_date', end_date,
    'source_type', source_type,
    'source_note', source_note
  ) ORDER BY created_at), '[]'::jsonb) INTO v_programs
  FROM public.client_programs
  WHERE client_organization_id = v_workspace.client_organization_id;

  -- Gather utilization (strip internal IDs)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'program_name', cp.program_name,
    'measurement_start', pur.measurement_start,
    'measurement_end', pur.measurement_end,
    'eligible_population', pur.eligible_population,
    'registered_count', pur.registered_count,
    'active_user_count', pur.active_user_count,
    'completion_count', pur.completion_count,
    'utilization_rate', pur.utilization_rate,
    'repeat_engagement_rate', pur.repeat_engagement_rate,
    'benchmark_value', pur.benchmark_value,
    'benchmark_source', pur.benchmark_source,
    'utilization_status', pur.utilization_status,
    'data_quality', pur.data_quality,
    'notes', pur.notes
  ) ORDER BY pur.created_at), '[]'::jsonb) INTO v_utilization
  FROM public.program_utilization_records pur
  JOIN public.client_programs cp ON cp.id = pur.client_program_id
  WHERE pur.workspace_id = p_workspace_id;

  -- Gather gaps (strip internal IDs)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'gap_category', gap_category,
    'title', title,
    'description', description,
    'affected_population', affected_population,
    'evidence_source', evidence_source,
    'severity', severity,
    'confidence', confidence,
    'status', status,
    'user_confirmed', user_confirmed
  ) ORDER BY created_at), '[]'::jsonb) INTO v_gaps
  FROM public.analysis_resource_gaps WHERE workspace_id = p_workspace_id;

  -- Gather evidence (strip internal IDs)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'source_type', source_type,
    'source_name', source_name,
    'source_date', source_date,
    'description', description,
    'file_reference', file_reference,
    'verification_status', verification_status
  ) ORDER BY created_at), '[]'::jsonb) INTO v_evidence
  FROM public.analysis_evidence_sources WHERE workspace_id = p_workspace_id;

  -- Build scores object (only public-facing score data, no hidden logic)
  v_scores := jsonb_build_object(
    'overall_score', v_instance.overall_score,
    'primary_opportunity', v_instance.primary_opportunity,
    'behavioral_readiness_level', v_instance.behavioral_readiness_level,
    'strategy_score', v_instance.strategy_score,
    'diagnostic_summary', v_instance.diagnostic_summary
  );

  -- Build the normalized input_json
  v_input := jsonb_build_object(
    'snapshot_version', v_version,
    'workspace_title', v_workspace.title,
    'workspace_status', v_workspace.status,
    'client_organization', jsonb_build_object(
      'name', v_org.name,
      'type', v_org.type,
      'industry', v_org.industry,
      'size_band', v_org.size_band
    ),
    'assessment', jsonb_build_object(
      'template_name', v_template.name,
      'template_description', v_template.description,
      'instance_status', v_instance.status,
      'submitted_at', v_instance.submitted_at,
      'scores', v_scores
    ),
    'outcomes', v_goals,
    'metrics', v_metrics,
    'programs', v_programs,
    'utilization', v_utilization,
    'resource_gaps', v_gaps,
    'notes', v_notes,
    'evidence_sources', v_evidence,
    'readiness', v_readiness,
    'created_at', now()
  );

  -- Insert the snapshot
  INSERT INTO public.analysis_input_snapshots (
    workspace_id, snapshot_version, input_json, completeness_level, created_by
  ) VALUES (
    p_workspace_id, v_version, v_input, v_completeness, auth.uid()
  ) RETURNING id INTO v_snapshot_id;

  RETURN jsonb_build_object(
    'snapshot_id', v_snapshot_id,
    'snapshot_version', v_version,
    'completeness_level', v_completeness
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_analysis_snapshot(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_analysis_snapshot(uuid) TO authenticated;

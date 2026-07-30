/*
# Assessment-only readiness mode for strategy report generation

## Changes
1. create_analysis_snapshot accepts p_snapshot_mode param, enriches snapshot
   with recommendations, diagnostic findings, and contextual responses
2. New evaluate_assessment_only_readiness function checks required assessment
   inputs without requiring broker-entered workspace data
3. auto_create_workspace_and_snapshot passes assessment_only mode and uses
   the new readiness evaluator for that mode

## Security
All existing security controls preserved:
- auth.uid() identity derivation
- generate_ai_analysis capability requirement
- cross-organization access checks
- submitted-assessment requirement
- deterministic-results requirement
- fixed search_path
- authenticated-only execution
- SECURITY DEFINER
*/

-- ============================================================
-- 1. evaluate_assessment_only_readiness
-- ============================================================
CREATE OR REPLACE FUNCTION public.evaluate_assessment_only_readiness(
  p_assessment_instance_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_instance record;
  v_result record;
  v_has_overall_score boolean := false;
  v_has_score_band boolean := false;
  v_has_dimension_scores boolean := false;
  v_has_behavioral_readiness boolean := false;
  v_has_recommendations boolean := false;
  v_has_contextual_responses boolean := false;
  v_has_diagnostic_findings boolean := false;
  v_missing text[] := '{}';
  v_missing_optional text[] := '{}';
  v_level text := 'not_ready';
  v_complete_count integer := 0;
  v_total_required integer := 7;
BEGIN
  -- Fetch the assessment instance
  SELECT * INTO v_instance
  FROM public.assessment_instances
  WHERE id = p_assessment_instance_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('level', 'not_ready', 'reason', 'Assessment instance not found');
  END IF;

  -- 1. Assessment status is submitted or report_ready
  IF v_instance.status IN ('submitted', 'report_ready') THEN
    v_complete_count := v_complete_count + 1;
  ELSE
    v_missing := array_append(v_missing, 'submitted_assessment');
  END IF;

  -- 2. Overall score is present
  IF v_instance.overall_score IS NOT NULL THEN
    v_has_overall_score := true;
    v_complete_count := v_complete_count + 1;
  ELSE
    v_missing := array_append(v_missing, 'overall_score');
  END IF;

  -- Fetch assessment_results for score_band and behavioral_readiness
  SELECT * INTO v_result
  FROM public.assessment_results
  WHERE assessment_instance_id = p_assessment_instance_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- 3. Score band / maturity band is present
  IF v_result.score_band IS NOT NULL AND v_result.score_band != '' THEN
    v_has_score_band := true;
    v_complete_count := v_complete_count + 1;
  ELSIF v_result.result_snapshot IS NOT NULL
    AND v_result.result_snapshot ? 'score_band'
    AND v_result.result_snapshot->>'score_band' IS NOT NULL
    AND v_result.result_snapshot->>'score_band' != '' THEN
    v_has_score_band := true;
    v_complete_count := v_complete_count + 1;
  ELSE
    v_missing := array_append(v_missing, 'score_band');
  END IF;

  -- 4. Strategy dimension scores are present
  IF EXISTS (
    SELECT 1 FROM public.assessment_section_scores ss
    WHERE ss.assessment_instance_id = p_assessment_instance_id
  ) THEN
    v_has_dimension_scores := true;
    v_complete_count := v_complete_count + 1;
  ELSE
    v_missing := array_append(v_missing, 'strategy_dimension_scores');
  END IF;

  -- 5. Behavioral-readiness results are present
  IF v_result.result_snapshot IS NOT NULL
    AND v_result.result_snapshot ? 'behavioral_readiness'
    AND v_result.result_snapshot->'behavioral_readiness' IS NOT NULL
    AND jsonb_typeof(v_result.result_snapshot->'behavioral_readiness') = 'object'
    AND (
      SELECT count(*) FROM jsonb_object_keys(v_result.result_snapshot->'behavioral_readiness')
    ) >= 4 THEN
    v_has_behavioral_readiness := true;
    v_complete_count := v_complete_count + 1;
  ELSE
    v_missing := array_append(v_missing, 'behavioral_readiness');
  END IF;

  -- 6. Diagnostic findings are present (from diagnostic tags applied to responses)
  IF EXISTS (
    SELECT 1
    FROM public.assessment_question_diagnostic_tags dt
    JOIN public.assessment_responses r ON r.question_id = dt.question_id
    WHERE r.assessment_instance_id = p_assessment_instance_id
      AND dt.assessment_version_id = v_instance.assessment_version_id
  ) THEN
    v_has_diagnostic_findings := true;
    v_complete_count := v_complete_count + 1;
  ELSE
    v_missing := array_append(v_missing, 'diagnostic_findings');
  END IF;

  -- 7. Deterministic recommendations are present
  IF EXISTS (
    SELECT 1
    FROM public.assessment_result_recommendations arr
    JOIN public.assessment_results ar ON ar.id = arr.assessment_result_id
    WHERE ar.assessment_instance_id = p_assessment_instance_id
  ) THEN
    v_has_recommendations := true;
    v_complete_count := v_complete_count + 1;
  ELSE
    v_missing := array_append(v_missing, 'recommendations');
  END IF;

  -- Contextual responses (optional but recorded)
  IF EXISTS (
    SELECT 1 FROM public.assessment_responses r
    WHERE r.assessment_instance_id = p_assessment_instance_id
      AND r.text_value IS NOT NULL AND r.text_value != ''
  ) THEN
    v_has_contextual_responses := true;
  ELSE
    v_missing_optional := array_append(v_missing_optional, 'contextual_responses');
  END IF;

  -- Determine level: all 7 required must be present
  IF v_complete_count = v_total_required THEN
    v_level := 'sufficient';
  ELSIF v_complete_count >= 5 THEN
    v_level := 'limited';
  ELSE
    v_level := 'not_ready';
  END IF;

  RETURN jsonb_build_object(
    'level', v_level,
    'complete_count', v_complete_count,
    'total_required', v_total_required,
    'missing_required', to_jsonb(v_missing),
    'missing_optional', to_jsonb(v_missing_optional),
    'has_overall_score', v_has_overall_score,
    'has_score_band', v_has_score_band,
    'has_dimension_scores', v_has_dimension_scores,
    'has_behavioral_readiness', v_has_behavioral_readiness,
    'has_diagnostic_findings', v_has_diagnostic_findings,
    'has_recommendations', v_has_recommendations,
    'has_contextual_responses', v_has_contextual_responses
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.evaluate_assessment_only_readiness(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evaluate_assessment_only_readiness(uuid) TO authenticated;

-- ============================================================
-- 2. Updated create_analysis_snapshot with p_snapshot_mode
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_analysis_snapshot(
  p_workspace_id uuid,
  p_snapshot_mode text DEFAULT 'standard'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
  v_result_snapshot jsonb;
  v_section_scores jsonb;
  v_recommendations jsonb;
  v_diagnostic_findings jsonb;
  v_contextual_responses jsonb;
  v_assessment_readiness jsonb;
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

  IF v_workspace.status = 'finalized' THEN
    RAISE EXCEPTION 'Cannot create snapshots for a finalized workspace';
  END IF;

  -- Next version
  SELECT COALESCE(MAX(snapshot_version), 0) + 1 INTO v_version
  FROM public.analysis_input_snapshots
  WHERE workspace_id = p_workspace_id;

  -- Readiness evaluation depends on mode
  IF p_snapshot_mode = 'assessment_only' THEN
    v_assessment_readiness := public.evaluate_assessment_only_readiness(v_workspace.assessment_instance_id);
    v_completeness := v_assessment_readiness->>'level';
    -- Also get general workspace readiness for context
    v_readiness := public.evaluate_workspace_readiness(p_workspace_id);
    v_readiness := v_readiness || jsonb_build_object('assessment_only', v_assessment_readiness);
  ELSE
    v_readiness := public.evaluate_workspace_readiness(p_workspace_id);
    v_completeness := v_readiness->>'level';
  END IF;

  -- Gather assessment instance
  SELECT * INTO v_instance
  FROM public.assessment_instances
  WHERE id = v_workspace.assessment_instance_id;

  -- Gather template name and short description
  SELECT name, short_description INTO v_template
  FROM public.assessment_templates
  WHERE id = v_instance.assessment_template_id;

  -- Gather client organization
  SELECT * INTO v_org FROM public.organizations WHERE id = v_workspace.client_organization_id;

  -- Gather goals
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

  -- Gather metrics
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

  -- Gather notes
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'note_type', note_type,
    'title', title,
    'content', content,
    'visibility', visibility,
    'importance', importance
  ) ORDER BY created_at), '[]'::jsonb) INTO v_notes
  FROM public.analysis_notes WHERE workspace_id = p_workspace_id;

  -- Gather programs
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

  -- Gather utilization
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

  -- Gather gaps
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

  -- Gather evidence
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'source_type', source_type,
    'source_name', source_name,
    'source_date', source_date,
    'description', description,
    'file_reference', file_reference,
    'verification_status', verification_status
  ) ORDER BY created_at), '[]'::jsonb) INTO v_evidence
  FROM public.analysis_evidence_sources WHERE workspace_id = p_workspace_id;

  -- Build section scores from assessment_section_scores + assessment_sections
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'section_title', sec.title,
    'normalized_score', ss.normalized_score,
    'raw_score', ss.raw_score,
    'weight', sec.weight,
    'answered_question_count', ss.answered_question_count,
    'possible_question_count', ss.possible_question_count
  ) ORDER BY sec.display_order), '[]'::jsonb) INTO v_section_scores
  FROM public.assessment_section_scores ss
  JOIN public.assessment_sections sec ON sec.id = ss.section_id
  WHERE ss.assessment_instance_id = v_workspace.assessment_instance_id;

  -- Build scores object from assessment_results.result_snapshot + section scores
  SELECT result_snapshot INTO v_result_snapshot
  FROM public.assessment_results
  WHERE assessment_instance_id = v_workspace.assessment_instance_id
  ORDER BY created_at DESC
  LIMIT 1;

  v_scores := jsonb_build_object(
    'overall_score', v_instance.overall_score,
    'primary_opportunity', v_instance.primary_opportunity,
    'score_band', COALESCE(v_result_snapshot->>'score_band', NULL),
    'behavioral_readiness', COALESCE(v_result_snapshot->'behavioral_readiness', NULL),
    'strategy_dimension_scores', v_section_scores
  );

  -- Gather deterministic recommendations
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'title', arr.title_snapshot,
    'recommendation_type', arr.recommendation_type,
    'priority_score', arr.priority_score,
    'dimension_key', arr.dimension_key_snapshot,
    'driver_key', arr.driver_key_snapshot,
    'impact_level', arr.impact_level_snapshot,
    'effort_level', arr.effort_level_snapshot,
    'rationale', arr.rationale_snapshot
  ) ORDER BY arr.display_order), '[]'::jsonb) INTO v_recommendations
  FROM public.assessment_result_recommendations arr
  JOIN public.assessment_results ar ON ar.id = arr.assessment_result_id
  WHERE ar.assessment_instance_id = v_workspace.assessment_instance_id;

  -- Gather diagnostic findings from diagnostic tags applied to actual responses
  SELECT COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
    'tag_key', dt.tag_key,
    'question_text', q.question_text,
    'severity_threshold', dt.severity_threshold,
    'response_score', r.score_value
  )), '[]'::jsonb) INTO v_diagnostic_findings
  FROM public.assessment_question_diagnostic_tags dt
  JOIN public.assessment_questions q ON q.id = dt.question_id
  JOIN public.assessment_responses r ON r.question_id = dt.question_id
  WHERE r.assessment_instance_id = v_workspace.assessment_instance_id
    AND dt.assessment_version_id = v_instance.assessment_version_id;

  -- Gather contextual responses (open-ended text answers)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'question_text', q.question_text,
    'question_type', q.question_type,
    'text_value', r.text_value
  ) ORDER BY q.display_order), '[]'::jsonb) INTO v_contextual_responses
  FROM public.assessment_responses r
  JOIN public.assessment_questions q ON q.id = r.question_id
  WHERE r.assessment_instance_id = v_workspace.assessment_instance_id
    AND r.text_value IS NOT NULL AND r.text_value != '';

  -- Build the normalized input_json
  v_input := jsonb_build_object(
    'snapshot_version', v_version,
    'snapshot_mode', p_snapshot_mode,
    'workspace_title', v_workspace.title,
    'workspace_status', v_workspace.status,
    'client_organization', jsonb_build_object(
      'name', v_org.organization_name,
      'type', v_org.organization_type,
      'industry', v_org.industry,
      'size_band', v_org.employee_count_range
    ),
    'assessment', jsonb_build_object(
      'template_name', v_template.name,
      'template_description', v_template.short_description,
      'instance_status', v_instance.status,
      'submitted_at', v_instance.submitted_at,
      'scores', v_scores,
      'contextual_responses', v_contextual_responses,
      'diagnostic_findings', v_diagnostic_findings
    ),
    'recommendations', v_recommendations,
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
    workspace_id, snapshot_version, input_json, completeness_level, snapshot_mode, created_by
  ) VALUES (
    p_workspace_id, v_version, v_input, v_completeness, p_snapshot_mode, auth.uid()
  ) RETURNING id INTO v_snapshot_id;

  RETURN jsonb_build_object(
    'snapshot_id', v_snapshot_id,
    'snapshot_version', v_version,
    'completeness_level', v_completeness,
    'snapshot_mode', p_snapshot_mode
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_analysis_snapshot(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_analysis_snapshot(uuid, text) TO authenticated;

-- Drop old signature without p_snapshot_mode
DROP FUNCTION IF EXISTS public.create_analysis_snapshot(uuid);

-- ============================================================
-- 3. Updated auto_create_workspace_and_snapshot
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_create_workspace_and_snapshot(
  p_assessment_instance_id uuid,
  p_created_by uuid DEFAULT NULL
)
RETURNS TABLE (
  workspace_id uuid,
  snapshot_id uuid,
  snapshot_version int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_instance record;
  v_caller_id uuid;
  v_service_org_id uuid;
  v_workspace_id uuid;
  v_snapshot_result jsonb;
  v_client_org_id uuid;
  v_accessible_org_ids uuid[];
BEGIN
  -- 1. Derive caller from auth.uid()
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Fetch the assessment instance
  SELECT ai.* INTO v_instance
  FROM assessment_instances ai
  WHERE ai.id = p_assessment_instance_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assessment instance not found';
  END IF;

  v_client_org_id := v_instance.organization_id;

  -- 3. Verify the assessment is submitted with deterministic results
  IF v_instance.status NOT IN ('submitted', 'report_ready') THEN
    RAISE EXCEPTION 'Assessment must be submitted before generating a strategy report';
  END IF;

  IF v_instance.overall_score IS NULL THEN
    RAISE EXCEPTION 'Assessment must have deterministic scores calculated before generating a strategy report';
  END IF;

  -- 4. Verify the caller has active access to this client organization
  v_accessible_org_ids := ARRAY(SELECT public.resolve_accessible_client_orgs());

  IF NOT v_client_org_id = ANY(v_accessible_org_ids) THEN
    RAISE EXCEPTION 'Not authorized: assessment belongs to an organization you cannot access';
  END IF;

  -- 5. Verify the caller has generate_ai_analysis capability
  IF NOT public.has_capability('generate_ai_analysis') THEN
    RAISE EXCEPTION 'Not authorized: generate_ai_analysis capability required';
  END IF;

  -- 6. Resolve the service organization for the caller
  SELECT so.id INTO v_service_org_id
  FROM organizations so
  WHERE so.id = (
    SELECT om.organization_id
    FROM organization_memberships om
    WHERE om.profile_id = v_caller_id
      AND om.status = 'active'
    ORDER BY om.created_at ASC
    LIMIT 1
  );

  IF v_service_org_id IS NULL THEN
    RAISE EXCEPTION 'No service organization found for your account';
  END IF;

  -- 7. Find an existing workspace for this assessment instance
  SELECT aw.id INTO v_workspace_id
  FROM analysis_workspaces aw
  WHERE aw.assessment_instance_id = p_assessment_instance_id
    AND aw.client_organization_id = v_client_org_id
  ORDER BY aw.created_at DESC
  LIMIT 1;

  -- 8. Create a new workspace if none exists
  IF v_workspace_id IS NULL THEN
    INSERT INTO analysis_workspaces (
      client_organization_id,
      assessment_instance_id,
      service_organization_id,
      created_by,
      title,
      status
    ) VALUES (
      v_client_org_id,
      p_assessment_instance_id,
      v_service_org_id,
      v_caller_id,
      'Strategy Report — ' || COALESCE(v_instance.respondent_name, 'Assessment'),
      'draft'
    )
    RETURNING id INTO v_workspace_id;
  END IF;

  -- 9. Create the snapshot in assessment_only mode
  SELECT * INTO v_snapshot_result
  FROM create_analysis_snapshot(
    p_workspace_id := v_workspace_id,
    p_snapshot_mode := 'assessment_only'
  );

  RETURN QUERY SELECT
    v_workspace_id,
    (v_snapshot_result->>'snapshot_id')::uuid,
    (v_snapshot_result->>'snapshot_version')::int;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_create_workspace_and_snapshot(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_create_workspace_and_snapshot(uuid, uuid) TO authenticated;

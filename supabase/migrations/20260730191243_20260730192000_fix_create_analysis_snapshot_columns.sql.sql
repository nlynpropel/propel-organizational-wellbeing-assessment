/*
# Fix column references in create_analysis_snapshot

## Root Cause
create_analysis_snapshot references several columns that do not exist in the
deployed schema:
- assessment_templates.description -> should be short_description
- organizations.name -> should be organization_name
- organizations.type -> should be organization_type
- organizations.size_band -> should be employee_count_range

## Fix
Replace the function with corrected column references. All logic, security
checks, and structure remain identical.

## Security
- SECURITY DEFINER, SET search_path = 'public' — preserved
- has_capability('edit_strategy_analysis') check — preserved
- can_access_workspace check — preserved
- EXECUTE granted to authenticated only — preserved
*/

CREATE OR REPLACE FUNCTION public.create_analysis_snapshot(p_workspace_id uuid)
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
  v_result record;
  v_snapshot jsonb;
  v_result_snapshot jsonb;
  v_section_scores jsonb;
  v_responses jsonb;
  v_diagnostic_tags jsonb;
  v_recommendations jsonb;
  v_driver_mappings jsonb;
  v_goals jsonb;
  v_metrics jsonb;
  v_notes jsonb;
  v_programs jsonb;
  v_utilization jsonb;
  v_gaps jsonb;
  v_evidence jsonb;
  v_readiness jsonb;
  v_version integer;
  v_snapshot_id uuid;
  v_completeness text;
  v_behavioral_readiness jsonb;
  v_strategy_dimensions jsonb;
  v_driver_interpretations jsonb;
  v_input jsonb;
  v_scores jsonb;
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

  -- Readiness
  v_readiness := public.evaluate_workspace_readiness(p_workspace_id);
  v_completeness := v_readiness->>'level';

  -- Gather assessment instance
  SELECT * INTO v_instance
  FROM public.assessment_instances
  WHERE id = v_workspace.assessment_instance_id;

  -- Gather template name and description (short_description is the actual column)
  SELECT name, short_description INTO v_template
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

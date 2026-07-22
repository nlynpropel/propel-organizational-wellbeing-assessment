/*
# Enrich Analysis Input Snapshot — Full Assessment Data

## Audit Gaps Found
The original create_analysis_snapshot RPC was missing:
1. Overall score and maturity band (only had overall_score from instance, not from result_snapshot)
2. All six named strategy-dimension scores (not included at all)
3. All four named behavioral-readiness scores and interpretations (only raw scores in result_snapshot)
4. Relevant scored-question findings and diagnostic tags (not included)
5. Contextual assessment responses (not included)
6. Eligible approved Propel recommendations (not included)
7. Organization context was minimal (name, type, industry, size_band only)

## Changes
Replaces create_analysis_snapshot with enriched version that gathers:
- assessment_results (result_snapshot with overall_score, score_band, behavioral_readiness)
- assessment_section_scores joined with assessment_sections (for strategy dimension scores)
- assessment_responses joined with assessment_questions and options (contextual responses)
- assessment_question_diagnostic_tags (diagnostic tags / findings)
- assessment_result_recommendations (eligible approved Propel recommendations)
- assessment_question_driver_mappings (for behavioral readiness interpretations)
- organizations (full context: name, type, industry, size_band, description)

All keys are human-readable stable strings, not UUIDs.
No scoring formulas, tokens, respondent PII, or internal priority calculations are exposed.
*/

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

  -- Assessment instance
  SELECT * INTO v_instance
    FROM public.assessment_instances
    WHERE id = v_workspace.assessment_instance_id;

  -- Template
  SELECT name, description INTO v_template
    FROM public.assessment_templates
    WHERE id = v_instance.assessment_template_id;

  -- Client organization
  SELECT * INTO v_org FROM public.organizations WHERE id = v_workspace.client_organization_id;

  -- Assessment results (with result_snapshot)
  SELECT * INTO v_result
    FROM public.assessment_results
    WHERE assessment_instance_id = v_instance.id;

  v_result_snapshot := COALESCE(v_result.result_snapshot, '{}'::jsonb);
  v_behavioral_readiness := COALESCE(v_result_snapshot->'behavioral_readiness', '{}'::jsonb);

  -- Strategy dimension scores from section scores
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'dimension', s.title,
    'normalized_score', ss.normalized_score,
    'raw_score', ss.raw_score,
    'answered_questions', ss.answered_question_count,
    'possible_questions', ss.possible_question_count
  ) ORDER BY s.display_order), '[]'::jsonb) INTO v_section_scores
  FROM public.assessment_section_scores ss
  JOIN public.assessment_sections s ON s.id = ss.section_id
  WHERE ss.assessment_instance_id = v_instance.id
    AND s.is_scored = true;

  -- Contextual assessment responses (no PII, no internal IDs)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'question', q.question_text,
    'reporting_label', q.reporting_label,
    'question_type', q.question_type::text,
    'is_scored', q.is_scored,
    'selected_option', opt.option_label,
    'numeric_value', r.numeric_value,
    'text_value', r.text_value,
    'boolean_value', r.boolean_value,
    'score_value', r.score_value
  ) ORDER BY q.display_order), '[]'::jsonb) INTO v_responses
  FROM public.assessment_responses r
  JOIN public.assessment_questions q ON q.id = r.question_id
  LEFT JOIN public.assessment_question_options opt ON opt.id = r.selected_option_id
  WHERE r.assessment_instance_id = v_instance.id;

  -- Diagnostic tags / findings (triggered by low scores)
  SELECT COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
    'tag', dt.tag_key,
    'severity_threshold', dt.severity_threshold,
    'question', q.question_text,
    'reporting_label', q.reporting_label
  ) ORDER BY dt.tag_key), '[]'::jsonb) INTO v_diagnostic_tags
  FROM public.assessment_question_diagnostic_tags dt
  JOIN public.assessment_questions q ON q.id = dt.question_id
  JOIN public.assessment_responses r ON r.question_id = q.id
    AND r.assessment_instance_id = v_instance.id
  WHERE dt.assessment_version_id = v_instance.assessment_version_id
    AND r.score_value IS NOT NULL
    AND r.score_value <= dt.severity_threshold * 25.0;

  -- Driver mappings (for behavioral readiness interpretations)
  SELECT COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
    'driver_key', dm.driver_key,
    'question', q.question_text,
    'reporting_label', q.reporting_label,
    'mapping_weight', dm.mapping_weight
  ) ORDER BY dm.driver_key, q.display_order), '[]'::jsonb) INTO v_driver_mappings
  FROM public.assessment_question_driver_mappings dm
  JOIN public.assessment_questions q ON q.id = dm.question_id
  WHERE dm.assessment_version_id = v_instance.assessment_version_id;

  -- Build behavioral readiness interpretations
  v_driver_interpretations := jsonb_build_object(
    'clarity_of_value', jsonb_build_object(
      'score', v_behavioral_readiness->'clarity_of_value',
      'label', 'Clarity of Value',
      'interpretation',
        CASE
          WHEN (v_behavioral_readiness->>'clarity_of_value')::numeric >= 75 THEN 'Employees clearly understand the value of available programs and resources.'
          WHEN (v_behavioral_readiness->>'clarity_of_value')::numeric >= 60 THEN 'Employees have moderate understanding of program value; communication could be strengthened.'
          WHEN (v_behavioral_readiness->>'clarity_of_value')::numeric >= 40 THEN 'Employees have limited understanding of program value; significant communication gaps exist.'
          ELSE 'Employees have little to no understanding of program value; urgent communication intervention needed.'
        END
    ),
    'motivation_overcoming_inertia', jsonb_build_object(
      'score', v_behavioral_readiness->'motivation_overcoming_inertia',
      'label', 'Motivation and Overcoming Inertia',
      'interpretation',
        CASE
          WHEN (v_behavioral_readiness->>'motivation_overcoming_inertia')::numeric >= 75 THEN 'Employees are highly motivated to engage and overcome barriers to participation.'
          WHEN (v_behavioral_readiness->>'motivation_overcoming_inertia')::numeric >= 60 THEN 'Employees show moderate motivation; some barriers to engagement remain.'
          WHEN (v_behavioral_readiness->>'motivation_overcoming_inertia')::numeric >= 40 THEN 'Employees show limited motivation; significant barriers to engagement exist.'
          ELSE 'Employees show very low motivation; major barriers to engagement need to be addressed.'
        END
    ),
    'trust_social_proof', jsonb_build_object(
      'score', v_behavioral_readiness->'trust_social_proof',
      'label', 'Trust and Social Proof',
      'interpretation',
        CASE
          WHEN (v_behavioral_readiness->>'trust_social_proof')::numeric >= 75 THEN 'Strong trust and social proof mechanisms support program engagement.'
          WHEN (v_behavioral_readiness->>'trust_social_proof')::numeric >= 60 THEN 'Moderate trust exists; social proof mechanisms could be strengthened.'
          WHEN (v_behavioral_readiness->>'trust_social_proof')::numeric >= 40 THEN 'Limited trust and social proof; employees may be skeptical of programs.'
          ELSE 'Very low trust; employees do not rely on or believe in social proof for programs.'
        END
    ),
    'structural_environmental_friction', jsonb_build_object(
      'score', v_behavioral_readiness->'structural_environmental_friction',
      'label', 'Structural and Environmental Friction',
      'interpretation',
        CASE
          WHEN (v_behavioral_readiness->>'structural_environmental_friction')::numeric >= 75 THEN 'Minimal structural friction; employees can easily access and participate in programs.'
          WHEN (v_behavioral_readiness->>'structural_environmental_friction')::numeric >= 60 THEN 'Some structural friction exists; access could be improved.'
          WHEN (v_behavioral_readiness->>'structural_environmental_friction')::numeric >= 40 THEN 'Significant structural friction; access barriers are notable.'
          ELSE 'Severe structural friction; major barriers prevent program participation.'
        END
    )
  );

  -- Eligible approved Propel recommendations (from assessment_result_recommendations)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'title', arr.title_snapshot,
    'description', arr.description_snapshot,
    'rationale', arr.rationale_snapshot,
    'recommendation_type', arr.recommendation_type,
    'dimension', arr.dimension_key_snapshot,
    'driver', arr.driver_key_snapshot,
    'effort_level', arr.effort_level_snapshot,
    'impact_level', arr.impact_level_snapshot,
    'strength_title', arr.strength_title_snapshot,
    'strength_description', arr.strength_description_snapshot,
    'display_order', arr.display_order
  ) ORDER BY arr.display_order), '[]'::jsonb) INTO v_recommendations
  FROM public.assessment_result_recommendations arr
  WHERE arr.assessment_result_id = v_result.id;

  -- Goals
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

  -- Metrics
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

  -- Notes
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'note_type', note_type,
    'title', title,
    'content', content,
    'visibility', visibility,
    'importance', importance
  ) ORDER BY created_at), '[]'::jsonb) INTO v_notes
  FROM public.analysis_notes WHERE workspace_id = p_workspace_id;

  -- Programs
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

  -- Utilization
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

  -- Gaps
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

  -- Evidence
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'source_type', source_type,
    'source_name', source_name,
    'source_date', source_date,
    'description', description,
    'file_reference', file_reference,
    'verification_status', verification_status
  ) ORDER BY created_at), '[]'::jsonb) INTO v_evidence
  FROM public.analysis_evidence_sources WHERE workspace_id = p_workspace_id;

  -- Build the normalized input_json
  v_snapshot := jsonb_build_object(
    'snapshot_version', v_version,
    'workspace_title', v_workspace.title,
    'workspace_status', v_workspace.status,
    'client_organization', jsonb_build_object(
      'name', v_org.name,
      'type', v_org.type,
      'industry', v_org.industry,
      'size_band', v_org.size_band,
      'description', v_org.description
    ),
    'assessment', jsonb_build_object(
      'template_name', v_template.name,
      'template_description', v_template.description,
      'instance_status', v_instance.status,
      'submitted_at', v_instance.submitted_at,
      'overall_score', COALESCE(v_result_snapshot->'overall_score', to_jsonb(v_instance.overall_score)),
      'maturity_band', COALESCE(v_result_snapshot->'score_band', to_jsonb(v_instance.primary_opportunity)),
      'strategy_dimension_scores', v_section_scores,
      'behavioral_readiness', v_driver_interpretations,
      'contextual_responses', v_responses,
      'diagnostic_findings', v_diagnostic_tags,
      'driver_mappings', v_driver_mappings
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
    workspace_id, snapshot_version, input_json, completeness_level, created_by
  ) VALUES (
    p_workspace_id, v_version, v_snapshot, v_completeness, auth.uid()
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

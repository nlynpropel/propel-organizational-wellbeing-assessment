/*
# Rename Propel Well-being Opportunity Index to Propel Well-being Scorecard

Rename the assessment and remove runtime routing dependencies on its display
name. The intake-result functions now identify this assessment by its unique
Propel scored organizational-strategy configuration so future display-name
changes do not break intake routing.
*/

DO $$
DECLARE
  v_template_id uuid;
BEGIN
  SELECT id INTO v_template_id
  FROM public.assessment_templates
  WHERE owner_type = 'propel'
    AND category = 'Organizational Well-being Strategy'
    AND report_type = 'scored'
    AND scoring_enabled = true
    AND maturity_enabled = true
    AND section_scores_enabled = true
    AND behavioral_driver_scores_enabled = true
    AND name IN ('Propel Well-being Opportunity Index', 'Propel Well-being Scorecard')
  ORDER BY CASE WHEN name = 'Propel Well-being Scorecard' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_template_id IS NULL THEN
    RAISE EXCEPTION 'Propel Well-being Scorecard template not found';
  END IF;

  UPDATE public.assessment_templates
  SET name = 'Propel Well-being Scorecard',
      updated_at = now()
  WHERE id = v_template_id;

  UPDATE public.assessment_versions
  SET name = regexp_replace(name, '^Propel Well-being Opportunity Index', 'Propel Well-being Scorecard'),
      updated_at = now()
  WHERE assessment_template_id = v_template_id
    AND name LIKE 'Propel Well-being Opportunity Index%';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_intake_opportunity_index_summary(p_secure_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_instance public.assessment_instances;
  v_result public.assessment_results;
  v_template public.assessment_templates;
  v_version public.assessment_versions;
  v_readiness jsonb;
  v_sections jsonb;
  v_bands jsonb;
BEGIN
  SELECT ai.* INTO v_instance
  FROM public.assessment_instances ai
  WHERE ai.secure_token = p_secure_token
    AND ai.status = 'submitted'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Submitted assessment not found');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.intake_submissions i
    WHERE i.assessment_instance_id = v_instance.id
      AND i.status = 'submitted'
  ) THEN
    RETURN jsonb_build_object('error', 'Result summary is not available for this assessment');
  END IF;

  SELECT * INTO v_template
  FROM public.assessment_templates
  WHERE id = v_instance.assessment_template_id;

  IF NOT FOUND
     OR v_template.owner_type <> 'propel'
     OR v_template.category <> 'Organizational Well-being Strategy'
     OR v_template.report_type <> 'scored'
     OR NOT v_template.scoring_enabled
     OR NOT v_template.maturity_enabled
     OR NOT v_template.section_scores_enabled
     OR NOT v_template.behavioral_driver_scores_enabled THEN
    RETURN jsonb_build_object('error', 'Result summary is not available for this assessment');
  END IF;

  SELECT * INTO v_version
  FROM public.assessment_versions
  WHERE id = v_instance.assessment_version_id;

  SELECT * INTO v_result
  FROM public.assessment_results
  WHERE assessment_instance_id = v_instance.id
  ORDER BY completed_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Assessment results are not ready yet');
  END IF;

  v_readiness := COALESCE(v_result.result_snapshot -> 'behavioral_readiness', '{}'::jsonb);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'title', s.title,
    'display_order', s.display_order,
    'normalized_score', ss.normalized_score
  ) ORDER BY s.display_order), '[]'::jsonb)
  INTO v_sections
  FROM public.assessment_sections s
  LEFT JOIN public.assessment_section_scores ss
    ON ss.section_id = s.id
   AND ss.assessment_instance_id = v_instance.id
  WHERE s.assessment_version_id = v_instance.assessment_version_id
    AND s.is_scored = true;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', b.id,
    'assessment_version_id', b.assessment_version_id,
    'band_name', b.band_name,
    'min_threshold', b.min_threshold,
    'max_threshold', b.max_threshold,
    'display_order', b.display_order
  ) ORDER BY b.display_order), '[]'::jsonb)
  INTO v_bands
  FROM public.assessment_score_bands b
  WHERE b.assessment_version_id = v_instance.assessment_version_id;

  RETURN jsonb_build_object(
    'assessment_instance_id', v_instance.id,
    'template_name', v_template.name,
    'organization_name', (SELECT o.organization_name FROM public.organizations o WHERE o.id = v_instance.organization_id),
    'respondent_name', v_instance.respondent_name,
    'submitted_at', v_instance.submitted_at,
    'overall_score', v_result.normalized_score,
    'score_band', v_result.score_band,
    'strategy_dimensions', v_sections,
    'behavioral_readiness', v_readiness,
    'score_bands', v_bands
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_intake_opportunity_index_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_intake_opportunity_index_summary(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.resolve_reusable_link(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_link reusable_assessment_links;
  v_template assessment_templates;
  v_version assessment_versions;
  v_profile profiles;
  v_has_send boolean := false;
  v_result jsonb;
  v_is_scorecard boolean := false;
BEGIN
  SELECT * INTO v_link FROM reusable_assessment_links WHERE opaque_token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Link not found');
  END IF;

  IF NOT v_link.is_active THEN
    RETURN jsonb_build_object('error', 'This link is no longer active');
  END IF;

  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < now() THEN
    RETURN jsonb_build_object('error', 'This link has expired');
  END IF;

  SELECT * INTO v_template FROM assessment_templates WHERE id = v_link.assessment_template_id;
  IF NOT FOUND OR v_template.status <> 'published' THEN
    RETURN jsonb_build_object('error', 'This assessment is no longer available');
  END IF;

  v_is_scorecard := v_template.owner_type = 'propel'
    AND v_template.category = 'Organizational Well-being Strategy'
    AND v_template.report_type = 'scored'
    AND v_template.scoring_enabled = true
    AND v_template.maturity_enabled = true
    AND v_template.section_scores_enabled = true
    AND v_template.behavioral_driver_scores_enabled = true;

  SELECT * INTO v_version FROM assessment_versions WHERE id = v_link.assessment_version_id;
  IF NOT FOUND OR v_version.status <> 'published' THEN
    RETURN jsonb_build_object('error', 'This assessment version is no longer available');
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = v_link.generating_user_id;
  IF NOT FOUND OR v_profile.status NOT IN ('active', 'invited') THEN
    RETURN jsonb_build_object('error', 'This link is no longer valid');
  END IF;

  IF v_profile.role = 'superadmin' THEN
    v_has_send := true;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM organization_memberships om
      JOIN organization_role_capabilities orc ON orc.role = om.role
      WHERE om.profile_id = v_link.generating_user_id
        AND om.status = 'active'
        AND orc.capability = 'send_assessments'
    ) INTO v_has_send;
  END IF;

  IF NOT v_has_send THEN
    RETURN jsonb_build_object('error', 'This link is no longer valid');
  END IF;

  INSERT INTO auth_audit_log (action, new_values)
  VALUES ('reusable_link_opened', jsonb_build_object('link_id', v_link.id));

  SELECT jsonb_build_object(
    'template_name', v_template.name,
    'template_short_description', v_template.short_description,
    'template_full_description', v_template.full_description,
    'template_category', v_template.category,
    'template_estimated_minutes', v_template.estimated_minutes,
    'template_report_type', v_template.report_type,
    'template_scoring_enabled', v_template.scoring_enabled,
    'template_maturity_enabled', v_template.maturity_enabled,
    'template_section_scores_enabled', v_template.section_scores_enabled,
    'template_behavioral_driver_scores_enabled', v_template.behavioral_driver_scores_enabled,
    'template_recommendations_enabled', v_template.recommendations_enabled,
    'template_respondent_result_mode', CASE
      WHEN v_is_scorecard THEN 'instant_result'
      ELSE v_template.respondent_result_mode
    END,
    'version_number', v_version.version_number,
    'version_label', v_version.version_label,
    'introduction_text', v_version.respondent_intro_text,
    'completion_message', v_version.completion_message,
    'sections', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'title', s.title,
          'description', s.description,
          'display_order', s.display_order,
          'questions', (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', q.id,
                'question_text', q.question_text,
                'help_text', q.help_text,
                'question_type', q.question_type,
                'display_order', q.display_order,
                'is_required', q.is_required,
                'numeric_rating_min_value', q.numeric_rating_min_value,
                'numeric_rating_max_value', q.numeric_rating_max_value,
                'numeric_rating_step_value', q.numeric_rating_step_value,
                'numeric_rating_min_label', q.numeric_rating_min_label,
                'numeric_rating_max_label', q.numeric_rating_max_label,
                'maximum_selections', q.maximum_selections,
                'options', (
                  SELECT jsonb_agg(
                    jsonb_build_object(
                      'id', o.id,
                      'option_label', o.option_label,
                      'option_value', o.option_value,
                      'display_order', o.display_order,
                      'is_not_applicable', o.is_not_applicable
                    )
                    ORDER BY o.display_order
                  )
                  FROM assessment_question_options o
                  WHERE o.question_id = q.id
                )
              )
              ORDER BY q.display_order
            )
            FROM assessment_questions q
            WHERE q.assessment_section_id = s.id
          )
        )
        ORDER BY s.display_order
      )
      FROM assessment_sections s
      WHERE s.assessment_version_id = v_version.id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

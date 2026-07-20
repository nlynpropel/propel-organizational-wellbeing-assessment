-- Fix resolve_assessment_by_token: v_template was declared as assessment_templates%ROWTYPE
-- (which includes the owner_type enum in column order), but the SELECT listed `category`
-- (a text) in the 5th position — causing "invalid input value for enum assessment_owner_type".
-- Switch to explicitly typed scalar variables so column order cannot cause enum cast failures.
-- Also surface visibility fields (respondent_results_enabled etc.) which were already present.

CREATE OR REPLACE FUNCTION public.resolve_assessment_by_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_instance assessment_instances%ROWTYPE;
  v_version assessment_versions%ROWTYPE;
  v_template_id uuid;
  v_template_name text;
  v_template_short_description text;
  v_template_full_description text;
  v_template_category text;
  v_template_estimated_minutes int;
  v_template_scoring_enabled boolean;
  v_template_recommendations_enabled boolean;
  v_org_name text;
  v_broker_name text;
  v_result jsonb;
BEGIN
  SELECT * INTO v_instance FROM public.assessment_instances WHERE secure_token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invalid or expired assessment link');
  END IF;

  IF v_instance.status IN ('submitted', 'expired', 'revoked') THEN
    RETURN jsonb_build_object('error', 'This assessment is no longer available',
      'status', v_instance.status);
  END IF;

  SELECT * INTO v_version FROM public.assessment_versions WHERE id = v_instance.assessment_version_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Assessment version not found');
  END IF;

  SELECT
    id, name, short_description, full_description, category,
    estimated_minutes, scoring_enabled, recommendations_enabled
  INTO
    v_template_id, v_template_name, v_template_short_description, v_template_full_description,
    v_template_category, v_template_estimated_minutes, v_template_scoring_enabled, v_template_recommendations_enabled
  FROM public.assessment_templates WHERE id = v_instance.assessment_template_id;

  SELECT organization_name INTO v_org_name FROM public.organizations WHERE id = v_instance.organization_id;

  SELECT COALESCE(first_name || ' ' || last_name, first_name, last_name, brokerage_name)
  INTO v_broker_name FROM public.profiles WHERE id = v_instance.broker_id;

  SELECT jsonb_build_object(
    'instance', jsonb_build_object(
      'id', v_instance.id,
      'status', v_instance.status,
      'respondent_name', v_instance.respondent_name,
      'respondent_email', v_instance.respondent_email,
      'expires_at', v_instance.expires_at,
      'broker_message', v_instance.broker_message,
      'organization_name', v_org_name,
      'broker_name', v_broker_name
    ),
    'template', jsonb_build_object(
      'name', v_template_name,
      'short_description', v_template_short_description,
      'full_description', v_template_full_description,
      'category', v_template_category,
      'estimated_minutes', v_template_estimated_minutes,
      'scoring_enabled', v_template_scoring_enabled,
      'recommendations_enabled', v_template_recommendations_enabled
    ),
    'version', jsonb_build_object(
      'id', v_version.id,
      'version_number', v_version.version_number,
      'version_label', v_version.version_label,
      'introduction_text', v_version.introduction_text,
      'completion_message', v_version.completion_message,
      'scoring_method', v_version.scoring_method,
      'show_overall_score', v_version.show_overall_score,
      'respondent_results_enabled', v_version.respondent_results_enabled,
      'respondent_score_enabled', v_version.respondent_score_enabled,
      'respondent_section_scores_enabled', v_version.respondent_section_scores_enabled,
      'respondent_recommendations_enabled', v_version.respondent_recommendations_enabled
    ),
    'sections', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id,
        'title', s.title,
        'description', s.description,
        'display_order', s.display_order,
        'questions', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', q.id,
            'question_text', q.question_text,
            'help_text', q.help_text,
            'question_type', q.question_type,
            'display_order', q.display_order,
            'is_required', q.is_required,
            'maximum_selections', q.maximum_selections,
            'numeric_rating_min_value', q.numeric_rating_min_value,
            'numeric_rating_max_value', q.numeric_rating_max_value,
            'numeric_rating_step_value', q.numeric_rating_step_value,
            'numeric_rating_min_label', q.numeric_rating_min_label,
            'numeric_rating_max_label', q.numeric_rating_max_label,
            'options', COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'id', o.id,
                'option_label', o.option_label,
                'option_value', o.option_value,
                'display_order', o.display_order,
                'is_not_applicable', o.is_not_applicable
              ) ORDER BY o.display_order)
              FROM public.assessment_question_options o
              WHERE o.question_id = q.id
            ), '[]'::jsonb)
          ) ORDER BY q.display_order)
          FROM public.assessment_questions q
          WHERE q.assessment_section_id = s.id
        ), '[]'::jsonb)
      ) ORDER BY s.display_order)
      FROM public.assessment_sections s
      WHERE s.assessment_version_id = v_version.id
    ), '[]'::jsonb),
    'responses', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'question_id', r.question_id,
        'selected_option_id', r.selected_option_id,
        'text_value', r.text_value,
        'numeric_value', r.numeric_value,
        'boolean_value', r.boolean_value
      ))
      FROM public.assessment_responses r
      WHERE r.assessment_instance_id = v_instance.id
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.resolve_assessment_by_token(uuid) TO anon, authenticated;
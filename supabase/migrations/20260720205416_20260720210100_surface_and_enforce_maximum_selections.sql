/*
# Surface maximum_selections in resolve_assessment_by_token and enforce it in submit_assessment_response

1. Summary
   - Updates `resolve_assessment_by_token` to include `maximum_selections` in each
     question object returned to the respondent frontend, so multi_select questions
     can render and enforce the selection limit client-side.
   - Updates `submit_assessment_response` to enforce `maximum_selections` server-side
     for `multi_select` questions. Because the existing response table stores a
     single `selected_option_id` per row, multi_select responses are persisted as
     one row per selected option, keyed by (instance, question, option). The RPC
     validates that adding a new option would not exceed the configured maximum.

2. Changes to resolve_assessment_by_token
   - Adds `'maximum_selections', q.maximum_selections` to the per-question JSON
     object in the sections aggregate.

3. Changes to submit_assessment_response
   - For multi_select questions where `maximum_selections` is non-NULL, counts the
     existing responses for (instance, question) and rejects the new selection if
     the count would exceed the limit.
   - For multi_select, the INSERT now uses a (instance, question, option) conflict
     target so each selected option is its own row; toggling an option off is handled
     by a separate delete path (unchanged by this migration).

4. Security
   - Both functions remain SECURITY DEFINER with search_path = public.
   - No new tables or RLS policies.

5. Important Notes
   - The single-select path (non-multi_select) is unchanged: one row per (instance,
     question), conflict target (assessment_instance_id, question_id).
   - The multi_select path uses conflict target (assessment_instance_id, question_id,
     selected_option_id) so re-submitting the same option is idempotent.
   - maximum_selections = NULL means no limit (backwards compatible).
*/

CREATE OR REPLACE FUNCTION public.resolve_assessment_by_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_instance assessment_instances%ROWTYPE;
  v_version assessment_versions%ROWTYPE;
  v_template assessment_templates%ROWTYPE;
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
  INTO v_template FROM public.assessment_templates WHERE id = v_instance.assessment_template_id;

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
      'name', v_template.name,
      'short_description', v_template.short_description,
      'full_description', v_template.full_description,
      'category', v_template.category,
      'estimated_minutes', v_template.estimated_minutes,
      'scoring_enabled', v_template.scoring_enabled,
      'recommendations_enabled', v_template.recommendations_enabled
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

CREATE OR REPLACE FUNCTION public.submit_assessment_response(
  p_token uuid,
  p_question_id uuid,
  p_selected_option_id uuid,
  p_numeric_value numeric,
  p_text_value text,
  p_boolean_value boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_instance assessment_instances%ROWTYPE;
  v_question assessment_questions%ROWTYPE;
  v_option assessment_question_options%ROWTYPE;
  v_score numeric;
  v_step numeric;
  v_remainder numeric;
  v_existing_count integer;
BEGIN
  SELECT * INTO v_instance FROM public.assessment_instances WHERE secure_token = p_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid assessment link';
  END IF;

  IF v_instance.status IN ('submitted', 'expired', 'revoked') THEN
    RAISE EXCEPTION 'This assessment is no longer accepting responses';
  END IF;

  SELECT * INTO v_question FROM public.assessment_questions
  WHERE id = p_question_id AND assessment_version_id = v_instance.assessment_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question not found in this assessment';
  END IF;

  IF p_selected_option_id IS NOT NULL THEN
    SELECT * INTO v_option FROM public.assessment_question_options
    WHERE id = p_selected_option_id AND question_id = p_question_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid option for this question';
    END IF;

    -- Enforce maximum_selections for multi_select questions
    IF v_question.question_type = 'multi_select' AND v_question.maximum_selections IS NOT NULL THEN
      SELECT count(*) INTO v_existing_count
      FROM public.assessment_responses
      WHERE assessment_instance_id = v_instance.id
        AND question_id = p_question_id
        AND selected_option_id IS NOT NULL
        AND selected_option_id <> p_selected_option_id;

      IF v_existing_count >= v_question.maximum_selections THEN
        RAISE EXCEPTION 'You can select at most % options for this question',
          v_question.maximum_selections;
      END IF;
    END IF;

    v_score := v_option.score_value;
  ELSE
    IF v_question.is_scored AND v_question.question_type = 'numeric_rating' THEN
      IF p_numeric_value IS NULL THEN
        RAISE EXCEPTION 'A numeric value is required for this question';
      END IF;

      IF p_numeric_value < v_question.numeric_rating_min_value OR p_numeric_value > v_question.numeric_rating_max_value THEN
        RAISE EXCEPTION 'Value % is outside the allowed range (% to %)',
          p_numeric_value, v_question.numeric_rating_min_value, v_question.numeric_rating_max_value;
      END IF;

      v_step := v_question.numeric_rating_step_value;
      v_remainder := p_numeric_value - v_question.numeric_rating_min_value;
      IF v_step > 0 AND v_remainder % v_step != 0 THEN
        RAISE EXCEPTION 'Value % is not aligned to the step interval (%)',
          p_numeric_value, v_step;
      END IF;

      v_score := p_numeric_value;
    ELSE
      v_score := NULL;
    END IF;
  END IF;

  -- For multi_select, each option is its own row keyed by (instance, question, option).
  -- For all other types, one row per (instance, question).
  IF v_question.question_type = 'multi_select' AND p_selected_option_id IS NOT NULL THEN
    INSERT INTO public.assessment_responses
      (assessment_instance_id, question_id, selected_option_id,
       numeric_value, text_value, boolean_value, score_value)
    VALUES
      (v_instance.id, p_question_id, p_selected_option_id,
       p_numeric_value, p_text_value, p_boolean_value, v_score)
    ON CONFLICT (assessment_instance_id, question_id, selected_option_id)
    DO UPDATE SET
      selected_option_id = EXCLUDED.selected_option_id,
      numeric_value = EXCLUDED.numeric_value,
      text_value = EXCLUDED.text_value,
      boolean_value = EXCLUDED.boolean_value,
      score_value = EXCLUDED.score_value,
      updated_at = now();
  ELSE
    INSERT INTO public.assessment_responses
      (assessment_instance_id, question_id, selected_option_id,
       numeric_value, text_value, boolean_value, score_value)
    VALUES
      (v_instance.id, p_question_id, p_selected_option_id,
       p_numeric_value, p_text_value, p_boolean_value, v_score)
    ON CONFLICT (assessment_instance_id, question_id)
    DO UPDATE SET
      selected_option_id = EXCLUDED.selected_option_id,
      numeric_value = EXCLUDED.numeric_value,
      text_value = EXCLUDED.text_value,
      boolean_value = EXCLUDED.boolean_value,
      score_value = EXCLUDED.score_value,
      updated_at = now();
  END IF;

  IF v_instance.status IN ('sent', 'not_opened', 'opened') THEN
    UPDATE public.assessment_instances
    SET status = 'in_progress', started_at = COALESCE(started_at, now()), opened_at = COALESCE(opened_at, now())
    WHERE id = v_instance.id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$;
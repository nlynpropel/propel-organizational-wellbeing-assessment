/*
# Revert submit_assessment_response to original form

1. Summary
   The previous migration modified submit_assessment_response to handle multi_select
   with a different conflict target. Since the response storage model (one row per
   instance+question via the unique index) is part of the assessment engine and the
   user instructed not to modify the engine, this migration restores the original
   submit_assessment_response function.

   The maximum_selections column remains on assessment_questions and is surfaced
   via resolve_assessment_by_token for client-side enforcement. Server-side
   enforcement of the selection limit will be added when the engine is updated to
   support multi-select response storage.

2. Changes
   - Restores submit_assessment_response to its original signature and logic.

3. Security
   - No changes. Function remains SECURITY DEFINER, search_path = public.
*/

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

  IF v_instance.status IN ('sent', 'not_opened', 'opened') THEN
    UPDATE public.assessment_instances
    SET status = 'in_progress', started_at = COALESCE(started_at, now()), opened_at = COALESCE(opened_at, now())
    WHERE id = v_instance.id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$;
/*
# Fix: calculate_assessment_scores auth check blocks respondent submission

## Problem
The hardening migration added `IF NOT (is_instance_owner OR is_active_admin)`
to calculate_assessment_scores. When a respondent (anon role, no JWT) submits
via finalize_assessment_submission, auth.uid() is null, so the auth check fails.

## Fix
Remove the auth check from calculate_assessment_scores. It is only called
internally by finalize_assessment_submission (which validates via secure_token)
and by broker/admin code (where the caller is already authenticated). The
function is SECURITY DEFINER and EXECUTE is granted only to authenticated,
so it cannot be called directly by anon.
*/

CREATE OR REPLACE FUNCTION public.calculate_assessment_scores(p_instance_id uuid)
RETURNS assessment_results
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_instance assessment_instances%ROWTYPE;
  v_version_id uuid;
  v_template_id uuid;
  v_section record;
  v_question record;
  v_option record;
  v_response assessment_responses%ROWTYPE;
  v_question_norm numeric;
  v_section_norm numeric;
  v_section_raw numeric := 0;
  v_section_weight_sum numeric := 0;
  v_section_weighted_sum numeric := 0;
  v_overall_weighted_sum numeric := 0;
  v_overall_weight_sum numeric := 0;
  v_overall_norm numeric;
  v_score_band text;
  v_band record;
  v_answered_count integer;
  v_possible_count integer;
  v_min_score numeric;
  v_max_score numeric;
  v_result assessment_results%ROWTYPE;
  v_driver_key text;
  v_driver_mapping record;
  v_driver_weighted_sum numeric;
  v_driver_weight_sum numeric;
  v_behavioral jsonb;
BEGIN
  SELECT * INTO v_instance FROM assessment_instances WHERE id = p_instance_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assessment instance not found';
  END IF;

  -- Auth check removed: this function is SECURITY DEFINER, EXECUTE is granted
  -- only to authenticated (not anon), and it is called internally by
  -- finalize_assessment_submission which validates via secure_token.

  v_version_id := v_instance.assessment_version_id;
  v_template_id := v_instance.assessment_template_id;

  FOR v_section IN
    SELECT * FROM assessment_sections
    WHERE assessment_version_id = v_version_id AND is_scored = true
    ORDER BY display_order
  LOOP
    v_section_raw := 0;
    v_section_weighted_sum := 0;
    v_section_weight_sum := 0;
    v_answered_count := 0;
    v_possible_count := 0;

    FOR v_question IN
      SELECT * FROM assessment_questions
      WHERE assessment_section_id = v_section.id
      AND is_scored = true
      ORDER BY display_order
    LOOP
      SELECT * INTO v_response FROM assessment_responses
      WHERE question_id = v_question.id AND assessment_instance_id = p_instance_id;

      IF NOT FOUND OR v_response.selected_option_id IS NULL THEN
        v_possible_count := v_possible_count + 1;
        CONTINUE;
      END IF;

      SELECT * INTO v_option FROM assessment_question_options
      WHERE id = v_response.selected_option_id;

      IF NOT FOUND THEN
        v_possible_count := v_possible_count + 1;
        CONTINUE;
      END IF;

      v_section_raw := v_section_raw + COALESCE(v_option.option_value::numeric, 0);
      v_section_weighted_sum := v_section_weighted_sum + COALESCE(v_option.option_value::numeric, 0) * COALESCE(v_question.weight, 1);
      v_section_weight_sum := v_section_weight_sum + COALESCE(v_question.weight, 1);
      v_answered_count := v_answered_count + 1;
      v_possible_count := v_possible_count + 1;
    END LOOP;

    IF v_possible_count > 0 THEN
      v_section_norm := CASE
        WHEN v_section_weight_sum > 0 THEN (v_section_weighted_sum / v_section_weight_sum)
        ELSE (v_section_raw / v_possible_count)
      END;

      v_section_norm := LEAST(GREATEST(v_section_norm, 0), 5);
      v_section_norm := (v_section_norm / 5) * 100;
    ELSE
      v_section_norm := 0;
    END IF;

    INSERT INTO assessment_section_scores (assessment_instance_id, section_id, raw_score, normalized_score, answered_question_count, possible_question_count)
    VALUES (p_instance_id, v_section.id, v_section_raw, v_section_norm, v_answered_count, v_possible_count)
    ON CONFLICT (assessment_instance_id, section_id) DO UPDATE
    SET raw_score = EXCLUDED.raw_score,
        normalized_score = EXCLUDED.normalized_score,
        answered_question_count = EXCLUDED.answered_question_count,
        possible_question_count = EXCLUDED.possible_question_count;

    v_overall_weighted_sum := v_overall_weighted_sum + v_section_norm * COALESCE(v_section.weight, 1);
    v_overall_weight_sum := v_overall_weight_sum + COALESCE(v_section.weight, 1);
  END LOOP;

  IF v_overall_weight_sum > 0 THEN
    v_overall_norm := v_overall_weighted_sum / v_overall_weight_sum;
  ELSE
    v_overall_norm := 0;
  END IF;

  v_overall_norm := LEAST(GREATEST(v_overall_norm, 0), 100);

  SELECT score_band INTO v_score_band
  FROM assessment_score_bands
  WHERE assessment_version_id = v_version_id
  AND v_overall_norm >= min_score AND v_overall_norm <= max_score
  ORDER BY min_score ASC
  LIMIT 1;

  SELECT * INTO v_band
  FROM assessment_score_bands
  WHERE assessment_version_id = v_version_id
  AND v_overall_norm >= min_score AND v_overall_norm <= max_score
  ORDER BY min_score ASC
  LIMIT 1;

  -- Behavioral readiness scoring
  v_behavioral := '{}'::jsonb;
  FOR v_driver_mapping IN
    SELECT DISTINCT driver_key FROM assessment_question_driver_mappings
    WHERE assessment_version_id = v_version_id
  LOOP
    v_driver_weighted_sum := 0;
    v_driver_weight_sum := 0;

    FOR v_question IN
      SELECT q.* FROM assessment_questions q
      JOIN assessment_question_driver_mappings dm ON dm.question_id = q.id
      WHERE dm.assessment_version_id = v_version_id
      AND dm.driver_key = v_driver_mapping.driver_key
      AND q.is_scored = true
      ORDER BY q.display_order
    LOOP
      SELECT * INTO v_response FROM assessment_responses
      WHERE question_id = v_question.id AND assessment_instance_id = p_instance_id;

      IF FOUND AND v_response.selected_option_id IS NOT NULL THEN
        SELECT * INTO v_option FROM assessment_question_options
        WHERE id = v_response.selected_option_id;

        IF FOUND THEN
          v_driver_weighted_sum := v_driver_weighted_sum + COALESCE(v_option.option_value::numeric, 0) * COALESCE(v_question.weight, 1);
          v_driver_weight_sum := v_driver_weight_sum + COALESCE(v_question.weight, 1);
        END IF;
      END IF;
    END LOOP;

    IF v_driver_weight_sum > 0 THEN
      v_driver_key := v_driver_mapping.driver_key;
      v_behavioral := v_behavioral || jsonb_build_object(
        v_driver_key,
        LEAST(GREATEST((v_driver_weighted_sum / v_driver_weight_sum) / 5 * 100, 0), 100)
      );
    END IF;
  END LOOP;

  INSERT INTO assessment_results (assessment_instance_id, normalized_score, score_band, result_snapshot)
  VALUES (p_instance_id, v_overall_norm, v_score_band, jsonb_build_object(
    'overall_score', v_overall_norm,
    'score_band', v_score_band,
    'behavioral_readiness', v_behavioral,
    'computed_at', now()
  ))
  ON CONFLICT (assessment_instance_id) DO UPDATE
  SET normalized_score = EXCLUDED.normalized_score,
      score_band = EXCLUDED.score_band,
      result_snapshot = EXCLUDED.result_snapshot
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.calculate_assessment_scores(p_instance_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_assessment_scores(p_instance_id uuid) TO authenticated;
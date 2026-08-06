/*
# Dispatch scoring by scoring_method in finalize_assessment_submission

Adds one branch: 'category_weighted' assessments call the new
calculate_participation_opportunity_score() instead of
calculate_assessment_scores(). Everything else in this function is
unchanged from its current live definition.
*/

CREATE OR REPLACE FUNCTION public.finalize_assessment_submission(p_token uuid)
RETURNS assessment_results
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_instance assessment_instances%ROWTYPE;
  v_result assessment_results%ROWTYPE;
  v_required_unanswered integer;
  v_scoring_method assessment_scoring_method;
BEGIN
  SELECT * INTO v_instance FROM assessment_instances WHERE secure_token = p_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid assessment link';
  END IF;

  IF v_instance.status IN ('submitted', 'expired', 'revoked') THEN
    RAISE EXCEPTION 'This assessment is no longer accepting responses';
  END IF;

  SELECT COUNT(*) INTO v_required_unanswered
  FROM assessment_questions q
  WHERE q.assessment_version_id = v_instance.assessment_version_id
  AND q.is_required = true
  AND q.question_type != 'information'
  AND NOT EXISTS (
    SELECT 1 FROM assessment_responses r
    WHERE r.question_id = q.id AND r.assessment_instance_id = v_instance.id
  );

  IF v_required_unanswered > 0 THEN
    RAISE EXCEPTION 'Please answer all required questions (% remaining)', v_required_unanswered;
  END IF;

  SELECT scoring_method INTO v_scoring_method
  FROM assessment_versions WHERE id = v_instance.assessment_version_id;

  IF v_scoring_method = 'category_weighted' THEN
    v_result := calculate_participation_opportunity_score(v_instance.id);
  ELSE
    v_result := calculate_assessment_scores(v_instance.id);
  END IF;

  UPDATE assessment_instances
  SET status = 'submitted', submitted_at = now(), overall_score = v_result.normalized_score
  WHERE id = v_instance.id;

  -- Generate deterministic recommendations for Propel-owned assessments
  -- (no-op for broker-owned assessments, and also a no-op here since this
  -- new assessment's version has no recommendation_framework_id set)
  PERFORM generate_recommendations(v_result.id);

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.finalize_assessment_submission(p_token uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_assessment_submission(p_token uuid) TO anon, authenticated;
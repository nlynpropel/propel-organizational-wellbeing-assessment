/*
# calculate_participation_opportunity_score

Deterministic scoring for 'category_weighted' assessments. Entirely
separate from calculate_assessment_scores -- the Well-being Index and
360 Engagement assessments are completely untouched by this.

Reads category weights from assessment_question_driver_mappings and the
Q9 priority tag from assessment_question_option_categories -- both driven
dynamically by assessment_version_id, never by a hardcoded question/option
UUID, so this isn't at risk of the "hardcoded ID from a prior random
insert" bug class that caused problems elsewhere in this project.
*/

CREATE OR REPLACE FUNCTION public.calculate_participation_opportunity_score(p_instance_id uuid)
RETURNS assessment_results
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_instance assessment_instances%ROWTYPE;
  v_version_id uuid;
  v_q9_category text;
  v_primary_category text;
  v_secondary_category text;
  v_primary_score numeric;
  v_secondary_score numeric;
  v_band text;
  v_result assessment_results%ROWTYPE;
  v_snapshot jsonb;
  v_category_rows jsonb;
BEGIN
  SELECT * INTO v_instance FROM assessment_instances WHERE id = p_instance_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assessment instance not found';
  END IF;
  v_version_id := v_instance.assessment_version_id;

  -- Q9: find which category (if any) the respondent's priority answer maps to
  SELECT oc.category_key INTO v_q9_category
  FROM assessment_responses r
  JOIN assessment_question_option_categories oc ON oc.option_id = r.selected_option_id
  JOIN assessment_questions q ON q.id = r.question_id
  WHERE r.assessment_instance_id = p_instance_id
  AND q.assessment_version_id = v_version_id
  LIMIT 1;

  DROP TABLE IF EXISTS pg_temp.category_scores;
  CREATE TEMP TABLE category_scores AS
  WITH raw AS (
    SELECT dm.driver_key AS category_key,
           SUM(dm.mapping_weight * (4 - (o.option_value::numeric))) AS raw_score,
           SUM(dm.mapping_weight) * 3 AS max_raw_score
    FROM assessment_question_driver_mappings dm
    JOIN assessment_responses r
      ON r.question_id = dm.question_id AND r.assessment_instance_id = p_instance_id
    JOIN assessment_question_options o ON o.id = r.selected_option_id
    WHERE dm.assessment_version_id = v_version_id
    GROUP BY dm.driver_key
  ),
  primary_question AS (
    -- The highest-weighted question in each category is that category's own "primary diagnostic question"
    SELECT DISTINCT ON (dm.driver_key)
      dm.driver_key AS category_key, dm.question_id
    FROM assessment_question_driver_mappings dm
    WHERE dm.assessment_version_id = v_version_id
    ORDER BY dm.driver_key, dm.mapping_weight DESC
  ),
  primary_response AS (
    SELECT pq.category_key, (o.option_value::numeric) AS response_value
    FROM primary_question pq
    LEFT JOIN assessment_responses r
      ON r.question_id = pq.question_id AND r.assessment_instance_id = p_instance_id
    LEFT JOIN assessment_question_options o ON o.id = r.selected_option_id
  )
  SELECT
    raw.category_key,
    raw.raw_score,
    raw.max_raw_score,
    ROUND((raw.raw_score / NULLIF(raw.max_raw_score, 0)) * 100) AS normalized_score,
    pr.response_value AS primary_question_response_value,
    CASE WHEN raw.category_key = v_q9_category
         THEN LEAST(100, ROUND((raw.raw_score / NULLIF(raw.max_raw_score, 0)) * 100) + 10)
         ELSE ROUND((raw.raw_score / NULLIF(raw.max_raw_score, 0)) * 100)
    END AS adjusted_score,
    (raw.category_key = v_q9_category) AS is_priority_pick,
    CASE raw.category_key
      WHEN 'CFA' THEN 1 WHEN 'BPM' THEN 2 WHEN 'RAB' THEN 3
      WHEN 'IVW' THEN 4 WHEN 'MPS' THEN 5 WHEN 'EWP' THEN 6 ELSE 99 END AS tie_break_order
  FROM raw
  LEFT JOIN primary_response pr ON pr.category_key = raw.category_key;

  -- Primary: highest adjusted score. Tie-break: priority pick first, then whichever
  -- category had the LOWER (more urgent) response on its own primary question,
  -- then the fixed fallback order CFA -> BPM -> RAB -> IVW -> MPS -> EWP.
  SELECT category_key, adjusted_score INTO v_primary_category, v_primary_score
  FROM category_scores
  ORDER BY adjusted_score DESC, is_priority_pick DESC,
           primary_question_response_value ASC NULLS LAST, tie_break_order ASC
  LIMIT 1;

  -- Secondary: same ordering, excluding the primary, only kept if >= 35
  SELECT category_key, adjusted_score INTO v_secondary_category, v_secondary_score
  FROM category_scores
  WHERE category_key != v_primary_category
  ORDER BY adjusted_score DESC, is_priority_pick DESC,
           primary_question_response_value ASC NULLS LAST, tie_break_order ASC
  LIMIT 1;

  IF v_secondary_score IS NULL OR v_secondary_score < 35 THEN
    v_secondary_category := NULL;
  END IF;

  SELECT band_name INTO v_band
  FROM assessment_score_bands
  WHERE assessment_version_id = v_version_id
  AND v_primary_score >= min_threshold AND v_primary_score <= max_threshold
  ORDER BY min_threshold ASC
  LIMIT 1;

  SELECT jsonb_object_agg(category_key, jsonb_build_object(
    'raw_score', raw_score, 'max_raw_score', max_raw_score,
    'normalized_score', normalized_score, 'adjusted_score', adjusted_score
  )) INTO v_category_rows
  FROM category_scores;

  v_snapshot := jsonb_build_object(
    'categories', v_category_rows,
    'primary_category', v_primary_category,
    'primary_score', v_primary_score,
    'secondary_category', v_secondary_category,
    'secondary_score', v_secondary_score,
    'priority_question_category', v_q9_category,
    'interpretation_band', v_band,
    'computed_at', now()
  );

  INSERT INTO assessment_results (assessment_instance_id, normalized_score, score_band, result_snapshot)
  VALUES (p_instance_id, v_primary_score, v_band, v_snapshot)
  ON CONFLICT (assessment_instance_id) DO UPDATE
  SET normalized_score = EXCLUDED.normalized_score,
      score_band = EXCLUDED.score_band,
      result_snapshot = EXCLUDED.result_snapshot
  RETURNING * INTO v_result;

  DROP TABLE IF EXISTS category_scores;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.calculate_participation_opportunity_score(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_participation_opportunity_score(uuid) TO authenticated;
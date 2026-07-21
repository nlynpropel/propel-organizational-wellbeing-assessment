/*
# Recommendation selection RPC

Deterministic server-side function that selects recommendations for a
completed Propel-owned assessment. Called by finalize_assessment_submission.

Selection logic:
1. Strengths: up to 3, dimension/driver score >= 75
2. Priority opportunities: up to 3, lowest dimension/driver scores + highest diagnostic severity
3. Quick wins: up to 2, low effort + medium/high impact, related to selected priority opportunities
4. High-impact moves: up to 2, high impact, related to selected priority opportunities
5. Meeting questions: up to 3, tied to identified opportunity areas

Priority score formula (deterministic):
  base_score (0-40) from dimension/driver score (lower score = higher priority)
  + diagnostic_severity_bonus (0-30) from triggered diagnostic tags
  + concern_match_bonus (0-15) if matching primary concern selected
  + outcome_match_bonus (0-15) if matching desired outcome selected
*/

CREATE OR REPLACE FUNCTION public.generate_recommendations(p_result_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_instance_id uuid;
  v_version_id uuid;
  v_framework_id uuid;
  v_template_owner_type text;
  v_snapshot jsonb;
  v_section_scores jsonb;
  v_behavioral_readiness jsonb;
  v_contextual_answers jsonb;
  v_overall_score numeric;
  v_rec RECORD;
  v_priority_score numeric;
  v_rationale text;
  v_display_order integer := 0;
  v_dimension_score numeric;
  v_driver_score numeric;
  v_severity_sum integer;
  v_concern_match boolean;
  v_outcome_match boolean;
  v_selected_priority_tags text[];
  v_strength_count integer := 0;
  v_priority_count integer := 0;
  v_quick_win_count integer := 0;
  v_high_impact_count integer := 0;
  v_meeting_q_count integer := 0;
  v_tag_rec text;
BEGIN
  -- Get the assessment result and instance
  SELECT ar.assessment_instance_id, ar.result_snapshot
  INTO v_instance_id, v_snapshot
  FROM public.assessment_results ar
  WHERE ar.id = p_result_id;

  IF v_instance_id IS NULL THEN
    RAISE EXCEPTION 'Assessment result not found: %', p_result_id;
  END IF;

  -- Get version and template info
  SELECT ai.assessment_version_id, t.owner_type
  INTO v_version_id, v_template_owner_type
  FROM public.assessment_instances ai
  JOIN public.assessment_templates t ON t.id = ai.assessment_template_id
  WHERE ai.id = v_instance_id;

  -- Only generate recommendations for Propel-owned assessments
  IF v_template_owner_type <> 'propel' THEN
    RETURN;
  END IF;

  -- Get the recommendation framework
  SELECT recommendation_framework_id INTO v_framework_id
  FROM public.assessment_versions
  WHERE id = v_version_id;

  IF v_framework_id IS NULL THEN
    RETURN;
  END IF;

  -- Extract data from snapshot
  v_section_scores := COALESCE(v_snapshot->'section_scores', '[]'::jsonb);
  v_behavioral_readiness := COALESCE(v_snapshot->'behavioral_readiness', '{}'::jsonb);
  v_contextual_answers := COALESCE(v_snapshot->'contextual_answers', '[]'::jsonb);
  v_overall_score := COALESCE((v_snapshot->'overall_score')::numeric, 0);

  -- Collect selected concern and outcome tags from contextual answers
  SELECT array_agg(DISTINCT tag) INTO v_selected_priority_tags
  FROM (
    SELECT jsonb_array_elements_text(v_contextual_answers->'selected_tags') AS tag
    UNION
    SELECT jsonb_array_elements_text(v_snapshot->'selected_concerns') AS tag
    UNION
    SELECT jsonb_array_elements_text(v_snapshot->'selected_outcomes') AS tag
  ) t WHERE tag IS NOT NULL;

  v_selected_priority_tags := COALESCE(v_selected_priority_tags, ARRAY[]::text[]);

  -- Delete any existing recommendations for this result
  DELETE FROM public.assessment_result_recommendations WHERE assessment_result_id = p_result_id;

  -- ============================================================
  -- 1. STRENGTHS (up to 3, score >= 75)
  -- ============================================================
  v_display_order := 0;
  FOR v_rec IN
    SELECT r.*, COALESCE(ss.normalized_score, 0) as dim_score,
           COALESCE(br.val, 0) as drv_score
    FROM public.recommendations r
    LEFT JOIN LATERAL (
      SELECT (value->>'normalized_score')::numeric AS normalized_score
      FROM jsonb_array_elements(v_section_scores) AS ss(value)
      WHERE ss.value->>'dimension_key' = r.dimension_key
      LIMIT 1
    ) ss ON true
    LEFT JOIN LATERAL (
      SELECT (value->>(r.driver_key))::numeric AS val
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(v_behavioral_readiness) = 'object'
             THEN jsonb_build_array(v_behavioral_readiness)
             ELSE v_behavioral_readiness END
      ) AS br(value)
      LIMIT 1
    ) br ON true
    WHERE r.framework_id = v_framework_id
      AND r.is_active = true
      AND r.recommendation_type = 'strength'
      AND r.dimension_key IS NOT NULL
    ORDER BY COALESCE(ss.normalized_score, 0) DESC, COALESCE(br.val, 0) DESC, r.display_order
  LOOP
    v_dimension_score := COALESCE(v_rec.dim_score, 0);
    v_driver_score := COALESCE(v_rec.drv_score, 0);
    IF v_dimension_score >= 75 OR v_driver_score >= 75 THEN
      v_priority_score := GREATEST(v_dimension_score, v_driver_score);
      v_rationale := 'Score of ' || round(GREATEST(v_dimension_score, v_driver_score)) || '/100 indicates strong performance in this area.';
      v_display_order := v_display_order + 1;
      INSERT INTO public.assessment_result_recommendations
        (assessment_result_id, recommendation_id, priority_score, recommendation_type, rationale_snapshot,
         title_snapshot, description_snapshot, dimension_key_snapshot, driver_key_snapshot,
         effort_level_snapshot, impact_level_snapshot, display_order)
      VALUES
        (p_result_id, v_rec.id, v_priority_score, 'strength', v_rationale,
         v_rec.title, v_rec.description, v_rec.dimension_key, v_rec.driver_key,
         v_rec.effort_level, v_rec.impact_level, v_display_order);
      v_strength_count := v_strength_count + 1;
      IF v_strength_count >= 3 THEN EXIT; END IF;
    END IF;
  END LOOP;

  -- ============================================================
  -- 2. PRIORITY OPPORTUNITIES (up to 3, lowest scores + highest severity)
  -- ============================================================
  v_display_order := 0;
  FOR v_rec IN
    SELECT r.*, COALESCE(ss.normalized_score, 100) as dim_score,
           COALESCE(br.val, 100) as drv_score
    FROM public.recommendations r
    LEFT JOIN LATERAL (
      SELECT (value->>'normalized_score')::numeric AS normalized_score
      FROM jsonb_array_elements(v_section_scores) AS ss(value)
      WHERE ss.value->>'dimension_key' = r.dimension_key
      LIMIT 1
    ) ss ON true
    LEFT JOIN LATERAL (
      SELECT (value->>(r.driver_key))::numeric AS val
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(v_behavioral_readiness) = 'object'
             THEN jsonb_build_array(v_behavioral_readiness)
             ELSE v_behavioral_readiness END
      ) AS br(value)
      LIMIT 1
    ) br ON true
    WHERE r.framework_id = v_framework_id
      AND r.is_active = true
      AND r.recommendation_type = 'priority_opportunity'
      AND r.dimension_key IS NOT NULL
    ORDER BY GREATEST(COALESCE(ss.normalized_score, 100), COALESCE(br.val, 100)) ASC, r.display_order
  LOOP
    v_dimension_score := COALESCE(v_rec.dim_score, 100);
    v_driver_score := COALESCE(v_rec.drv_score, 100);

    -- Calculate diagnostic severity from triggered tags
    SELECT COALESCE(sum(dt.severity_threshold), 0) INTO v_severity_sum
    FROM public.recommendation_tags rt
    JOIN public.assessment_question_diagnostic_tags dt ON dt.tag_key = rt.tag_key
    WHERE rt.recommendation_id = v_rec.id
      AND dt.assessment_version_id = v_version_id;

    -- Check concern/outcome matches
    SELECT EXISTS(
      SELECT 1 FROM public.recommendation_tags rt
      WHERE rt.recommendation_id = v_rec.id
        AND rt.tag_key = ANY(v_selected_priority_tags)
    ) INTO v_concern_match;
    v_concern_match := COALESCE(v_concern_match, false);

    -- Priority score: lower dimension score = higher priority
    v_priority_score := (100 - GREATEST(v_dimension_score, v_driver_score)) * 0.4
                      + v_severity_sum * 5
                      + CASE WHEN v_concern_match THEN 15 ELSE 0 END;

    v_rationale := 'Score of ' || round(LEAST(v_dimension_score, v_driver_score)) || '/100 indicates an opportunity for improvement in this area.';
    IF v_concern_match THEN
      v_rationale := v_rationale || ' This aligns with a priority identified by the client.';
    END IF;

    v_display_order := v_display_order + 1;
    INSERT INTO public.assessment_result_recommendations
      (assessment_result_id, recommendation_id, priority_score, recommendation_type, rationale_snapshot,
       title_snapshot, description_snapshot, dimension_key_snapshot, driver_key_snapshot,
       effort_level_snapshot, impact_level_snapshot, display_order)
    VALUES
      (p_result_id, v_rec.id, v_priority_score, 'priority_opportunity', v_rationale,
       v_rec.title, v_rec.description, v_rec.dimension_key, v_rec.driver_key,
       v_rec.effort_level, v_rec.impact_level, v_display_order);

    v_priority_count := v_priority_count + 1;
    IF v_priority_count >= 3 THEN EXIT; END IF;
  END LOOP;

  -- ============================================================
  -- 3. QUICK WINS (up to 2, low effort + medium/high impact)
  -- ============================================================
  v_display_order := 0;
  FOR v_rec IN
    SELECT r.*, COALESCE(ss.normalized_score, 100) as dim_score,
           COALESCE(br.val, 100) as drv_score
    FROM public.recommendations r
    LEFT JOIN LATERAL (
      SELECT (value->>'normalized_score')::numeric AS normalized_score
      FROM jsonb_array_elements(v_section_scores) AS ss(value)
      WHERE ss.value->>'dimension_key' = r.dimension_key
      LIMIT 1
    ) ss ON true
    LEFT JOIN LATERAL (
      SELECT (value->>(r.driver_key))::numeric AS val
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(v_behavioral_readiness) = 'object'
             THEN jsonb_build_array(v_behavioral_readiness)
             ELSE v_behavioral_readiness END
      ) AS br(value)
      LIMIT 1
    ) br ON true
    WHERE r.framework_id = v_framework_id
      AND r.is_active = true
      AND r.recommendation_type = 'quick_win'
      AND r.effort_level = 'low'
      AND r.impact_level IN ('medium', 'high')
      AND r.dimension_key IS NOT NULL
      AND GREATEST(COALESCE(ss.normalized_score, 100), COALESCE(br.val, 100)) < 75
    ORDER BY GREATEST(COALESCE(ss.normalized_score, 100), COALESCE(br.val, 100)) ASC, r.display_order
  LOOP
    -- Check if this quick win relates to a selected priority opportunity (same dimension or driver)
    SELECT EXISTS(
      SELECT 1 FROM public.assessment_result_recommendations arr
      JOIN public.recommendations pr ON pr.id = arr.recommendation_id
      WHERE arr.assessment_result_id = p_result_id
        AND arr.recommendation_type = 'priority_opportunity'
        AND (pr.dimension_key = v_rec.dimension_key OR pr.driver_key = v_rec.driver_key)
    ) INTO v_concern_match;
    v_concern_match := COALESCE(v_concern_match, false);

    -- Also check tag overlap
    IF NOT v_concern_match THEN
      SELECT EXISTS(
        SELECT 1 FROM public.recommendation_tags rt1
        JOIN public.recommendation_tags rt2 ON rt1.tag_key = rt2.tag_key
        JOIN public.assessment_result_recommendations arr ON arr.recommendation_id = rt2.recommendation_id
        WHERE rt1.recommendation_id = v_rec.id
          AND arr.assessment_result_id = p_result_id
          AND arr.recommendation_type = 'priority_opportunity'
      ) INTO v_concern_match;
      v_concern_match := COALESCE(v_concern_match, false);
    END IF;

    -- Include if related to a priority opportunity
    IF v_concern_match THEN
      v_priority_score := (100 - GREATEST(COALESCE(v_rec.dim_score, 100), COALESCE(v_rec.drv_score, 100))) * 0.3 + 20;
      v_rationale := 'Low-effort improvement that supports a priority opportunity in this area.';
      v_display_order := v_display_order + 1;
      INSERT INTO public.assessment_result_recommendations
        (assessment_result_id, recommendation_id, priority_score, recommendation_type, rationale_snapshot,
         title_snapshot, description_snapshot, dimension_key_snapshot, driver_key_snapshot,
         effort_level_snapshot, impact_level_snapshot, display_order)
      VALUES
        (p_result_id, v_rec.id, v_priority_score, 'quick_win', v_rationale,
         v_rec.title, v_rec.description, v_rec.dimension_key, v_rec.driver_key,
         v_rec.effort_level, v_rec.impact_level, v_display_order);

      v_quick_win_count := v_quick_win_count + 1;
      IF v_quick_win_count >= 2 THEN EXIT; END IF;
    END IF;
  END LOOP;

  -- ============================================================
  -- 4. HIGH-IMPACT MOVES (up to 2, high impact)
  -- ============================================================
  v_display_order := 0;
  FOR v_rec IN
    SELECT r.*, COALESCE(ss.normalized_score, 100) as dim_score,
           COALESCE(br.val, 100) as drv_score
    FROM public.recommendations r
    LEFT JOIN LATERAL (
      SELECT (value->>'normalized_score')::numeric AS normalized_score
      FROM jsonb_array_elements(v_section_scores) AS ss(value)
      WHERE ss.value->>'dimension_key' = r.dimension_key
      LIMIT 1
    ) ss ON true
    LEFT JOIN LATERAL (
      SELECT (value->>(r.driver_key))::numeric AS val
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(v_behavioral_readiness) = 'object'
             THEN jsonb_build_array(v_behavioral_readiness)
             ELSE v_behavioral_readiness END
      ) AS br(value)
      LIMIT 1
    ) br ON true
    WHERE r.framework_id = v_framework_id
      AND r.is_active = true
      AND r.recommendation_type = 'high_impact_move'
      AND r.impact_level = 'high'
      AND r.dimension_key IS NOT NULL
      AND GREATEST(COALESCE(ss.normalized_score, 100), COALESCE(br.val, 100)) < 75
    ORDER BY GREATEST(COALESCE(ss.normalized_score, 100), COALESCE(br.val, 100)) ASC, r.display_order
  LOOP
    -- Check if this high-impact move relates to a selected priority opportunity
    SELECT EXISTS(
      SELECT 1 FROM public.assessment_result_recommendations arr
      JOIN public.recommendations pr ON pr.id = arr.recommendation_id
      WHERE arr.assessment_result_id = p_result_id
        AND arr.recommendation_type = 'priority_opportunity'
        AND (pr.dimension_key = v_rec.dimension_key OR pr.driver_key = v_rec.driver_key)
    ) INTO v_concern_match;
    v_concern_match := COALESCE(v_concern_match, false);

    IF NOT v_concern_match THEN
      SELECT EXISTS(
        SELECT 1 FROM public.recommendation_tags rt1
        JOIN public.recommendation_tags rt2 ON rt1.tag_key = rt2.tag_key
        JOIN public.assessment_result_recommendations arr ON arr.recommendation_id = rt2.recommendation_id
        WHERE rt1.recommendation_id = v_rec.id
          AND arr.assessment_result_id = p_result_id
          AND arr.recommendation_type = 'priority_opportunity'
      ) INTO v_concern_match;
      v_concern_match := COALESCE(v_concern_match, false);
    END IF;

    IF v_concern_match THEN
      v_priority_score := (100 - GREATEST(COALESCE(v_rec.dim_score, 100), COALESCE(v_rec.drv_score, 100))) * 0.3 + 25;
      v_rationale := 'High-impact improvement that addresses a priority opportunity in this area.';
      v_display_order := v_display_order + 1;
      INSERT INTO public.assessment_result_recommendations
        (assessment_result_id, recommendation_id, priority_score, recommendation_type, rationale_snapshot,
         title_snapshot, description_snapshot, dimension_key_snapshot, driver_key_snapshot,
         effort_level_snapshot, impact_level_snapshot, display_order)
      VALUES
        (p_result_id, v_rec.id, v_priority_score, 'high_impact_move', v_rationale,
         v_rec.title, v_rec.description, v_rec.dimension_key, v_rec.driver_key,
         v_rec.effort_level, v_rec.impact_level, v_display_order);

      v_high_impact_count := v_high_impact_count + 1;
      IF v_high_impact_count >= 2 THEN EXIT; END IF;
    END IF;
  END LOOP;

  -- ============================================================
  -- 5. MEETING QUESTIONS (up to 3, tied to identified opportunity areas)
  -- ============================================================
  v_display_order := 0;
  FOR v_rec IN
    SELECT r.*
    FROM public.recommendations r
    WHERE r.framework_id = v_framework_id
      AND r.is_active = true
      AND r.recommendation_type = 'meeting_question'
      AND r.dimension_key IN (
        SELECT DISTINCT pr.dimension_key
        FROM public.assessment_result_recommendations arr
        JOIN public.recommendations pr ON pr.id = arr.recommendation_id
        WHERE arr.assessment_result_id = p_result_id
          AND arr.recommendation_type IN ('priority_opportunity', 'quick_win', 'high_impact_move')
          AND pr.dimension_key IS NOT NULL
      )
    ORDER BY r.display_order
  LOOP
    v_rationale := 'Discussion question tied to an identified opportunity area.';
    v_display_order := v_display_order + 1;
    INSERT INTO public.assessment_result_recommendations
      (assessment_result_id, recommendation_id, priority_score, recommendation_type, rationale_snapshot,
       title_snapshot, description_snapshot, dimension_key_snapshot, driver_key_snapshot,
       effort_level_snapshot, impact_level_snapshot, display_order)
    VALUES
      (p_result_id, v_rec.id, 0, 'meeting_question', v_rationale,
       v_rec.title, v_rec.description, v_rec.dimension_key, v_rec.driver_key,
       v_rec.effort_level, v_rec.impact_level, v_display_order);

    v_meeting_q_count := v_meeting_q_count + 1;
    IF v_meeting_q_count >= 3 THEN EXIT; END IF;
  END LOOP;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.generate_recommendations(p_result_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_recommendations(p_result_id uuid) TO authenticated;
/*
# Update generate_recommendations to query data directly + wire into finalize

1. Recreate generate_recommendations to query section_scores and behavioral_readiness
   directly from the database rather than relying on the result snapshot.
2. Update finalize_assessment_submission to call generate_recommendations after scoring.
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
  v_behavioral jsonb;
  v_overall_score numeric;
  v_rec RECORD;
  v_priority_score numeric;
  v_rationale text;
  v_display_order integer := 0;
  v_dimension_score numeric;
  v_driver_score numeric;
  v_severity_sum integer;
  v_concern_match boolean;
  v_strength_count integer := 0;
  v_priority_count integer := 0;
  v_quick_win_count integer := 0;
  v_high_impact_count integer := 0;
  v_meeting_q_count integer := 0;
  v_selected_tags text[];
  v_sec_score_map jsonb;
  v_driver_val numeric;
BEGIN
  SELECT ar.assessment_instance_id, ar.result_snapshot
  INTO v_instance_id, v_snapshot
  FROM public.assessment_results ar
  WHERE ar.id = p_result_id;

  IF v_instance_id IS NULL THEN RETURN; END IF;

  SELECT ai.assessment_version_id, t.owner_type
  INTO v_version_id, v_template_owner_type
  FROM public.assessment_instances ai
  JOIN public.assessment_templates t ON t.id = ai.assessment_template_id
  WHERE ai.id = v_instance_id;

  IF v_template_owner_type <> 'propel' THEN RETURN; END IF;

  SELECT recommendation_framework_id INTO v_framework_id
  FROM public.assessment_versions WHERE id = v_version_id;

  IF v_framework_id IS NULL THEN RETURN; END IF;

  -- Extract behavioral readiness from snapshot
  v_behavioral := COALESCE(v_snapshot->'behavioral_readiness', '{}'::jsonb);
  v_overall_score := COALESCE((v_snapshot->'overall_score')::numeric, 0);

  -- Build section score map: { dimension_key -> normalized_score }
  -- Use section title slug as dimension_key mapping
  SELECT COALESCE(jsonb_object_agg(
    LOWER(REPLACE(s.title, ' ', '_')),
    COALESCE(ss.normalized_score, 0)
  ), '{}'::jsonb) INTO v_sec_score_map
  FROM public.assessment_sections s
  LEFT JOIN public.assessment_section_scores ss ON ss.section_id = s.id AND ss.assessment_instance_id = v_instance_id
  WHERE s.assessment_version_id = v_version_id AND s.is_scored = true;

  -- Collect selected concern/outcome tags from contextual responses
  -- Q26 (outcomes) and Q27 (concerns) are multi_select, stored in text_value as JSON array of option IDs
  SELECT array_agg(DISTINCT o.option_value) INTO v_selected_tags
  FROM public.assessment_responses r
  JOIN public.assessment_questions q ON q.id = r.question_id
  JOIN public.assessment_question_options o ON o.question_id = q.id
  WHERE r.assessment_instance_id = v_instance_id
    AND q.is_scored = false
    AND r.text_value IS NOT NULL
    AND o.id = ANY(
      CASE
        WHEN r.text_value LIKE '[%' THEN
          ARRAY(SELECT jsonb_array_elements_text(r.text_value::jsonb))
        ELSE ARRAY[]::text[]
      END
    );

  v_selected_tags := COALESCE(v_selected_tags, ARRAY[]::text[]);

  DELETE FROM public.assessment_result_recommendations WHERE assessment_result_id = p_result_id;

  -- ============================================================
  -- 1. STRENGTHS (up to 3, score >= 75)
  -- ============================================================
  v_display_order := 0;
  FOR v_rec IN
    SELECT r.*,
      COALESCE((v_sec_score_map->r.dimension_key)::numeric, 0) as dim_score,
      COALESCE((v_behavioral->r.driver_key)::numeric, 0) as drv_score
    FROM public.recommendations r
    WHERE r.framework_id = v_framework_id
      AND r.is_active = true
      AND r.recommendation_type = 'strength'
      AND r.dimension_key IS NOT NULL
    ORDER BY GREATEST(
      COALESCE((v_sec_score_map->r.dimension_key)::numeric, 0),
      COALESCE((v_behavioral->r.driver_key)::numeric, 0)
    ) DESC, r.display_order
  LOOP
    v_dimension_score := COALESCE(v_rec.dim_score, 0);
    v_driver_score := COALESCE(v_rec.drv_score, 0);
    IF GREATEST(v_dimension_score, v_driver_score) >= 75 THEN
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
    SELECT r.*,
      COALESCE((v_sec_score_map->r.dimension_key)::numeric, 100) as dim_score,
      COALESCE((v_behavioral->r.driver_key)::numeric, 100) as drv_score
    FROM public.recommendations r
    WHERE r.framework_id = v_framework_id
      AND r.is_active = true
      AND r.recommendation_type = 'priority_opportunity'
      AND r.dimension_key IS NOT NULL
    ORDER BY GREATEST(
      COALESCE((v_sec_score_map->r.dimension_key)::numeric, 100),
      COALESCE((v_behavioral->r.driver_key)::numeric, 100)
    ) ASC, r.display_order
  LOOP
    v_dimension_score := COALESCE(v_rec.dim_score, 100);
    v_driver_score := COALESCE(v_rec.drv_score, 100);

    -- Diagnostic severity from triggered tags
    SELECT COALESCE(sum(dt.severity_threshold), 0) INTO v_severity_sum
    FROM public.recommendation_tags rt
    JOIN public.assessment_question_diagnostic_tags dt ON dt.tag_key = rt.tag_key
    WHERE rt.recommendation_id = v_rec.id
      AND dt.assessment_version_id = v_version_id;

    -- Check concern/outcome matches
    SELECT EXISTS(
      SELECT 1 FROM public.recommendation_tags rt
      WHERE rt.recommendation_id = v_rec.id
        AND rt.tag_key = ANY(v_selected_tags)
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
  -- 3. QUICK WINS (up to 2, low effort + medium/high impact, related to priority)
  -- ============================================================
  v_display_order := 0;
  FOR v_rec IN
    SELECT r.*,
      COALESCE((v_sec_score_map->r.dimension_key)::numeric, 100) as dim_score,
      COALESCE((v_behavioral->r.driver_key)::numeric, 100) as drv_score
    FROM public.recommendations r
    WHERE r.framework_id = v_framework_id
      AND r.is_active = true
      AND r.recommendation_type = 'quick_win'
      AND r.effort_level = 'low'
      AND r.impact_level IN ('medium', 'high')
      AND r.dimension_key IS NOT NULL
      AND GREATEST(
        COALESCE((v_sec_score_map->r.dimension_key)::numeric, 100),
        COALESCE((v_behavioral->r.driver_key)::numeric, 100)
      ) < 75
    ORDER BY GREATEST(
      COALESCE((v_sec_score_map->r.dimension_key)::numeric, 100),
      COALESCE((v_behavioral->r.driver_key)::numeric, 100)
    ) ASC, r.display_order
  LOOP
    -- Check if related to a selected priority opportunity (same dimension or driver or tag overlap)
    SELECT EXISTS(
      SELECT 1 FROM public.assessment_result_recommendations arr
      JOIN public.recommendations pr ON pr.id = arr.recommendation_id
      WHERE arr.assessment_result_id = p_result_id
        AND arr.recommendation_type = 'priority_opportunity'
        AND (pr.dimension_key = v_rec.dimension_key OR pr.driver_key = v_rec.driver_key)
    ) OR EXISTS(
      SELECT 1 FROM public.recommendation_tags rt1
      JOIN public.recommendation_tags rt2 ON rt1.tag_key = rt2.tag_key
      JOIN public.assessment_result_recommendations arr ON arr.recommendation_id = rt2.recommendation_id
      WHERE rt1.recommendation_id = v_rec.id
        AND arr.assessment_result_id = p_result_id
        AND arr.recommendation_type = 'priority_opportunity'
    ) INTO v_concern_match;
    v_concern_match := COALESCE(v_concern_match, false);

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
  -- 4. HIGH-IMPACT MOVES (up to 2, high impact, related to priority)
  -- ============================================================
  v_display_order := 0;
  FOR v_rec IN
    SELECT r.*,
      COALESCE((v_sec_score_map->r.dimension_key)::numeric, 100) as dim_score,
      COALESCE((v_behavioral->r.driver_key)::numeric, 100) as drv_score
    FROM public.recommendations r
    WHERE r.framework_id = v_framework_id
      AND r.is_active = true
      AND r.recommendation_type = 'high_impact_move'
      AND r.impact_level = 'high'
      AND r.dimension_key IS NOT NULL
      AND GREATEST(
        COALESCE((v_sec_score_map->r.dimension_key)::numeric, 100),
        COALESCE((v_behavioral->r.driver_key)::numeric, 100)
      ) < 75
    ORDER BY GREATEST(
      COALESCE((v_sec_score_map->r.dimension_key)::numeric, 100),
      COALESCE((v_behavioral->r.driver_key)::numeric, 100)
    ) ASC, r.display_order
  LOOP
    SELECT EXISTS(
      SELECT 1 FROM public.assessment_result_recommendations arr
      JOIN public.recommendations pr ON pr.id = arr.recommendation_id
      WHERE arr.assessment_result_id = p_result_id
        AND arr.recommendation_type = 'priority_opportunity'
        AND (pr.dimension_key = v_rec.dimension_key OR pr.driver_key = v_rec.driver_key)
    ) OR EXISTS(
      SELECT 1 FROM public.recommendation_tags rt1
      JOIN public.recommendation_tags rt2 ON rt1.tag_key = rt2.tag_key
      JOIN public.assessment_result_recommendations arr ON arr.recommendation_id = rt2.recommendation_id
      WHERE rt1.recommendation_id = v_rec.id
        AND arr.assessment_result_id = p_result_id
        AND arr.recommendation_type = 'priority_opportunity'
    ) INTO v_concern_match;
    v_concern_match := COALESCE(v_concern_match, false);

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

-- ============================================================
-- Update finalize_assessment_submission to call generate_recommendations
-- ============================================================
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

  v_result := calculate_assessment_scores(v_instance.id);

  UPDATE assessment_instances
  SET status = 'submitted', submitted_at = now(), overall_score = v_result.normalized_score
  WHERE id = v_instance.id;

  -- Generate deterministic recommendations for Propel-owned assessments
  -- (no-op for broker-owned assessments)
  PERFORM generate_recommendations(v_result.id);

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.finalize_assessment_submission(p_token uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_assessment_submission(p_token uuid) TO anon, authenticated;
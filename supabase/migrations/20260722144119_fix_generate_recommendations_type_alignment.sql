/*
# Fix: generate_recommendations type alignment with strength fields

## Problem
The `20260721220000_add_strength_fields` migration recreated `generate_recommendations`
to query `WHERE r.recommendation_type = 'strength'` and `'priority_opportunity'`,
but the `recommendations` table only contains `quick_win`, `high_impact_move`, and
`meeting_question` types. This caused strengths and priority opportunities to never
be generated, which in turn suppressed quick wins and high-impact moves (both depend
on priority opportunities being present). Only meeting questions could occasionally
appear if they matched by dimension key.

## Fix
Recreate `generate_recommendations` to:
1. STRENGTHS: Select from `quick_win` and `high_impact_move` types where
   dimension/driver score >= 75. Snapshot `strength_title`/`strength_description`
   when present (added by the strength-fields migration).
2. PRIORITY OPPORTUNITIES: Select from `quick_win` and `high_impact_move` types
   where score < 75, ranked by lowest score + highest severity + concern match.
3. QUICK WINS: From `quick_win` type, low effort, related to selected priorities.
4. HIGH-IMPACT MOVES: From `high_impact_move` type, high impact, related to priorities.
5. MEETING QUESTIONS: Same as before, tied to identified opportunity areas.

This merges the type-alignment fix from `20260721190300` with the strength-fields
snapshot logic from `20260721220000`.

## Security
No schema changes. No RLS changes. Only the `generate_recommendations` function
is recreated. Permissions remain: REVOKE FROM PUBLIC, GRANT TO authenticated.
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
  v_used_dimension_keys text[] := ARRAY[]::text[];
  v_used_driver_keys text[] := ARRAY[]::text[];
  v_used_bank_groups text[] := ARRAY[]::text[];
  v_bank_group text;
  v_selected_priority_rec_ids uuid[];
BEGIN
  SELECT ar.assessment_instance_id, ar.result_snapshot
  INTO v_instance_id, v_snapshot
  FROM public.assessment_results ar
  WHERE ar.id = p_result_id;

  IF v_instance_id IS NULL THEN
    RAISE EXCEPTION 'Assessment result not found: %', p_result_id;
  END IF;

  SELECT ai.assessment_version_id, t.owner_type
  INTO v_version_id, v_template_owner_type
  FROM public.assessment_instances ai
  JOIN public.assessment_templates t ON t.id = ai.assessment_template_id
  WHERE ai.id = v_instance_id;

  IF v_template_owner_type <> 'propel' THEN
    RETURN;
  END IF;

  SELECT recommendation_framework_id INTO v_framework_id
  FROM public.assessment_versions
  WHERE id = v_version_id;

  IF v_framework_id IS NULL THEN
    RETURN;
  END IF;

  v_section_scores := COALESCE(v_snapshot->'section_scores', '[]'::jsonb);
  v_behavioral_readiness := COALESCE(v_snapshot->'behavioral_readiness', '{}'::jsonb);
  v_contextual_answers := COALESCE(v_snapshot->'contextual_answers', '[]'::jsonb);
  v_overall_score := COALESCE((v_snapshot->'overall_score')::numeric, 0);

  SELECT array_agg(DISTINCT tag) INTO v_selected_priority_tags
  FROM (
    SELECT jsonb_array_elements_text(v_contextual_answers->'selected_tags') AS tag
    UNION
    SELECT jsonb_array_elements_text(v_snapshot->'selected_concerns') AS tag
    UNION
    SELECT jsonb_array_elements_text(v_snapshot->'selected_outcomes') AS tag
  ) t WHERE tag IS NOT NULL;

  v_selected_priority_tags := COALESCE(v_selected_priority_tags, ARRAY[]::text[]);

  DELETE FROM public.assessment_result_recommendations WHERE assessment_result_id = p_result_id;

  -- ============================================================
  -- 1. STRENGTHS (up to 3, score >= 75, from quick_win/high_impact_move types)
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
      AND r.recommendation_type IN ('quick_win', 'high_impact_move')
      AND r.dimension_key IS NOT NULL
    ORDER BY GREATEST(COALESCE(ss.normalized_score, 0), COALESCE(br.val, 0)) DESC, r.display_order
  LOOP
    v_dimension_score := COALESCE(v_rec.dim_score, 0);
    v_driver_score := COALESCE(v_rec.drv_score, 0);

    IF v_dimension_score < 75 AND v_driver_score < 75 THEN
      CONTINUE;
    END IF;

    IF v_rec.dimension_key IS NOT NULL AND v_rec.dimension_key = ANY(v_used_dimension_keys) THEN
      CONTINUE;
    END IF;

    IF v_rec.driver_key IS NOT NULL AND v_rec.driver_key = ANY(v_used_driver_keys) THEN
      CONTINUE;
    END IF;

    v_bank_group := split_part(v_rec.bank_id, '-', 1);
    IF v_bank_group = ANY(v_used_bank_groups) THEN
      CONTINUE;
    END IF;

    v_priority_score := GREATEST(v_dimension_score, v_driver_score);
    v_rationale := 'Score of ' || round(GREATEST(v_dimension_score, v_driver_score)) || '/100 indicates strong performance in this area.';
    v_display_order := v_display_order + 1;
    INSERT INTO public.assessment_result_recommendations
      (assessment_result_id, recommendation_id, priority_score, recommendation_type, rationale_snapshot,
       title_snapshot, description_snapshot, dimension_key_snapshot, driver_key_snapshot,
       effort_level_snapshot, impact_level_snapshot, display_order,
       strength_title_snapshot, strength_description_snapshot)
    VALUES
      (p_result_id, v_rec.id, v_priority_score, 'strength', v_rationale,
       v_rec.title, v_rec.description, v_rec.dimension_key, v_rec.driver_key,
       v_rec.effort_level, v_rec.impact_level, v_display_order,
       v_rec.strength_title, v_rec.strength_description);

    v_used_dimension_keys := array_append(v_used_dimension_keys, v_rec.dimension_key);
    IF v_rec.driver_key IS NOT NULL THEN
      v_used_driver_keys := array_append(v_used_driver_keys, v_rec.driver_key);
    END IF;
    v_used_bank_groups := array_append(v_used_bank_groups, v_bank_group);

    v_strength_count := v_strength_count + 1;
    IF v_strength_count >= 3 THEN EXIT; END IF;
  END LOOP;

  -- ============================================================
  -- 2. PRIORITY OPPORTUNITIES (up to 3, lowest scores, from quick_win/high_impact_move types)
  -- ============================================================
  v_display_order := 0;
  v_selected_priority_rec_ids := ARRAY[]::uuid[];
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
      AND r.recommendation_type IN ('quick_win', 'high_impact_move')
      AND r.dimension_key IS NOT NULL
      AND GREATEST(COALESCE(ss.normalized_score, 100), COALESCE(br.val, 100)) < 75
    ORDER BY GREATEST(COALESCE(ss.normalized_score, 100), COALESCE(br.val, 100)) ASC, r.display_order
  LOOP
    v_dimension_score := COALESCE(v_rec.dim_score, 100);
    v_driver_score := COALESCE(v_rec.drv_score, 100);

    SELECT COALESCE(sum(dt.severity_threshold), 0) INTO v_severity_sum
    FROM public.recommendation_tags rt
    JOIN public.assessment_question_diagnostic_tags dt ON dt.tag_key = rt.tag_key
    WHERE rt.recommendation_id = v_rec.id
      AND dt.assessment_version_id = v_version_id;

    SELECT EXISTS(
      SELECT 1 FROM public.recommendation_tags rt
      WHERE rt.recommendation_id = v_rec.id
        AND rt.tag_key = ANY(v_selected_priority_tags)
    ) INTO v_concern_match;
    v_concern_match := COALESCE(v_concern_match, false);

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

    v_selected_priority_rec_ids := array_append(v_selected_priority_rec_ids, v_rec.id);
    v_priority_count := v_priority_count + 1;
    IF v_priority_count >= 3 THEN EXIT; END IF;
  END LOOP;

  -- ============================================================
  -- 3. QUICK WINS (up to 2, low effort, related to priority opportunities)
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
      AND r.id NOT IN (SELECT unnest(v_selected_priority_rec_ids))
    ORDER BY GREATEST(COALESCE(ss.normalized_score, 100), COALESCE(br.val, 100)) ASC, r.display_order
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
  -- 4. HIGH-IMPACT MOVES (up to 2, high impact, related to priority opportunities)
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
      AND r.id NOT IN (SELECT unnest(v_selected_priority_rec_ids))
    ORDER BY GREATEST(COALESCE(ss.normalized_score, 100), COALESCE(br.val, 100)) ASC, r.display_order
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
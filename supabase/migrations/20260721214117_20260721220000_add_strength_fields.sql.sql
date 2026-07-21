/*
# Add dedicated strength fields to recommendations

1. Purpose
   - The Strengths section must not reuse action-oriented recommendation wording.
   - Add dedicated `strength_title` and `strength_description` columns to the
     `recommendations` table so each recommendation that may appear as a Strength
     has its own positive, present-tense wording.
   - Add matching `strength_title_snapshot` and `strength_description_snapshot`
     columns to `assessment_result_recommendations` so historical snapshots
     freeze the strength wording at finalization time (same pattern as the
     existing title_snapshot / description_snapshot fields).

2. Schema changes
   - `recommendations.strength_title` (text, nullable)
   - `recommendations.strength_description` (text, nullable)
   - `assessment_result_recommendations.strength_title_snapshot` (text, nullable)
   - `assessment_result_recommendations.strength_description_snapshot` (text, nullable)

3. Data seed
   - Populate `strength_title` and `strength_description` for every recommendation
     bank_id listed in the approved strength wording (CLARITY-001..008,
     MOTIVATION-001..008, TRUST-001..007, FRICTION-001..008, STRATEGY-001..006,
     MEASURE-001..008).

4. Security
   - No new tables; RLS already enabled on both tables.
   - No policy changes needed — existing policies cover the new columns.

5. Notes
   - Original `title` and `description` fields remain unchanged for
     Priority Opportunities, Quick Wins, High-Impact Moves, and Client Meeting Questions.
   - The `generate_recommendations` RPC is updated to snapshot the new
     strength fields when inserting strength-type result recommendations.
*/

-- ============================================================
-- 1. Add columns to recommendations
-- ============================================================
ALTER TABLE public.recommendations
  ADD COLUMN IF NOT EXISTS strength_title text,
  ADD COLUMN IF NOT EXISTS strength_description text;

-- ============================================================
-- 2. Add snapshot columns to assessment_result_recommendations
-- ============================================================
ALTER TABLE public.assessment_result_recommendations
  ADD COLUMN IF NOT EXISTS strength_title_snapshot text,
  ADD COLUMN IF NOT EXISTS strength_description_snapshot text;

-- ============================================================
-- 3. Seed approved strength wording by bank_id
-- ============================================================
UPDATE public.recommendations SET
  strength_title = data.strength_title,
  strength_description = data.strength_description
FROM (VALUES
  -- CLARITY
  ('CLARITY-001', 'Guided Starting Experience', 'The program provides a visible starting experience that helps employees understand what is available and identify a relevant first action.'),
  ('CLARITY-002', 'Clear Employee Value Proposition', 'The program communicates a clear employee benefit and helps employees understand why participation matters to them.'),
  ('CLARITY-003', 'Clear Incentive Communication', 'Employees can understand incentive requirements, important dates, available rewards, their progress, and what to do next.'),
  ('CLARITY-004', 'Centralized Employee Resource Experience', 'Employees can find well-being benefits and resources through a coordinated experience organized around their needs.'),
  ('CLARITY-005', 'Population-Specific Relevance', 'Program communications and experiences reflect meaningful differences across employee roles, locations, needs, and work environments.'),
  ('CLARITY-006', 'Year-Round Program Roadmap', 'The program follows a coordinated year-round roadmap that connects priorities, campaigns, communications, benefits, and measurement.'),
  ('CLARITY-007', 'Explicit Next Actions', 'Well-being communications consistently direct employees toward a specific and manageable next action.'),
  ('CLARITY-008', 'Consistent Leadership and Manager Communication', 'Leaders and managers can clearly explain the purpose of the well-being strategy and their role in supporting it.'),
  -- MOTIVATION
  ('MOTIVATION-001', 'Achievable Micro-Actions', 'The program translates broad well-being goals into small, practical actions employees can begin immediately.'),
  ('MOTIVATION-002', 'Visible Progress', 'Employees receive timely feedback and can see how their actions contribute to meaningful progress.'),
  ('MOTIVATION-003', 'Episodic Campaign Structure', 'Year-round engagement is organized into distinct campaigns with clear themes, milestones, and periods of focus.'),
  ('MOTIVATION-004', 'Employee Choice and Ownership', 'Employees have meaningful choices in the topics, activities, and goals they use to participate.'),
  ('MOTIVATION-005', 'Immediate Reinforcement', 'The program provides timely recognition, feedback, or milestone reinforcement before the final reward is earned.'),
  ('MOTIVATION-006', 'Appropriate Challenge Levels', 'Employees can participate at a level of difficulty that reflects their experience, readiness, and personal goals.'),
  ('MOTIVATION-007', 'Timely and Contextually Relevant Programming', 'Program outreach and recommended actions align with moments when employees are most likely to find them personally relevant.'),
  ('MOTIVATION-008', 'Varied and Fresh Programming', 'The program uses varied topics, formats, social experiences, and participation pathways to sustain attention over time.'),
  -- TRUST
  ('TRUST-001', 'Visible and Understandable Privacy Protections', 'Employees receive clear explanations of how their information is protected, used, and kept confidential.'),
  ('TRUST-002', 'Visible Leadership Participation', 'Leaders demonstrate consistent support through participation, personal examples, and visible reinforcement.'),
  ('TRUST-003', 'Relatable Peer Stories', 'Employees see authentic examples of participation and success from peers across different roles and work environments.'),
  ('TRUST-004', 'Culturally Aligned Program Experience', 'Program language, imagery, examples, and participation formats reflect the organization''s workforce and culture.'),
  ('TRUST-005', 'Supportive Manager Reinforcement', 'Managers encourage participation while respecting employee privacy, choice, and voluntariness.'),
  ('TRUST-006', 'Responsive Trust-Building', 'The organization acknowledges prior program frustrations and demonstrates how the current approach addresses them.'),
  ('TRUST-007', 'Inclusive Social Participation', 'Employees can choose from visible social, private-group, and individual participation options that support comfort and inclusion.'),
  -- FRICTION
  ('FRICTION-001', 'Central Access Point', 'Employees can access well-being resources through a centralized experience organized around common needs and actions.'),
  ('FRICTION-002', 'Streamlined Authentication', 'Employees can access the program through a clear and convenient login experience with limited authentication friction.'),
  ('FRICTION-003', 'Frontline and Deskless Accessibility', 'The program is designed around the schedules, communication channels, and participation realities of frontline, shift, field, remote, and deskless employees.'),
  ('FRICTION-004', 'Mobile-Friendly Participation', 'Employees can complete common program actions quickly and conveniently from mobile devices.'),
  ('FRICTION-005', 'Coordinated Communication', 'Well-being communications are coordinated by audience, timing, frequency, and channel to reduce noise and improve relevance.'),
  ('FRICTION-006', 'Efficient Program Administration', 'Program operations use clear ownership and automation to reduce repetitive administrative work.'),
  ('FRICTION-007', 'Reliable Eligibility and Data Processes', 'Eligibility and data processes have clear ownership, validation, monitoring, and exception handling.'),
  ('FRICTION-008', 'Simple Navigation and Choice Architecture', 'The program organizes navigation around common employee needs and makes recommended next actions easy to find.'),
  -- STRATEGY
  ('STRATEGY-001', 'Measurable Well-being Objectives', 'The organization has defined measurable well-being objectives connected to employee and organizational priorities.'),
  ('STRATEGY-002', 'Alignment With Workforce Priorities', 'The well-being strategy is explicitly connected to broader workforce priorities such as prevention, retention, culture, safety, and benefits utilization.'),
  ('STRATEGY-003', 'Clear Governance and Decision Rights', 'Strategy ownership, operational responsibilities, decision rights, and review expectations are clearly defined.'),
  ('STRATEGY-004', 'Consistent Leadership Reinforcement', 'Leaders reinforce well-being priorities throughout the year and connect them to organizational goals and values.'),
  ('STRATEGY-005', 'Priority-Population Strategy', 'The organization identifies priority employee populations and adapts objectives, communications, and engagement approaches to their needs.'),
  ('STRATEGY-006', 'Formal Strategy Review', 'The organization regularly reviews objectives, engagement, outcomes, employee input, vendor performance, and future priorities.'),
  -- MEASURE
  ('MEASURE-001', 'Balanced Well-being KPI Framework', 'The organization tracks a balanced set of awareness, engagement, behavior, health, and organizational measures.'),
  ('MEASURE-002', 'Clear Engagement Funnel Measurement', 'The organization distinguishes awareness, registration, activation, sustained participation, and retention.'),
  ('MEASURE-003', 'Employee-Segment Analysis', 'Engagement is analyzed across meaningful employee segments such as location, department, role, and work environment.'),
  ('MEASURE-004', 'Sustained Engagement Measurement', 'The organization measures whether employees return and continue participating, rather than relying only on one-time completion.'),
  ('MEASURE-005', 'Connection Between Activity and Outcomes', 'Program activities are connected to defined behavioral, preventive-care, health, and workforce outcomes.'),
  ('MEASURE-006', 'Continuous Employee Feedback', 'The organization regularly gathers employee feedback and uses it to inform program decisions.'),
  ('MEASURE-007', 'Test-and-Learn Improvement Cycle', 'The organization tests changes to messaging, timing, incentives, and segmentation and uses results to improve the program.'),
  ('MEASURE-008', 'Leadership-Ready Well-being Scorecard', 'Leaders and brokers receive a concise view of objectives, performance, trends, population gaps, and recommended actions.')
) AS data(bank_id, strength_title, strength_description)
WHERE recommendations.bank_id = data.bank_id;

-- ============================================================
-- 4. Update generate_recommendations RPC to snapshot strength fields
-- ============================================================
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
  -- 1. STRENGTHS (up to 3, score >= 75, dedupe by dimension/driver/group)
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
      AND r.strength_title IS NOT NULL
      AND r.strength_description IS NOT NULL
    ORDER BY GREATEST(COALESCE(ss.normalized_score, 0), COALESCE(br.val, 0)) DESC, r.display_order
  LOOP
    v_dimension_score := COALESCE(v_rec.dim_score, 0);
    v_driver_score := COALESCE(v_rec.drv_score, 0);

    -- Require score >= 75
    IF v_dimension_score < 75 AND v_driver_score < 75 THEN
      CONTINUE;
    END IF;

    -- Suppress duplicate dimensions
    IF v_rec.dimension_key IS NOT NULL AND v_rec.dimension_key = ANY(v_used_dimension_keys) THEN
      CONTINUE;
    END IF;

    -- Suppress duplicate drivers
    IF v_rec.driver_key IS NOT NULL AND v_rec.driver_key = ANY(v_used_driver_keys) THEN
      CONTINUE;
    END IF;

    -- Suppress duplicate recommendation groups (prefix before first dash)
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

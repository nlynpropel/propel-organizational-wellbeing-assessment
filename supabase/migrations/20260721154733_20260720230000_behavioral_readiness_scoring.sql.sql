/*
# Behavioral Readiness Scoring for Propel Well-being Opportunity Index

## Overview
Adds an additive, versioned question-to-driver mapping structure for computing
behavioral readiness scores for the Propel Well-being Opportunity Index assessment.
Also extends calculate_assessment_scores to compute and persist behavioral readiness
scores in the result snapshot.

## New Tables
- `assessment_question_driver_mappings`
  - `id` (uuid, PK)
  - `assessment_version_id` (uuid, FK to assessment_versions)
  - `question_id` (uuid, FK to assessment_questions)
  - `driver_key` (text, CHECK constraint for allowed values)
  - `mapping_weight` (numeric, default 1.0)
  - `created_at` (timestamptz)

  Allowed driver keys: clarity_of_value, motivation_overcoming_inertia,
  trust_social_proof, structural_environmental_friction

  Primary mapping weight: 1.0
  Secondary mapping weight: 0.5

## Modified Functions
- `calculate_assessment_scores`: now computes four behavioral readiness driver
  scores and stores them in `result_snapshot.behavioral_readiness` as a JSON object.
  Existing overall and section scores are NOT changed.

## Security
- RLS enabled on `assessment_question_driver_mappings`.
- Select allowed for authenticated users (brokers/admins need to read mappings for reports).
- Insert/update/delete restricted to admins only.

## Data
- Populates driver mappings for the Propel Well-being Opportunity Index v1.0
  (assessment_version_id = '20e8137a-7254-4376-930d-84951efbb68f') for all 25 scored questions.
*/

-- ============================================================
-- 1. Create driver mappings table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.assessment_question_driver_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_version_id uuid NOT NULL REFERENCES public.assessment_versions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
  driver_key text NOT NULL CHECK (
    driver_key IN (
      'clarity_of_value',
      'motivation_overcoming_inertia',
      'trust_social_proof',
      'structural_environmental_friction'
    )
  ),
  mapping_weight numeric NOT NULL DEFAULT 1.0 CHECK (mapping_weight > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aqdm_version ON public.assessment_question_driver_mappings(assessment_version_id);
CREATE INDEX IF NOT EXISTS idx_aqdm_question ON public.assessment_question_driver_mappings(question_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_aqdm_version_question_driver ON public.assessment_question_driver_mappings(assessment_version_id, question_id, driver_key);

ALTER TABLE public.assessment_question_driver_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aqdm_select_authenticated" ON public.assessment_question_driver_mappings;
CREATE POLICY "aqdm_select_authenticated" ON public.assessment_question_driver_mappings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "aqdm_insert_admin" ON public.assessment_question_driver_mappings;
CREATE POLICY "aqdm_insert_admin" ON public.assessment_question_driver_mappings
  FOR INSERT TO authenticated WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS "aqdm_update_admin" ON public.assessment_question_driver_mappings;
CREATE POLICY "aqdm_update_admin" ON public.assessment_question_driver_mappings
  FOR UPDATE TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS "aqdm_delete_admin" ON public.assessment_question_driver_mappings;
CREATE POLICY "aqdm_delete_admin" ON public.assessment_question_driver_mappings
  FOR DELETE TO authenticated USING (public.is_active_admin());

-- ============================================================
-- 2. Populate driver mappings for Propel v1.0
-- ============================================================

INSERT INTO public.assessment_question_driver_mappings (assessment_version_id, question_id, driver_key, mapping_weight) VALUES
  ('20e8137a-7254-4376-930d-84951efbb68f', 'b607275f-9953-40f0-8655-87193a32a214', 'clarity_of_value', 1.0),
  ('20e8137a-7254-4376-930d-84951efbb68f', 'bb85bf50-71d5-4bfb-b766-b45ec4761488', 'clarity_of_value', 1.0),
  ('20e8137a-7254-4376-930d-84951efbb68f', 'bb85bf50-71d5-4bfb-b766-b45ec4761488', 'trust_social_proof', 0.5),
  ('20e8137a-7254-4376-930d-84951efbb68f', 'e83b9416-b640-4add-bcb8-5a05de3bb061', 'trust_social_proof', 1.0),
  ('20e8137a-7254-4376-930d-84951efbb68f', 'e83b9416-b640-4add-bcb8-5a05de3bb061', 'motivation_overcoming_inertia', 0.5),
  ('20e8137a-7254-4376-930d-84951efbb68f', '936de9ad-c07f-4614-9598-48ac6a5ccf3a', 'structural_environmental_friction', 1.0),
  ('20e8137a-7254-4376-930d-84951efbb68f', '936de9ad-c07f-4614-9598-48ac6a5ccf3a', 'clarity_of_value', 0.5),
  ('20e8137a-7254-4376-930d-84951efbb68f', '5781b10e-9875-48e6-9979-83bbde41a75d', 'clarity_of_value', 1.0),
  ('20e8137a-7254-4376-930d-84951efbb68f', '5781b10e-9875-48e6-9979-83bbde41a75d', 'trust_social_proof', 0.5),
  ('20e8137a-7254-4376-930d-84951efbb68f', '9f13e00f-01bd-4239-86c5-5785d73ba11b', 'clarity_of_value', 1.0),
  ('20e8137a-7254-4376-930d-84951efbb68f', '9f13e00f-01bd-4239-86c5-5785d73ba11b', 'motivation_overcoming_inertia', 0.5),
  ('20e8137a-7254-4376-930d-84951efbb68f', '8f2cf9b5-eeba-45b8-b688-5f6f35ea80ec', 'motivation_overcoming_inertia', 1.0),
  ('20e8137a-7254-4376-930d-84951efbb68f', '8bf13e35-6905-43b2-b1b2-c61f77c6f762', 'clarity_of_value', 1.0),
  ('20e8137a-7254-4376-930d-84951efbb68f', '0ecfe3fa-291c-47e2-97a8-4b4c6fc2e2b8', 'clarity_of_value', 1.0),
  ('20e8137a-7254-4376-930d-84951efbb68f', '0ecfe3fa-291c-47e2-97a8-4b4c6fc2e2b8', 'structural_environmental_friction', 0.5),
  ('20e8137a-7254-4376-930d-84951efbb68f', '12e51354-98f0-4b17-aee6-fc0a9ad4750f', 'clarity_of_value', 1.0),
  ('20e8137a-7254-4376-930d-84951efbb68f', '12e51354-98f0-4b17-aee6-fc0a9ad4750f', 'motivation_overcoming_inertia', 0.5),
  ('20e8137a-7254-4376-930d-84951efbb68f', '4374ffe3-ec44-4d98-8847-138b7f010604', 'clarity_of_value', 1.0),
  ('20e8137a-7254-4376-930d-84951efbb68f', '4374ffe3-ec44-4d98-8847-138b7f010604', 'trust_social_proof', 0.5),
  ('20e8137a-7254-4376-930d-84951efbb68f', '0bd5c704-e946-43e4-9149-ee529a1a9ae2', 'motivation_overcoming_inertia', 1.0),
  ('20e8137a-7254-4376-930d-84951efbb68f', 'e8829cdb-c2fd-4733-aa82-1b81790ae4a0', 'clarity_of_value', 1.0),
  ('20e8137a-7254-4376-930d-84951efbb68f', 'e8829cdb-c2fd-4733-aa82-1b81790ae4a0', 'motivation_overcoming_inertia', 0.5),
  ('20e8137a-7254-4376-930d-84951efbb68f', 'f9173f4d-5daa-42bd-9382-19b5fae89be6', 'clarity_of_value', 1.0),
  ('20e8137a-7254-4376-930d-84951efbb68f', 'f9173f4d-5daa-42bd-9382-19b5fae89be6', 'structural_environmental_friction', 0.5),
  ('20e8137a-7254-4376-930d-84951efbb68f', 'ba390172-3a12-4116-8ea6-78f276f2b477', 'structural_environmental_friction', 1.0),
  ('20e8137a-7254-4376-930d-84951efbb68f', 'ba390172-3a12-4116-8ea6-78f276f2b477', 'clarity_of_value', 0.5),
  ('20e8137a-7254-4376-930d-84951efbb68f', 'b3806f95-a60a-4399-9cfe-082c39a69bd6', 'structural_environmental_friction', 1.0),
  ('20e8137a-7254-4376-930d-84951efbb68f', '9fefa313-7557-4b23-b35b-da70306d40f3', 'structural_environmental_friction', 1.0),
  ('20e8137a-7254-4376-930d-84951efbb68f', '9fefa313-7557-4b23-b35b-da70306d40f3', 'trust_social_proof', 0.5),
  ('20e8137a-7254-4376-930d-84951efbb68f', 'a8795f54-b19f-4c22-b0a5-486784556701', 'trust_social_proof', 1.0),
  ('20e8137a-7254-4376-930d-84951efbb68f', 'a8795f54-b19f-4c22-b0a5-486784556701', 'motivation_overcoming_inertia', 0.5),
  ('20e8137a-7254-4376-930d-84951efbb68f', '0951228e-f5d0-4c6a-9976-20e551f5c6cc', 'trust_social_proof', 1.0),
  ('20e8137a-7254-4376-930d-84951efbb68f', '7963cb35-8ba8-4bee-8e42-437b9488d15e', 'trust_social_proof', 1.0),
  ('20e8137a-7254-4376-930d-84951efbb68f', '8fed70e9-ffa7-4248-8ba7-65e5f172db49', 'structural_environmental_friction', 1.0),
  ('20e8137a-7254-4376-930d-84951efbb68f', '8fed70e9-ffa7-4248-8ba7-65e5f172db49', 'trust_social_proof', 0.5),
  ('20e8137a-7254-4376-930d-84951efbb68f', '8b28d4b5-2fb7-40e2-8172-3e4b0a522c53', 'clarity_of_value', 1.0),
  ('20e8137a-7254-4376-930d-84951efbb68f', '71b4c0f2-fd46-42c0-b326-157ceb4f3374', 'clarity_of_value', 1.0),
  ('20e8137a-7254-4376-930d-84951efbb68f', '71b4c0f2-fd46-42c0-b326-157ceb4f3374', 'structural_environmental_friction', 0.5),
  ('20e8137a-7254-4376-930d-84951efbb68f', '1a45502b-2857-41eb-b34a-6bc703eb2051', 'clarity_of_value', 1.0),
  ('20e8137a-7254-4376-930d-84951efbb68f', '1a45502b-2857-41eb-b34a-6bc703eb2051', 'trust_social_proof', 0.5),
  ('20e8137a-7254-4376-930d-84951efbb68f', '31a16f0a-f2ef-4621-97a5-d9301c9bbe3a', 'motivation_overcoming_inertia', 1.0),
  ('20e8137a-7254-4376-930d-84951efbb68f', '31a16f0a-f2ef-4621-97a5-d9301c9bbe3a', 'clarity_of_value', 0.5)
ON CONFLICT (assessment_version_id, question_id, driver_key) DO NOTHING;

-- ============================================================
-- 3. Update calculate_assessment_scores to compute behavioral readiness
-- ============================================================

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

  IF NOT (is_instance_owner(p_instance_id) OR is_active_admin()) THEN
    RAISE EXCEPTION 'Not authorized to score this assessment';
  END IF;

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
      WHERE assessment_section_id = v_section.id AND is_scored = true
      ORDER BY display_order
    LOOP
      v_possible_count := v_possible_count + 1;

      SELECT * INTO v_response FROM assessment_responses
      WHERE assessment_instance_id = p_instance_id AND question_id = v_question.id;

      IF NOT FOUND THEN
        IF NOT v_question.is_required THEN
          CONTINUE;
        END IF;
        v_question_norm := 0;
      ELSE
        IF v_response.selected_option_id IS NOT NULL THEN
          SELECT * INTO v_option FROM assessment_question_options WHERE id = v_response.selected_option_id;
          IF v_option.is_not_applicable THEN
            CONTINUE;
          END IF;
        END IF;

        v_answered_count := v_answered_count + 1;

        SELECT COALESCE(MIN(score_value), 0), COALESCE(MAX(score_value), 0)
        INTO v_min_score, v_max_score
        FROM assessment_question_options
        WHERE question_id = v_question.id AND is_not_applicable = false;

        IF v_max_score = v_min_score THEN
          v_question_norm := CASE WHEN v_response.score_value IS NOT NULL THEN 100 ELSE 0 END;
        ELSE
          v_question_norm := (COALESCE(v_response.score_value, v_min_score) - v_min_score) / (v_max_score - v_min_score) * 100;
          IF v_question.reverse_scored THEN
            v_question_norm := 100 - v_question_norm;
          END IF;
        END IF;
      END IF;

      v_question_norm := LEAST(100, GREATEST(0, v_question_norm));
      v_section_weighted_sum := v_section_weighted_sum + (v_question_norm * v_question.weight);
      v_section_weight_sum := v_section_weight_sum + v_question.weight;
    END LOOP;

    IF v_section_weight_sum > 0 THEN
      v_section_norm := v_section_weighted_sum / v_section_weight_sum;
    ELSE
      v_section_norm := 0;
    END IF;

    v_section_norm := LEAST(100, GREATEST(0, v_section_norm));

    INSERT INTO assessment_section_scores
    (assessment_instance_id, section_id, raw_score, normalized_score, answered_question_count, possible_question_count)
    VALUES (p_instance_id, v_section.id, v_section_norm, v_section_norm, v_answered_count, v_possible_count)
    ON CONFLICT (assessment_instance_id, section_id)
    DO UPDATE SET
      raw_score = EXCLUDED.raw_score,
      normalized_score = EXCLUDED.normalized_score,
      answered_question_count = EXCLUDED.answered_question_count,
      possible_question_count = EXCLUDED.possible_question_count;

    v_overall_weighted_sum := v_overall_weighted_sum + (v_section_norm * v_section.weight);
    v_overall_weight_sum := v_overall_weight_sum + v_section.weight;
  END LOOP;

  IF v_overall_weight_sum > 0 THEN
    v_overall_norm := v_overall_weighted_sum / v_overall_weight_sum;
  ELSE
    v_overall_norm := 0;
  END IF;

  v_overall_norm := LEAST(100, GREATEST(0, v_overall_norm));

  SELECT band_name INTO v_score_band
  FROM (
    SELECT band_name, min_threshold, max_threshold, display_order
    FROM assessment_score_bands WHERE assessment_version_id = v_version_id
    UNION ALL
    SELECT 'Reactive', 0, 39, 1 WHERE NOT EXISTS (SELECT 1 FROM assessment_score_bands WHERE assessment_version_id = v_version_id)
    UNION ALL
    SELECT 'Developing', 40, 59, 2 WHERE NOT EXISTS (SELECT 1 FROM assessment_score_bands WHERE assessment_version_id = v_version_id)
    UNION ALL
    SELECT 'Established', 60, 74, 3 WHERE NOT EXISTS (SELECT 1 FROM assessment_score_bands WHERE assessment_version_id = v_version_id)
    UNION ALL
    SELECT 'Strategic', 75, 89, 4 WHERE NOT EXISTS (SELECT 1 FROM assessment_score_bands WHERE assessment_version_id = v_version_id)
    UNION ALL
    SELECT 'Leading', 90, 100, 5 WHERE NOT EXISTS (SELECT 1 FROM assessment_score_bands WHERE assessment_version_id = v_version_id)
  ) bands
  WHERE v_overall_norm >= min_threshold AND v_overall_norm <= max_threshold
  ORDER BY display_order LIMIT 1;

  -- Compute behavioral readiness scores
  v_behavioral := jsonb_build_object();

  FOR v_driver_key IN
    SELECT DISTINCT driver_key FROM assessment_question_driver_mappings
    WHERE assessment_version_id = v_version_id
  LOOP
    v_driver_weighted_sum := 0;
    v_driver_weight_sum := 0;

    FOR v_driver_mapping IN
      SELECT m.question_id, m.mapping_weight, q.is_required, q.reverse_scored
      FROM assessment_question_driver_mappings m
      JOIN assessment_questions q ON q.id = m.question_id
      WHERE m.assessment_version_id = v_version_id AND m.driver_key = v_driver_key
    LOOP
      SELECT * INTO v_response FROM assessment_responses
      WHERE assessment_instance_id = p_instance_id AND question_id = v_driver_mapping.question_id;

      IF NOT FOUND THEN
        IF NOT v_driver_mapping.is_required THEN
          CONTINUE;
        END IF;
        v_question_norm := 0;
      ELSE
        IF v_response.selected_option_id IS NOT NULL THEN
          SELECT * INTO v_option FROM assessment_question_options WHERE id = v_response.selected_option_id;
          IF v_option.is_not_applicable THEN
            CONTINUE;
          END IF;
        END IF;

        SELECT COALESCE(MIN(score_value), 0), COALESCE(MAX(score_value), 0)
        INTO v_min_score, v_max_score
        FROM assessment_question_options
        WHERE question_id = v_driver_mapping.question_id AND is_not_applicable = false;

        IF v_max_score = v_min_score THEN
          v_question_norm := CASE WHEN v_response.score_value IS NOT NULL THEN 100 ELSE 0 END;
        ELSE
          v_question_norm := (COALESCE(v_response.score_value, v_min_score) - v_min_score) / (v_max_score - v_min_score) * 100;
          IF v_driver_mapping.reverse_scored THEN
            v_question_norm := 100 - v_question_norm;
          END IF;
        END IF;
      END IF;

      v_question_norm := LEAST(100, GREATEST(0, v_question_norm));
      v_driver_weighted_sum := v_driver_weighted_sum + (v_question_norm * v_driver_mapping.mapping_weight);
      v_driver_weight_sum := v_driver_weight_sum + v_driver_mapping.mapping_weight;
    END LOOP;

    IF v_driver_weight_sum > 0 THEN
      v_behavioral := v_behavioral || jsonb_build_object(v_driver_key, LEAST(100, GREATEST(0, v_driver_weighted_sum / v_driver_weight_sum)));
    ELSE
      v_behavioral := v_behavioral || jsonb_build_object(v_driver_key, 0);
    END IF;
  END LOOP;

  INSERT INTO assessment_results
  (assessment_instance_id, raw_score, normalized_score, score_band, completed_at, scoring_version, result_snapshot)
  VALUES (p_instance_id, v_overall_norm, v_overall_norm, v_score_band, now(), '1.1',
    jsonb_build_object('overall_score', v_overall_norm, 'score_band', v_score_band, 'behavioral_readiness', v_behavioral, 'computed_at', now()::text))
  ON CONFLICT (assessment_instance_id)
  DO UPDATE SET
    raw_score = EXCLUDED.raw_score,
    normalized_score = EXCLUDED.normalized_score,
    score_band = EXCLUDED.score_band,
    completed_at = EXCLUDED.completed_at,
    result_snapshot = EXCLUDED.result_snapshot,
    updated_at = now()
  RETURNING * INTO v_result;

  UPDATE assessment_instances
  SET overall_score = v_overall_norm, primary_opportunity = v_score_band
  WHERE id = p_instance_id;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.calculate_assessment_scores(uuid) TO authenticated;

-- ============================================================
-- 4. Backfill behavioral readiness for existing finalized results
-- ============================================================

DO $$
DECLARE
  v_result record;
  v_version_id uuid;
  v_driver_key text;
  v_driver_weighted_sum numeric;
  v_driver_weight_sum numeric;
  v_question_norm numeric;
  v_response assessment_responses%ROWTYPE;
  v_option assessment_question_options%ROWTYPE;
  v_mapping record;
  v_min_score numeric;
  v_max_score numeric;
  v_behavioral jsonb;
  v_existing_snapshot jsonb;
BEGIN
  FOR v_result IN
    SELECT r.assessment_instance_id, r.result_snapshot, i.assessment_version_id
    FROM assessment_results r
    JOIN assessment_instances i ON i.id = r.assessment_instance_id
    WHERE r.result_snapshot IS NOT NULL
      AND NOT (r.result_snapshot ? 'behavioral_readiness')
      AND EXISTS (
        SELECT 1 FROM assessment_question_driver_mappings m
        WHERE m.assessment_version_id = i.assessment_version_id
      )
  LOOP
    v_version_id := v_result.assessment_version_id;
    v_behavioral := jsonb_build_object();

    FOR v_driver_key IN
      SELECT DISTINCT driver_key FROM assessment_question_driver_mappings
      WHERE assessment_version_id = v_version_id
    LOOP
      v_driver_weighted_sum := 0;
      v_driver_weight_sum := 0;

      FOR v_mapping IN
        SELECT m.question_id, m.mapping_weight, q.is_required, q.reverse_scored
        FROM assessment_question_driver_mappings m
        JOIN assessment_questions q ON q.id = m.question_id
        WHERE m.assessment_version_id = v_version_id AND m.driver_key = v_driver_key
      LOOP
        SELECT * INTO v_response FROM assessment_responses
        WHERE assessment_instance_id = v_result.assessment_instance_id
        AND question_id = v_mapping.question_id;

        IF NOT FOUND THEN
          IF NOT v_mapping.is_required THEN
            CONTINUE;
          END IF;
          v_question_norm := 0;
        ELSE
          IF v_response.selected_option_id IS NOT NULL THEN
            SELECT * INTO v_option FROM assessment_question_options WHERE id = v_response.selected_option_id;
            IF v_option.is_not_applicable THEN
              CONTINUE;
            END IF;
          END IF;

          SELECT COALESCE(MIN(score_value), 0), COALESCE(MAX(score_value), 0)
          INTO v_min_score, v_max_score
          FROM assessment_question_options
          WHERE question_id = v_mapping.question_id AND is_not_applicable = false;

          IF v_max_score = v_min_score THEN
            v_question_norm := CASE WHEN v_response.score_value IS NOT NULL THEN 100 ELSE 0 END;
          ELSE
            v_question_norm := (COALESCE(v_response.score_value, v_min_score) - v_min_score) / (v_max_score - v_min_score) * 100;
            IF v_mapping.reverse_scored THEN
              v_question_norm := 100 - v_question_norm;
            END IF;
          END IF;
        END IF;

        v_question_norm := LEAST(100, GREATEST(0, v_question_norm));
        v_driver_weighted_sum := v_driver_weighted_sum + (v_question_norm * v_mapping.mapping_weight);
        v_driver_weight_sum := v_driver_weight_sum + v_mapping.mapping_weight;
      END LOOP;

      IF v_driver_weight_sum > 0 THEN
        v_behavioral := v_behavioral || jsonb_build_object(v_driver_key, LEAST(100, GREATEST(0, v_driver_weighted_sum / v_driver_weight_sum)));
      ELSE
        v_behavioral := v_behavioral || jsonb_build_object(v_driver_key, 0);
      END IF;
    END LOOP;

    v_existing_snapshot := v_result.result_snapshot || jsonb_build_object('behavioral_readiness', v_behavioral);

    UPDATE assessment_results
    SET result_snapshot = v_existing_snapshot, updated_at = now()
    WHERE assessment_instance_id = v_result.assessment_instance_id;
  END LOOP;
END $$;
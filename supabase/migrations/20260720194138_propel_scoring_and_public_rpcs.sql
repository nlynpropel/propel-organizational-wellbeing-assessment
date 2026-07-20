/*
# Server-side scoring function + public token lookup RPCs

1. Purpose
- `calculate_assessment_scores(p_instance_id)`: SECURITY DEFINER function that
  computes section and overall normalized scores for an assessment instance,
  inserts/updates assessment_section_scores and assessment_results, and returns
  the result row. This is the single source of truth for scoring — the browser
  may display scores but never authoritatively compute them.
- `resolve_assessment_by_token(p_token)`: SECURITY DEFINER function for public
  respondents. Given a secure_token (uuid), returns the assessment instance +
  version + sections + questions + options as a single JSON payload. This lets
  a respondent see and answer their assessment WITHOUT any direct table access
  to assessment_templates, assessment_versions, etc.
- `submit_assessment_response(p_token, p_question_id, p_selected_option_id,
  p_numeric_value, p_text_value, p_boolean_value)`: SECURITY DEFINER function
  for public respondents to submit a single response. Validates the token,
  checks the instance is not submitted/expired/revoked, and upserts the response.

2. Scoring Methodology
- Per-question normalized score = (answer_score - min_possible) / (max_possible - min_possible) * 100
- Reverse-scored: 100 - normalized
- Section score = sum(question_norm * question_weight) / sum(answered_question_weights)
- Overall score = sum(section_norm * section_weight) / sum(answered_section_weights)
- Unanswered optional questions excluded from denominator
- N/A responses excluded from denominator when is_not_applicable = true
- Division-by-zero returns 0
- Scores stored as numeric (unrounded); display rounds to whole numbers

3. Score Bands
- Default: 0-39 Reactive, 40-59 Developing, 60-74 Established, 75-89 Strategic, 90-100 Leading
- If assessment_score_bands rows exist for the version, those override defaults.

4. Security
- All three functions are SECURITY DEFINER so they bypass RLS.
- calculate_assessment_scores validates is_instance_owner or is_active_admin.
- resolve_assessment_by_token and submit_assessment_response validate by token only
  (no auth required) — this is the public respondent access path.
- Public respondents never get direct table grants.

5. Idempotent
- CREATE OR REPLACE FUNCTION for all.
*/

-- ============================================================
-- calculate_assessment_scores
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_assessment_scores(p_instance_id uuid)
RETURNS public.assessment_results
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
BEGIN
  -- Load instance
  SELECT * INTO v_instance FROM assessment_instances WHERE id = p_instance_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assessment instance not found';
  END IF;

  -- Authorization: must be instance owner or admin
  IF NOT (is_instance_owner(p_instance_id) OR is_active_admin()) THEN
    RAISE EXCEPTION 'Not authorized to score this assessment';
  END IF;

  v_version_id := v_instance.assessment_version_id;
  v_template_id := v_instance.assessment_template_id;

  -- Process each scored section
  FOR v_section IN
    SELECT * FROM assessment_sections
    WHERE assessment_version_id = v_version_id
    AND is_scored = true
    ORDER BY display_order
  LOOP
    v_section_raw := 0;
    v_section_weighted_sum := 0;
    v_section_weight_sum := 0;
    v_answered_count := 0;
    v_possible_count := 0;

    -- Process each scored question in this section
    FOR v_question IN
      SELECT * FROM assessment_questions
      WHERE assessment_section_id = v_section.id
      AND is_scored = true
      ORDER BY display_order
    LOOP
      v_possible_count := v_possible_count + 1;

      -- Load the response for this question
      SELECT * INTO v_response FROM assessment_responses
      WHERE assessment_instance_id = p_instance_id AND question_id = v_question.id;

      IF NOT FOUND THEN
        -- Unanswered optional question: skip from denominator
        IF NOT v_question.is_required THEN
          CONTINUE;
        END IF;
        -- Unanswered required: score as 0 but include in denominator
        v_question_norm := 0;
      ELSE
        -- Check if N/A response
        IF v_response.selected_option_id IS NOT NULL THEN
          SELECT * INTO v_option FROM assessment_question_options WHERE id = v_response.selected_option_id;
          IF v_option.is_not_applicable THEN
            -- N/A: exclude from denominator
            CONTINUE;
          END IF;
        END IF;

        v_answered_count := v_answered_count + 1;

        -- Compute min/max possible scores for this question
        SELECT
          COALESCE(MIN(score_value), 0),
          COALESCE(MAX(score_value), 0)
        INTO v_min_score, v_max_score
        FROM assessment_question_options
        WHERE question_id = v_question.id
          AND is_not_applicable = false;

        IF v_max_score = v_min_score THEN
          -- No range: score is 100 if answered, 0 if not
          v_question_norm := CASE WHEN v_response.score_value IS NOT NULL THEN 100 ELSE 0 END;
        ELSE
          -- Normalize: (score - min) / (max - min) * 100
          v_question_norm := (
            COALESCE(v_response.score_value, v_min_score) - v_min_score
          ) / (v_max_score - v_min_score) * 100;

          -- Reverse scoring
          IF v_question.reverse_scored THEN
            v_question_norm := 100 - v_question_norm;
          END IF;
        END IF;
      END IF;

      -- Clamp to 0-100
      v_question_norm := LEAST(100, GREATEST(0, v_question_norm));

      v_section_weighted_sum := v_section_weighted_sum + (v_question_norm * v_question.weight);
      v_section_weight_sum := v_section_weight_sum + v_question.weight;
    END LOOP;

    -- Section normalized score
    IF v_section_weight_sum > 0 THEN
      v_section_norm := v_section_weighted_sum / v_section_weight_sum;
    ELSE
      v_section_norm := 0;
    END IF;

    v_section_norm := LEAST(100, GREATEST(0, v_section_norm));

    -- Upsert section score
    INSERT INTO assessment_section_scores
      (assessment_instance_id, section_id, raw_score, normalized_score,
       answered_question_count, possible_question_count)
    VALUES
      (p_instance_id, v_section.id, v_section_norm, v_section_norm,
       v_answered_count, v_possible_count)
    ON CONFLICT (assessment_instance_id, section_id)
    DO UPDATE SET
      raw_score = EXCLUDED.raw_score,
      normalized_score = EXCLUDED.normalized_score,
      answered_question_count = EXCLUDED.answered_question_count,
      possible_question_count = EXCLUDED.possible_question_count;

    -- Accumulate overall
    v_overall_weighted_sum := v_overall_weighted_sum + (v_section_norm * v_section.weight);
    v_overall_weight_sum := v_overall_weight_sum + v_section.weight;
  END LOOP;

  -- Overall normalized score
  IF v_overall_weight_sum > 0 THEN
    v_overall_norm := v_overall_weighted_sum / v_overall_weight_sum;
  ELSE
    v_overall_norm := 0;
  END IF;

  v_overall_norm := LEAST(100, GREATEST(0, v_overall_norm));

  -- Determine score band
  SELECT band_name INTO v_score_band
  FROM (
    -- Custom bands for this version
    SELECT band_name, min_threshold, max_threshold, display_order
    FROM assessment_score_bands
    WHERE assessment_version_id = v_version_id
    UNION ALL
    -- Default bands
    SELECT 'Reactive', 0, 39, 1
    WHERE NOT EXISTS (SELECT 1 FROM assessment_score_bands WHERE assessment_version_id = v_version_id)
    UNION ALL
    SELECT 'Developing', 40, 59, 2
    WHERE NOT EXISTS (SELECT 1 FROM assessment_score_bands WHERE assessment_version_id = v_version_id)
    UNION ALL
    SELECT 'Established', 60, 74, 3
    WHERE NOT EXISTS (SELECT 1 FROM assessment_score_bands WHERE assessment_version_id = v_version_id)
    UNION ALL
    SELECT 'Strategic', 75, 89, 4
    WHERE NOT EXISTS (SELECT 1 FROM assessment_score_bands WHERE assessment_version_id = v_version_id)
    UNION ALL
    SELECT 'Leading', 90, 100, 5
    WHERE NOT EXISTS (SELECT 1 FROM assessment_score_bands WHERE assessment_version_id = v_version_id)
  ) bands
  WHERE v_overall_norm >= min_threshold AND v_overall_norm <= max_threshold
  ORDER BY display_order
  LIMIT 1;

  -- Upsert result
  INSERT INTO assessment_results
    (assessment_instance_id, raw_score, normalized_score, score_band,
     completed_at, scoring_version, result_snapshot)
  VALUES
    (p_instance_id, v_overall_norm, v_overall_norm, v_score_band,
     now(), '1.0', jsonb_build_object(
       'overall_score', v_overall_norm,
       'score_band', v_score_band,
       'computed_at', now()::text
     ))
  ON CONFLICT (assessment_instance_id)
  DO UPDATE SET
    raw_score = EXCLUDED.raw_score,
    normalized_score = EXCLUDED.normalized_score,
    score_band = EXCLUDED.score_band,
    completed_at = EXCLUDED.completed_at,
    result_snapshot = EXCLUDED.result_snapshot,
    updated_at = now()
  RETURNING * INTO v_result;

  -- Update instance overall_score
  UPDATE assessment_instances
  SET overall_score = v_overall_norm,
      primary_opportunity = v_score_band
  WHERE id = p_instance_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION calculate_assessment_scores(uuid) TO authenticated;

-- ============================================================
-- resolve_assessment_by_token
-- Public respondent lookup: returns instance + questionnaire as JSON
-- ============================================================
CREATE OR REPLACE FUNCTION resolve_assessment_by_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instance assessment_instances%ROWTYPE;
  v_version assessment_versions%ROWTYPE;
  v_template assessment_templates%ROWTYPE;
  v_result jsonb;
BEGIN
  -- Find the instance by secure token
  SELECT * INTO v_instance FROM assessment_instances WHERE secure_token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invalid or expired assessment link');
  END IF;

  -- Check instance status
  IF v_instance.status IN ('submitted', 'expired', 'revoked') THEN
    RETURN jsonb_build_object('error', 'This assessment is no longer available',
      'status', v_instance.status);
  END IF;

  -- Load version
  SELECT * INTO v_version FROM assessment_versions WHERE id = v_instance.assessment_version_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Assessment version not found');
  END IF;

  -- Load template (only public fields)
  SELECT
    id, name, short_description, full_description, category,
    estimated_minutes, scoring_enabled, recommendations_enabled
  INTO v_template FROM assessment_templates WHERE id = v_instance.assessment_template_id;

  -- Build the questionnaire payload
  SELECT jsonb_build_object(
    'instance', jsonb_build_object(
      'id', v_instance.id,
      'status', v_instance.status,
      'respondent_name', v_instance.respondent_name,
      'respondent_email', v_instance.respondent_email,
      'expires_at', v_instance.expires_at,
      'broker_message', v_instance.broker_message
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
      'show_overall_score', v_version.show_overall_score
    ),
    'sections', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id,
        'title', s.title,
        'description', s.description,
        'display_order', s.display_order,
        'is_scored', s.is_scored,
        'questions', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', q.id,
            'question_text', q.question_text,
            'help_text', q.help_text,
            'question_type', q.question_type,
            'display_order', q.display_order,
            'is_required', q.is_required,
            'is_scored', q.is_scored,
            'reporting_label', q.reporting_label,
            'options', COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'id', o.id,
                'option_label', o.option_label,
                'option_value', o.option_value,
                'display_order', o.display_order,
                'is_not_applicable', o.is_not_applicable
              ) ORDER BY o.display_order)
              FROM assessment_question_options o
              WHERE o.question_id = q.id
            ), '[]'::jsonb)
          ) ORDER BY q.display_order)
          FROM assessment_questions q
          WHERE q.assessment_section_id = s.id
        ), '[]'::jsonb)
      ) ORDER BY s.display_order)
      FROM assessment_sections s
      WHERE s.assessment_version_id = v_version.id
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_assessment_by_token(uuid) TO anon, authenticated;

-- ============================================================
-- submit_assessment_response
-- Public respondent response submission
-- ============================================================
CREATE OR REPLACE FUNCTION submit_assessment_response(
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
SET search_path = public
AS $$
DECLARE
  v_instance assessment_instances%ROWTYPE;
  v_question assessment_questions%ROWTYPE;
  v_option assessment_question_options%ROWTYPE;
  v_score numeric;
BEGIN
  -- Find instance by token
  SELECT * INTO v_instance FROM assessment_instances WHERE secure_token = p_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid assessment link';
  END IF;

  -- Check status
  IF v_instance.status IN ('submitted', 'expired', 'revoked') THEN
    RAISE EXCEPTION 'This assessment is no longer accepting responses';
  END IF;

  -- Validate question belongs to this instance's version
  SELECT * INTO v_question FROM assessment_questions
  WHERE id = p_question_id AND assessment_version_id = v_instance.assessment_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question not found in this assessment';
  END IF;

  -- If option selected, validate it belongs to the question and get score
  IF p_selected_option_id IS NOT NULL THEN
    SELECT * INTO v_option FROM assessment_question_options
    WHERE id = p_selected_option_id AND question_id = p_question_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid option for this question';
    END IF;
    v_score := v_option.score_value;
  ELSE
    v_score := p_numeric_value;
  END IF;

  -- Upsert response
  INSERT INTO assessment_responses
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

  -- Update instance status to in_progress if it was just opened
  IF v_instance.status IN ('sent', 'not_opened', 'opened') THEN
    UPDATE assessment_instances
    SET status = 'in_progress', started_at = COALESCE(started_at, now())
    WHERE id = v_instance.id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION submit_assessment_response(uuid, uuid, uuid, numeric, text, boolean) TO anon, authenticated;

-- ============================================================
-- finalize_assessment_submission
-- Marks an instance as submitted and computes final scores
-- ============================================================
CREATE OR REPLACE FUNCTION finalize_assessment_submission(p_token uuid)
RETURNS public.assessment_results
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Check all required questions are answered
  SELECT COUNT(*) INTO v_required_unanswered
  FROM assessment_questions q
  WHERE q.assessment_version_id = v_instance.assessment_version_id
    AND q.is_required = true
    AND NOT EXISTS (
      SELECT 1 FROM assessment_responses r
      WHERE r.question_id = q.id AND r.assessment_instance_id = v_instance.id
    );

  IF v_required_unanswered > 0 THEN
    RAISE EXCEPTION 'Please answer all required questions (% remaining)', v_required_unanswered;
  END IF;

  -- Calculate scores
  v_result := calculate_assessment_scores(v_instance.id);

  -- Mark as submitted
  UPDATE assessment_instances
  SET status = 'submitted', submitted_at = now(), overall_score = v_result.normalized_score
  WHERE id = v_instance.id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION finalize_assessment_submission(uuid) TO anon, authenticated;

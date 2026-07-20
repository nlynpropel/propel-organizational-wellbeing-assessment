/*
# Final hardening: configurable numeric_rating, visibility immutability, RPC hardening

1. Numeric rating configuration (additive)
- Add 5 columns to assessment_questions for numeric_rating range config.
- CHECK constraints: maximum > minimum, step > 0.
- Safe defaults: min=1, max=10, step=1, labels NULL.

2. Respondent result visibility immutability
- Add the 4 respondent visibility columns to the published-version immutability trigger
  so they cannot be changed on a published version.

3. RPC hardening
- resolve_assessment_by_token: remove is_scored (sections+questions), reporting_label;
  add numeric_rating config fields; keep search_path = public.
- submit_assessment_response: validate numeric_rating values against configured range
  and step alignment; reject after submission; reject cross-question/version options.
- All SECURITY DEFINER functions already set search_path = public and use qualified table
  references via %ROWTYPE. Explicitly qualify all table names in raw SQL.

4. Idempotent: CREATE OR REPLACE for functions; DO $$ for column additions.
*/

-- ============================================================
-- Add numeric_rating configuration columns to assessment_questions
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assessment_questions' AND column_name = 'numeric_rating_min_value'
  ) THEN
    ALTER TABLE assessment_questions ADD COLUMN numeric_rating_min_value numeric NOT NULL DEFAULT 1;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assessment_questions' AND column_name = 'numeric_rating_max_value'
  ) THEN
    ALTER TABLE assessment_questions ADD COLUMN numeric_rating_max_value numeric NOT NULL DEFAULT 10;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assessment_questions' AND column_name = 'numeric_rating_step_value'
  ) THEN
    ALTER TABLE assessment_questions ADD COLUMN numeric_rating_step_value numeric NOT NULL DEFAULT 1;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assessment_questions' AND column_name = 'numeric_rating_min_label'
  ) THEN
    ALTER TABLE assessment_questions ADD COLUMN numeric_rating_min_label text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assessment_questions' AND column_name = 'numeric_rating_max_label'
  ) THEN
    ALTER TABLE assessment_questions ADD COLUMN numeric_rating_max_label text;
  END IF;
END $$;

-- CHECK constraints for numeric_rating configuration
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_numeric_rating_max_gt_min'
  ) THEN
    ALTER TABLE assessment_questions ADD CONSTRAINT chk_numeric_rating_max_gt_min
      CHECK (numeric_rating_max_value > numeric_rating_min_value);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_numeric_rating_step_positive'
  ) THEN
    ALTER TABLE assessment_questions ADD CONSTRAINT chk_numeric_rating_step_positive
      CHECK (numeric_rating_step_value > 0);
  END IF;
END $$;

-- ============================================================
-- Update immutability trigger to protect respondent visibility columns
-- ============================================================
CREATE OR REPLACE FUNCTION protect_published_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_retiring boolean;
BEGIN
  v_retiring := COALESCE(current_setting('retire_version_in_progress', true), 'false') = 'true';

  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'published' THEN
      RAISE EXCEPTION 'Cannot delete a published assessment version. Create a new version or retire it instead.';
    END IF;
    RETURN OLD;
  END IF;

  -- TG_OP = 'UPDATE'
  IF OLD.status = 'published' THEN
    IF v_retiring AND NEW.status = 'retired' THEN
      RETURN NEW;
    END IF;

    IF
      NEW.name IS DISTINCT FROM OLD.name
      OR NEW.version_number IS DISTINCT FROM OLD.version_number
      OR NEW.version_label IS DISTINCT FROM OLD.version_label
      OR NEW.introduction_text IS DISTINCT FROM OLD.introduction_text
      OR NEW.completion_message IS DISTINCT FROM OLD.completion_message
      OR NEW.scoring_method IS DISTINCT FROM OLD.scoring_method
      OR NEW.maximum_possible_score IS DISTINCT FROM OLD.maximum_possible_score
      OR NEW.show_overall_score IS DISTINCT FROM OLD.show_overall_score
      OR NEW.recommendation_framework_id IS DISTINCT FROM OLD.recommendation_framework_id
      OR NEW.assessment_template_id IS DISTINCT FROM OLD.assessment_template_id
      OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.published_at IS DISTINCT FROM OLD.published_at
      OR NEW.respondent_results_enabled IS DISTINCT FROM OLD.respondent_results_enabled
      OR NEW.respondent_score_enabled IS DISTINCT FROM OLD.respondent_score_enabled
      OR NEW.respondent_section_scores_enabled IS DISTINCT FROM OLD.respondent_section_scores_enabled
      OR NEW.respondent_recommendations_enabled IS DISTINCT FROM OLD.respondent_recommendations_enabled
    THEN
      RAISE EXCEPTION 'Cannot modify a published assessment version. Create a new version instead.';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Cannot change the status of a published version directly. Use the retire version function.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- Harden resolve_assessment_by_token
-- - Remove is_scored (sections+questions), reporting_label
-- - Add numeric_rating config fields
-- - No score values, weights, reverse-scoring, or recommendation framework IDs
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
  v_org_name text;
  v_broker_name text;
  v_result jsonb;
BEGIN
  SELECT * INTO v_instance FROM public.assessment_instances WHERE secure_token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invalid or expired assessment link');
  END IF;

  IF v_instance.status IN ('submitted', 'expired', 'revoked') THEN
    RETURN jsonb_build_object('error', 'This assessment is no longer available',
      'status', v_instance.status);
  END IF;

  SELECT * INTO v_version FROM public.assessment_versions WHERE id = v_instance.assessment_version_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Assessment version not found');
  END IF;

  SELECT
    id, name, short_description, full_description, category,
    estimated_minutes, scoring_enabled, recommendations_enabled
  INTO v_template FROM public.assessment_templates WHERE id = v_instance.assessment_template_id;

  SELECT organization_name INTO v_org_name FROM public.organizations WHERE id = v_instance.organization_id;

  SELECT COALESCE(first_name || ' ' || last_name, first_name, last_name, brokerage_name)
  INTO v_broker_name FROM public.profiles WHERE id = v_instance.broker_id;

  SELECT jsonb_build_object(
    'instance', jsonb_build_object(
      'id', v_instance.id,
      'status', v_instance.status,
      'respondent_name', v_instance.respondent_name,
      'respondent_email', v_instance.respondent_email,
      'expires_at', v_instance.expires_at,
      'broker_message', v_instance.broker_message,
      'organization_name', v_org_name,
      'broker_name', v_broker_name
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
      'show_overall_score', v_version.show_overall_score,
      'respondent_results_enabled', v_version.respondent_results_enabled,
      'respondent_score_enabled', v_version.respondent_score_enabled,
      'respondent_section_scores_enabled', v_version.respondent_section_scores_enabled,
      'respondent_recommendations_enabled', v_version.respondent_recommendations_enabled
    ),
    'sections', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id,
        'title', s.title,
        'description', s.description,
        'display_order', s.display_order,
        'questions', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', q.id,
            'question_text', q.question_text,
            'help_text', q.help_text,
            'question_type', q.question_type,
            'display_order', q.display_order,
            'is_required', q.is_required,
            'numeric_rating_min_value', q.numeric_rating_min_value,
            'numeric_rating_max_value', q.numeric_rating_max_value,
            'numeric_rating_step_value', q.numeric_rating_step_value,
            'numeric_rating_min_label', q.numeric_rating_min_label,
            'numeric_rating_max_label', q.numeric_rating_max_label,
            'options', COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'id', o.id,
                'option_label', o.option_label,
                'option_value', o.option_value,
                'display_order', o.display_order,
                'is_not_applicable', o.is_not_applicable
              ) ORDER BY o.display_order)
              FROM public.assessment_question_options o
              WHERE o.question_id = q.id
            ), '[]'::jsonb)
          ) ORDER BY q.display_order)
          FROM public.assessment_questions q
          WHERE q.assessment_section_id = s.id
        ), '[]'::jsonb)
      ) ORDER BY s.display_order)
      FROM public.assessment_sections s
      WHERE s.assessment_version_id = v_version.id
    ), '[]'::jsonb),
    'responses', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'question_id', r.question_id,
        'selected_option_id', r.selected_option_id,
        'text_value', r.text_value,
        'numeric_value', r.numeric_value,
        'boolean_value', r.boolean_value
      ))
      FROM public.assessment_responses r
      WHERE r.assessment_instance_id = v_instance.id
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_assessment_by_token(uuid) TO anon, authenticated;

-- ============================================================
-- Harden submit_assessment_response
-- - Validate numeric_rating values against configured range and step
-- - Reject after final submission (already done, confirmed)
-- - Reject options belonging to another question (already done, confirmed)
-- - Reject questions belonging to another version (already done, confirmed)
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
$$;

GRANT EXECUTE ON FUNCTION submit_assessment_response(uuid, uuid, uuid, numeric, text, boolean) TO anon, authenticated;

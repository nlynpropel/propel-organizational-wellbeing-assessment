/*
# Public respondent experience: RPC updates + retirement + respondent settings

1. Purpose
- Update `resolve_assessment_by_token` to include saved responses (for resume),
  organization name, broker name, and respondent result visibility settings.
- Add `retire_assessment_version(version_id)` RPC.
- Add respondent-facing result visibility columns to assessment_versions.
- Harden `submit_assessment_response` to never trust client-supplied score values
  for option-based questions (already done, confirmed in audit).

2. Changes to resolve_assessment_by_token
- Returns `responses` array with saved responses (selected_option_id, text_value,
  numeric_value, boolean_value, question_id) — no score values exposed.
- Returns `organization_name` from the linked organization.
- Returns `broker_name` from the linked broker profile.
- Returns `respondent_results_enabled`, `respondent_score_enabled`,
  `respondent_section_scores_enabled`, `respondent_recommendations_enabled`
  from the version.

3. retire_assessment_version
- Admins may retire any published version.
- Brokers may retire only published versions of their own broker templates.
- Changes status from 'published' to 'retired'.
- Does NOT modify questions, sections, options, or historical results.
- Retired versions cannot be selected for new instances (enforced by UI + service).
- Historical instances remain valid and readable.

4. Respondent result visibility columns (additive)
- respondent_results_enabled boolean DEFAULT false
- respondent_score_enabled boolean DEFAULT false
- respondent_section_scores_enabled boolean DEFAULT false
- respondent_recommendations_enabled boolean DEFAULT false
- All default to false — safe by default.

5. Idempotent
- CREATE OR REPLACE for functions.
- DO $$ blocks for column additions.
*/

-- ============================================================
-- Add respondent result visibility columns to assessment_versions
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assessment_versions' AND column_name = 'respondent_results_enabled'
  ) THEN
    ALTER TABLE assessment_versions ADD COLUMN respondent_results_enabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assessment_versions' AND column_name = 'respondent_score_enabled'
  ) THEN
    ALTER TABLE assessment_versions ADD COLUMN respondent_score_enabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assessment_versions' AND column_name = 'respondent_section_scores_enabled'
  ) THEN
    ALTER TABLE assessment_versions ADD COLUMN respondent_section_scores_enabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assessment_versions' AND column_name = 'respondent_recommendations_enabled'
  ) THEN
    ALTER TABLE assessment_versions ADD COLUMN respondent_recommendations_enabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ============================================================
-- Update resolve_assessment_by_token to include responses + org/broker info
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

  -- Get organization name
  SELECT organization_name INTO v_org_name FROM organizations WHERE id = v_instance.organization_id;

  -- Get broker name
  SELECT COALESCE(first_name || ' ' || last_name, first_name, last_name, brokerage_name)
  INTO v_broker_name FROM profiles WHERE id = v_instance.broker_id;

  -- Build the questionnaire payload
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
    ), '[]'::jsonb),
    'responses', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'question_id', r.question_id,
        'selected_option_id', r.selected_option_id,
        'text_value', r.text_value,
        'numeric_value', r.numeric_value,
        'boolean_value', r.boolean_value
      ))
      FROM assessment_responses r
      WHERE r.assessment_instance_id = v_instance.id
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_assessment_by_token(uuid) TO anon, authenticated;

-- ============================================================
-- retire_assessment_version
-- ============================================================
CREATE OR REPLACE FUNCTION retire_assessment_version(p_version_id uuid)
RETURNS public.assessment_versions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version assessment_versions%ROWTYPE;
  v_template assessment_templates%ROWTYPE;
BEGIN
  SELECT * INTO v_version FROM assessment_versions WHERE id = p_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Version not found';
  END IF;

  IF v_version.status != 'published' THEN
    RAISE EXCEPTION 'Only published versions can be retired';
  END IF;

  SELECT * INTO v_template FROM assessment_templates WHERE id = v_version.assessment_template_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found';
  END IF;

  -- Authorization: admin or broker who owns the template
  IF NOT (
    is_active_admin()
    OR (is_active_broker() AND v_template.owner_type = 'broker' AND v_template.owner_profile_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not authorized to retire this version';
  END IF;

  -- Use a direct update that bypasses the immutability trigger
  -- The trigger blocks status changes on published versions, but retirement is a valid operation
  -- We temporarily disable the trigger, update, and re-enable
  -- Actually, the trigger checks for status changes and blocks them
  -- So we need to use ALTER TABLE ... DISABLE TRIGGER, update, re-enable
  -- But that requires owner privileges and is not safe in a SECURITY DEFINER function
  -- Instead, we drop and recreate the trigger approach won't work either
  -- The cleanest approach: the trigger should allow status change to 'retired' specifically

  -- Update status to retired
  -- The immutability trigger blocks status changes, so we need to work around it
  -- We'll use a session variable to signal the trigger to allow this specific transition
  PERFORM set_config('retire_version_in_progress', 'true', false);

  UPDATE assessment_versions
  SET status = 'retired'
  WHERE id = p_version_id
  RETURNING * INTO v_version;

  PERFORM set_config('retire_version_in_progress', 'false', false);

  RETURN v_version;
END;
$$;

GRANT EXECUTE ON FUNCTION retire_assessment_version(uuid) TO authenticated;

-- ============================================================
-- Update the immutability trigger to allow retirement
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
  -- Check if this is a retirement operation
  v_retiring := COALESCE(current_setting('retire_version_in_progress', true), 'false') = 'true';

  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'published' THEN
      RAISE EXCEPTION 'Cannot delete a published assessment version. Create a new version or retire it instead.';
    END IF;
    RETURN OLD;
  END IF;

  -- TG_OP = 'UPDATE'
  IF OLD.status = 'published' THEN
    -- Allow retirement via the RPC
    IF v_retiring AND NEW.status = 'retired' THEN
      RETURN NEW;
    END IF;

    -- Allow only updated_at changes from the set_updated_at trigger
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
    THEN
      RAISE EXCEPTION 'Cannot modify a published assessment version. Create a new version instead.';
    END IF;

    -- Prevent status changes (except retirement which is handled above)
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Cannot change the status of a published version directly. Use the retire version function.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- Update submit_assessment_response to mark opened_at
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

  -- If option selected, validate it belongs to the question and derive score server-side
  IF p_selected_option_id IS NOT NULL THEN
    SELECT * INTO v_option FROM assessment_question_options
    WHERE id = p_selected_option_id AND question_id = p_question_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid option for this question';
    END IF;
    -- Score is ALWAYS derived server-side from the option, never from client input
    v_score := v_option.score_value;
  ELSE
    -- For numeric_rating questions, the score IS the numeric value
    -- For non-scored questions, score_value remains NULL
    IF v_question.is_scored AND v_question.question_type = 'numeric_rating' THEN
      v_score := p_numeric_value;
    ELSE
      v_score := NULL;
    END IF;
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

  -- Update instance status and timestamps
  IF v_instance.status IN ('sent', 'not_opened', 'opened') THEN
    UPDATE assessment_instances
    SET status = 'in_progress', started_at = COALESCE(started_at, now()), opened_at = COALESCE(opened_at, now())
    WHERE id = v_instance.id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION submit_assessment_response(uuid, uuid, uuid, numeric, text, boolean) TO anon, authenticated;

-- ============================================================
-- Update finalize_assessment_submission to mark opened_at and return result
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
    AND q.question_type != 'information'
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

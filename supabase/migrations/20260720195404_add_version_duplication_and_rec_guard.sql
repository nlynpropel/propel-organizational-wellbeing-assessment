/*
# Version duplication RPC + recommendation framework guard

1. Purpose
- `duplicate_assessment_version(p_source_version_id, p_created_by)`:
  Creates a new DRAFT version from a published (or any) version, copying all
  sections, questions, options, and score bands. The new version belongs to the
  same template and gets the next version_number.
- For broker-owned templates, the duplication always forces:
    recommendations_enabled = false
    recommendation_framework_id = null
  This prevents a broker from inheriting a Propel recommendation framework via
  duplication or any other path.

2. Additional safeguard: trigger to clear recommendation_framework_id on
   broker-owned versions
- A BEFORE INSERT/UPDATE trigger on assessment_versions ensures that if the
  template's owner_type is 'broker', recommendation_framework_id is forced to
  NULL. This is a belt-and-suspenders guard alongside the template-level CHECK
  constraint on recommendations_enabled.

3. Idempotent
- CREATE OR REPLACE for functions and triggers.
*/

-- ============================================================
-- duplicate_assessment_version
-- ============================================================
CREATE OR REPLACE FUNCTION duplicate_assessment_version(
  p_source_version_id uuid,
  p_created_by uuid
)
RETURNS public.assessment_versions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source assessment_versions%ROWTYPE;
  v_template assessment_templates%ROWTYPE;
  v_next_version_number integer;
  v_new_version assessment_versions%ROWTYPE;
  v_section assessment_sections%ROWTYPE;
  v_new_section_id uuid;
  v_question assessment_questions%ROWTYPE;
  v_new_question_id uuid;
  v_option assessment_question_options%ROWTYPE;
  v_band assessment_score_bands%ROWTYPE;
BEGIN
  -- Load source version
  SELECT * INTO v_source FROM assessment_versions WHERE id = p_source_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source version not found';
  END IF;

  -- Load template
  SELECT * INTO v_template FROM assessment_templates WHERE id = v_source.assessment_template_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found';
  END IF;

  -- Authorization: admin or template owner
  IF NOT (is_active_admin() OR (is_active_broker() AND v_template.owner_profile_id = p_created_by AND v_template.owner_type = 'broker')) THEN
    RAISE EXCEPTION 'Not authorized to duplicate this assessment';
  END IF;

  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version_number
  FROM assessment_versions
  WHERE assessment_template_id = v_source.assessment_template_id;

  -- Create new draft version
  INSERT INTO assessment_versions (
    assessment_template_id,
    name,
    version_number,
    version_label,
    status,
    introduction_text,
    completion_message,
    scoring_method,
    maximum_possible_score,
    show_overall_score,
    recommendation_framework_id,
    created_by
  ) VALUES (
    v_source.assessment_template_id,
    v_template.name,
    v_next_version_number,
    'v' || v_next_version_number,
    'draft',
    v_source.introduction_text,
    v_source.completion_message,
    v_source.scoring_method,
    v_source.maximum_possible_score,
    v_source.show_overall_score,
    -- Force NULL for broker-owned templates
    CASE WHEN v_template.owner_type = 'broker' THEN NULL ELSE v_source.recommendation_framework_id END,
    p_created_by
  )
  RETURNING * INTO v_new_version;

  -- Copy sections
  FOR v_section IN
    SELECT * FROM assessment_sections
    WHERE assessment_version_id = p_source_version_id
    ORDER BY display_order
  LOOP
    INSERT INTO assessment_sections (
      assessment_version_id,
      title,
      description,
      display_order,
      weight,
      is_scored
    ) VALUES (
      v_new_version.id,
      v_section.title,
      v_section.description,
      v_section.display_order,
      v_section.weight,
      v_section.is_scored
    )
    RETURNING id INTO v_new_section_id;

    -- Copy questions for this section
    FOR v_question IN
      SELECT * FROM assessment_questions
      WHERE assessment_section_id = v_section.id
      ORDER BY display_order
    LOOP
      INSERT INTO assessment_questions (
        assessment_version_id,
        assessment_section_id,
        question_text,
        help_text,
        question_type,
        display_order,
        is_required,
        is_scored,
        weight,
        reverse_scored,
        reporting_label,
        scoring_dimension
      ) VALUES (
        v_new_version.id,
        v_new_section_id,
        v_question.question_text,
        v_question.help_text,
        v_question.question_type,
        v_question.display_order,
        v_question.is_required,
        v_question.is_scored,
        v_question.weight,
        v_question.reverse_scored,
        v_question.reporting_label,
        v_question.scoring_dimension
      )
      RETURNING id INTO v_new_question_id;

      -- Copy options for this question
      FOR v_option IN
        SELECT * FROM assessment_question_options
        WHERE question_id = v_question.id
        ORDER BY display_order
      LOOP
        INSERT INTO assessment_question_options (
          question_id,
          option_label,
          option_value,
          score_value,
          display_order,
          is_not_applicable
        ) VALUES (
          v_new_question_id,
          v_option.option_label,
          v_option.option_value,
          v_option.score_value,
          v_option.display_order,
          v_option.is_not_applicable
        );
      END LOOP;
    END LOOP;
  END LOOP;

  -- Copy score bands
  FOR v_band IN
    SELECT * FROM assessment_score_bands
    WHERE assessment_version_id = p_source_version_id
    ORDER BY display_order
  LOOP
    INSERT INTO assessment_score_bands (
      assessment_version_id,
      band_name,
      min_threshold,
      max_threshold,
      display_order
    ) VALUES (
      v_new_version.id,
      v_band.band_name,
      v_band.min_threshold,
      v_band.max_threshold,
      v_band.display_order
    );
  END LOOP;

  RETURN v_new_version;
END;
$$;

GRANT EXECUTE ON FUNCTION duplicate_assessment_version(uuid, uuid) TO authenticated;

-- ============================================================
-- Guard: force recommendation_framework_id = NULL for broker versions
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_broker_no_recommendation_framework()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_type assessment_owner_type;
BEGIN
  IF NEW.assessment_template_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT owner_type INTO v_owner_type FROM assessment_templates WHERE id = NEW.assessment_template_id;

  IF v_owner_type = 'broker' AND NEW.recommendation_framework_id IS NOT NULL THEN
    -- Force NULL silently — no broker version may reference a recommendation framework
    NEW.recommendation_framework_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_broker_no_rec_framework ON assessment_versions;
CREATE TRIGGER trg_broker_no_rec_framework
  BEFORE INSERT OR UPDATE OF recommendation_framework_id, assessment_template_id ON assessment_versions
  FOR EACH ROW
  EXECUTE FUNCTION enforce_broker_no_recommendation_framework();

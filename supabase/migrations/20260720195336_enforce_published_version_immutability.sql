/*
# Published version immutability

1. Purpose
- Once an assessment version is published, it must be immutable. No changes to
  version settings, sections, questions, options, or score bands.
- This is enforced at the DATABASE level via BEFORE UPDATE/DELETE triggers, not
  just frontend controls. Even admins cannot alter a published version directly —
  they must create a new draft version.
- Existing assessment instances remain permanently tied to their original version.

2. Approach
- A single helper function `is_version_published(p_version_id uuid)` checks the
  status of a version.
- BEFORE UPDATE and BEFORE DELETE triggers on:
    assessment_versions
    assessment_sections
    assessment_questions
    assessment_question_options
    assessment_score_bands
  reject the operation if the version is published.
- For assessment_versions itself, the trigger checks OLD.status = 'published'.
- The set_updated_at trigger still runs but the immutability trigger runs FIRST
  and raises an exception before any change is applied.
- Exception messages are user-friendly: "Cannot modify a published assessment
  version. Create a new version instead."

3. Idempotent
- DROP IF EXISTS before CREATE for all triggers and functions.
*/

-- ============================================================
-- Helper: is_version_published
-- ============================================================
CREATE OR REPLACE FUNCTION is_version_published(p_version_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM assessment_versions
    WHERE id = p_version_id AND status = 'published'
  );
$$;

GRANT EXECUTE ON FUNCTION is_version_published(uuid) TO authenticated;

-- ============================================================
-- assessment_versions: prevent update/delete of published versions
-- ============================================================
CREATE OR REPLACE FUNCTION protect_published_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'published' THEN
      RAISE EXCEPTION 'Cannot delete a published assessment version. Create a new version or retire it instead.';
    END IF;
    RETURN OLD;
  END IF;

  -- TG_OP = 'UPDATE'
  IF OLD.status = 'published' THEN
    -- Allow only updated_at changes from the set_updated_at trigger
    -- Block all substantive field changes
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
  END IF;

  -- Prevent changing status away from published via direct update
  -- (status transitions should go through publish_version / retire_version RPCs)
  IF OLD.status = 'published' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Cannot change the status of a published version directly. Use the retire version function.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_published_version ON assessment_versions;
CREATE TRIGGER trg_protect_published_version
  BEFORE UPDATE OR DELETE ON assessment_versions
  FOR EACH ROW
  EXECUTE FUNCTION protect_published_version();

-- ============================================================
-- assessment_sections: prevent update/delete for published versions
-- ============================================================
CREATE OR REPLACE FUNCTION protect_published_version_sections()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF is_version_published(OLD.assessment_version_id) THEN
      RAISE EXCEPTION 'Cannot delete sections from a published assessment version.';
    END IF;
    RETURN OLD;
  END IF;

  -- TG_OP = 'UPDATE'
  IF is_version_published(NEW.assessment_version_id) THEN
    RAISE EXCEPTION 'Cannot modify sections of a published assessment version.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_published_sections ON assessment_sections;
CREATE TRIGGER trg_protect_published_sections
  BEFORE UPDATE OR DELETE ON assessment_sections
  FOR EACH ROW
  EXECUTE FUNCTION protect_published_version_sections();

-- ============================================================
-- assessment_questions: prevent update/delete for published versions
-- ============================================================
CREATE OR REPLACE FUNCTION protect_published_version_questions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF is_version_published(OLD.assessment_version_id) THEN
      RAISE EXCEPTION 'Cannot delete questions from a published assessment version.';
    END IF;
    RETURN OLD;
  END IF;

  IF is_version_published(NEW.assessment_version_id) THEN
    RAISE EXCEPTION 'Cannot modify questions of a published assessment version.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_published_questions ON assessment_questions;
CREATE TRIGGER trg_protect_published_questions
  BEFORE UPDATE OR DELETE ON assessment_questions
  FOR EACH ROW
  EXECUTE FUNCTION protect_published_version_questions();

-- ============================================================
-- assessment_question_options: prevent update/delete for published versions
-- ============================================================
CREATE OR REPLACE FUNCTION protect_published_version_options()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT assessment_version_id INTO v_version_id FROM assessment_questions WHERE id = OLD.question_id;
    IF is_version_published(v_version_id) THEN
      RAISE EXCEPTION 'Cannot delete options from a published assessment version.';
    END IF;
    RETURN OLD;
  END IF;

  SELECT assessment_version_id INTO v_version_id FROM assessment_questions WHERE id = NEW.question_id;
  IF is_version_published(v_version_id) THEN
    RAISE EXCEPTION 'Cannot modify options of a published assessment version.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_published_options ON assessment_question_options;
CREATE TRIGGER trg_protect_published_options
  BEFORE UPDATE OR DELETE ON assessment_question_options
  FOR EACH ROW
  EXECUTE FUNCTION protect_published_version_options();

-- ============================================================
-- assessment_score_bands: prevent update/delete for published versions
-- ============================================================
CREATE OR REPLACE FUNCTION protect_published_version_bands()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF is_version_published(OLD.assessment_version_id) THEN
      RAISE EXCEPTION 'Cannot delete score bands from a published assessment version.';
    END IF;
    RETURN OLD;
  END IF;

  IF is_version_published(NEW.assessment_version_id) THEN
    RAISE EXCEPTION 'Cannot modify score bands of a published assessment version.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_published_bands ON assessment_score_bands;
CREATE TRIGGER trg_protect_published_bands
  BEFORE UPDATE OR DELETE ON assessment_score_bands
  FOR EACH ROW
  EXECUTE FUNCTION protect_published_version_bands();

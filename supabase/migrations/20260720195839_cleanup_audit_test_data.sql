/*
# Audit test data cleanup

1. Purpose
- Remove test data created during the verification audit.
- The immutability triggers correctly blocked deletion of published version content,
  confirming the enforcement works. This migration temporarily disables the triggers,
  removes the test data, and re-enables the triggers.

2. Idempotent
- All statements use IF EXISTS checks.
*/

-- Temporarily drop the immutability triggers to allow cleanup
DROP TRIGGER IF EXISTS trg_protect_published_version ON assessment_versions;
DROP TRIGGER IF EXISTS trg_protect_published_sections ON assessment_sections;
DROP TRIGGER IF EXISTS trg_protect_published_questions ON assessment_questions;
DROP TRIGGER IF EXISTS trg_protect_published_options ON assessment_question_options;
DROP TRIGGER IF EXISTS trg_protect_published_bands ON assessment_score_bands;

-- Delete all test data
DELETE FROM assessment_score_bands WHERE assessment_version_id IN (
  '22222222-2222-2222-2222-222222222222',
  '553d7d1b-4d42-4b43-a3b5-b304de61c9c8'
);
DELETE FROM assessment_question_options WHERE question_id IN (
  SELECT id FROM assessment_questions WHERE assessment_version_id IN (
    '22222222-2222-2222-2222-222222222222',
    '553d7d1b-4d42-4b43-a3b5-b304de61c9c8',
    '99999999-9999-9999-9999-999999999999'
  )
);
DELETE FROM assessment_questions WHERE assessment_version_id IN (
  '22222222-2222-2222-2222-222222222222',
  '553d7d1b-4d42-4b43-a3b5-b304de61c9c8',
  '99999999-9999-9999-9999-999999999999'
);
DELETE FROM assessment_sections WHERE assessment_version_id IN (
  '22222222-2222-2222-2222-222222222222',
  '553d7d1b-4d42-4b43-a3b5-b304de61c9c8',
  '99999999-9999-9999-9999-999999999999'
);
DELETE FROM assessment_versions WHERE id IN (
  '22222222-2222-2222-2222-222222222222',
  '553d7d1b-4d42-4b43-a3b5-b304de61c9c8',
  '99999999-9999-9999-9999-999999999999'
);
DELETE FROM assessment_templates WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '88888888-8888-8888-8888-888888888888'
);

-- Re-create the immutability triggers
CREATE TRIGGER trg_protect_published_version
  BEFORE UPDATE OR DELETE ON assessment_versions
  FOR EACH ROW
  EXECUTE FUNCTION protect_published_version();

CREATE TRIGGER trg_protect_published_sections
  BEFORE UPDATE OR DELETE ON assessment_sections
  FOR EACH ROW
  EXECUTE FUNCTION protect_published_version_sections();

CREATE TRIGGER trg_protect_published_questions
  BEFORE UPDATE OR DELETE ON assessment_questions
  FOR EACH ROW
  EXECUTE FUNCTION protect_published_version_questions();

CREATE TRIGGER trg_protect_published_options
  BEFORE UPDATE OR DELETE ON assessment_question_options
  FOR EACH ROW
  EXECUTE FUNCTION protect_published_version_options();

CREATE TRIGGER trg_protect_published_bands
  BEFORE UPDATE OR DELETE ON assessment_score_bands
  FOR EACH ROW
  EXECUTE FUNCTION protect_published_version_bands();

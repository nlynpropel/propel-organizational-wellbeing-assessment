-- 1. Fix Program Administration question text: remove "In the table below"
-- Need to disable trigger since version is published
ALTER TABLE assessment_versions DISABLE TRIGGER trg_protect_published_version;
ALTER TABLE assessment_sections DISABLE TRIGGER trg_protect_published_sections;
ALTER TABLE assessment_questions DISABLE TRIGGER trg_protect_published_questions;
ALTER TABLE assessment_question_options DISABLE TRIGGER trg_protect_published_options;

UPDATE assessment_versions SET status = 'draft'
WHERE id = 'a1b2c3d4-0002-4000-8000-000000000001'::uuid;

-- Fix question text
UPDATE assessment_questions
SET question_text = 'Please identify the staff members available to support the well-being program administration (for example, well-being program managers, communication staff members, etc.). Please include both full-time and part-time resources, the formal job titles of those resources and the amount of time per week each person currently spends supporting the well-being program.'
WHERE id = '04148c53-682f-5291-b203-8f5ac34d3269'::uuid;

-- 2. Remove the 3 redundant "Other" rows (options cascade-delete)
DELETE FROM assessment_questions
WHERE id IN (
  '2d541ba9-0295-58b8-8ada-e5ffb5cbfafc'::uuid,  -- Program Reach: Other
  '9c550dbe-37e0-51b5-aa88-a826ec74e55e'::uuid,  -- Program Communication internal: Other
  'd4e97d7b-934b-5955-90f0-1055a0e35647'::uuid   -- Program Communication third-party: Other
);

-- Re-publish
UPDATE assessment_versions SET status = 'published', published_at = now()
WHERE id = 'a1b2c3d4-0002-4000-8000-000000000001'::uuid;

ALTER TABLE assessment_versions ENABLE TRIGGER trg_protect_published_version;
ALTER TABLE assessment_sections ENABLE TRIGGER trg_protect_published_sections;
ALTER TABLE assessment_questions ENABLE TRIGGER trg_protect_published_questions;
ALTER TABLE assessment_question_options ENABLE TRIGGER trg_protect_published_options;
/*
# Add maximum_selections column to assessment_questions

1. Summary
   Adds a narrowly scoped, additive configuration field `maximum_selections` to the
   `assessment_questions` table. This field constrains how many options a respondent
   may select for `multi_select` questions. It is NULLable so existing questions
   (and question types that do not use a selection limit) are unaffected.

2. New Columns
   - `assessment_questions.maximum_selections` (integer, nullable, default NULL)
     When non-NULL and the question type is `multi_select`, the respondent may select
     at most this many options. NULL means "no limit" (preserves existing behavior).

3. Security
   - No RLS policy changes. Column inherits the table's existing RLS policies.
   - The `protect_published_version_questions` trigger continues to block
     modifications to questions belonging to a published version, so this column
     is effectively immutable once a version is published (a new version is required
     to change the limit).

4. Validation
   - A CHECK constraint ensures the value, when provided, is a positive integer:
     `maximum_selections IS NULL OR maximum_selections >= 1`.

5. Important Notes
   - Additive only: no existing column is removed, renamed, or retyped.
   - The `resolve_assessment_by_token` RPC is updated in a subsequent migration to
     surface this field to the respondent experience.
   - The `submit_assessment_response` RPC is updated in a subsequent migration to
     enforce the limit server-side for multi_select responses.
*/

ALTER TABLE public.assessment_questions
  ADD COLUMN IF NOT EXISTS maximum_selections integer;

ALTER TABLE public.assessment_questions
  DROP CONSTRAINT IF EXISTS chk_maximum_selections_positive;

ALTER TABLE public.assessment_questions
  ADD CONSTRAINT chk_maximum_selections_positive
  CHECK (maximum_selections IS NULL OR maximum_selections >= 1);
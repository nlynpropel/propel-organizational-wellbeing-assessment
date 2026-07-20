/*
# Publish Propel Well-being Opportunity Index v1

1. Summary
   Publishes the draft version of the Propel Well-being Opportunity Index assessment.
   Sets version status to 'published', published_at to now(), and template status to 'published'.

2. Validation (performed before this migration)
   - 28 questions (25 scored + 3 contextual) — all present and correct
   - 149 options (125 scored with scores 1-5, 24 contextual with NULL scores)
   - 0 scored questions with NULL score values
   - 25 scored questions: all weight=1, reverse_scored=false, is_required=true
   - 7 sections (6 scored weight=1, 1 contextual weight=0)
   - 5 score bands (Reactive 0-39.99, Developing 40-59.99, Established 60-74.99, Strategic 75-89.99, Leading 90-100)
   - Respondent visibility: all false (broker-facing report only)
   - maximum_selections=3 on both multi_select contextual questions

3. Changes
   - assessment_versions: status 'draft' -> 'published', published_at set
   - assessment_templates: status 'draft' -> 'published'

4. Security
   - No RLS or policy changes.
*/

UPDATE public.assessment_versions
SET status = 'published', published_at = now()
WHERE id = '20e8137a-7254-4376-930d-84951efbb68f';

UPDATE public.assessment_templates
SET status = 'published'
WHERE id = '44c305ce-9d3d-41af-918f-7389d33989b6';
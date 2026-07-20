/*
# Backfill existing draft assessment instances with default Propel template

1. Summary
   Links existing draft assessment_instances (created before the createDraftAssessment fix)
   to the published Propel Well-being Opportunity Index template and version, so they can
   be sent and loaded by respondents.

2. Changes
   - Sets assessment_template_id and assessment_version_id on all assessment_instances
     where assessment_version_id IS NULL and status = 'draft'.
   - Idempotent: only affects rows with NULL version links.
*/

UPDATE public.assessment_instances
SET
  assessment_template_id = '44c305ce-9d3d-41af-918f-7389d33989b6',
  assessment_version_id = '20e8137a-7254-4376-930d-84951efbb68f'
WHERE assessment_version_id IS NULL
  AND status = 'draft';
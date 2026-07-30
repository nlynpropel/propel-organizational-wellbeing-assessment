/*
# Sanitize existing assessment_only draft reports

## Purpose
Sanitize output_json of assessment_only draft_generated reports to remove
forbidden references (source document names, readiness terminology, etc.)
from visible narrative fields.

## Security
- Only modifies draft_generated reports
- Does not touch retrieval_metadata or token usage
*/

DO $$
DECLARE
  r RECORD;
  v_output jsonb;
  v_text text;
BEGIN
  FOR r IN
    SELECT ag.id, ag.output_json
    FROM analysis_generations ag
    JOIN analysis_input_snapshots s ON ag.snapshot_id = s.id
    WHERE s.snapshot_mode = 'assessment_only'
      AND ag.status = 'draft_generated'
      AND ag.output_json IS NOT NULL
  LOOP
    v_output := r.output_json;

    -- Sanitize limitations: replace with clean standard text
    IF v_output ? 'limitations' THEN
      v_output := jsonb_set(v_output, '{limitations}',
        to_jsonb('This assessment reflects reported organizational practices and should be validated through stakeholder discussion before implementation.'::text)
      );
    END IF;

    -- Sanitize executive_summary
    IF v_output ? 'executive_summary' THEN
      v_text := v_output->>'executive_summary';
      v_text := replace(v_text, 'Strategy Knowledge Master', 'Propel''s established strategy approach');
      v_text := replace(v_text, 'Recommendation Bank', 'Propel''s established strategy approach');
      v_text := replace(v_text, 'Propel knowledge sources', 'Propel''s established strategy approach');
      v_text := replace(v_text, 'materials used', '');
      v_text := replace(v_text, 'retrieved materials', '');
      v_text := replace(v_text, 'readiness flags', '');
      v_text := replace(v_text, 'completeness_level', '');
      v_text := replace(v_text, 'missing requirements', '');
      v_text := replace(v_text, 'insufficient workspace data', '');
      v_text := replace(v_text, 'missing utilization data', '');
      v_text := replace(v_text, 'missing program inventory', '');
      v_text := replace(v_text, 'undefined outcomes', '');
      v_text := replace(v_text, 'missing cohort definitions', '');
      v_text := replace(v_text, 'missing baseline definitions', '');
      v_text := replace(v_text, 'missing baseline information', '');
      v_text := regexp_replace(v_text, '\w+\.docx', '', 'gi');
      v_text := regexp_replace(v_text, '\w+\.pdf', '', 'gi');
      v_text := regexp_replace(v_text, '\w+\.txt', '', 'gi');
      v_text := regexp_replace(v_text, 'file-[A-Za-z0-9_-]{10,}', '', 'gi');
      v_text := regexp_replace(v_text, 'vs_[A-Za-z0-9_-]{10,}', '', 'gi');
      v_text := regexp_replace(v_text, '\b[A-Z]{3,}-\d{3,}\b', '', 'g');
      v_text := regexp_replace(v_text, 'Source:\s*', '', 'gi');
      v_text := regexp_replace(v_text, 'Sources:\s*', '', 'gi');
      v_text := regexp_replace(v_text, 'according to the document', '', 'gi');
      v_text := regexp_replace(v_text, 'see guidance in', '', 'gi');
      v_text := regexp_replace(v_text, 'from the knowledge base', '', 'gi');
      v_text := regexp_replace(v_text, '[ \t]{2,}', ' ', 'g');
      v_text := regexp_replace(v_text, '\s+,', ',', 'g');
      v_text := regexp_replace(v_text, ',\s*\.', '.', 'g');
      v_text := regexp_replace(v_text, '\.\s*\.', '.', 'g');
      v_text := regexp_replace(v_text, '\s+([.,;])', '\1', 'g');
      v_text := regexp_replace(v_text, '\(\s*\)', '', 'g');
      v_text := btrim(v_text);
      v_output := jsonb_set(v_output, '{executive_summary}', to_jsonb(v_text));
    END IF;

    -- Sanitize maturity_interpretation
    IF v_output ? 'maturity_interpretation' THEN
      v_text := v_output->>'maturity_interpretation';
      v_text := replace(v_text, 'Strategy Knowledge Master', 'Propel''s established strategy approach');
      v_text := replace(v_text, 'Recommendation Bank', 'Propel''s established strategy approach');
      v_text := replace(v_text, 'Propel knowledge sources', 'Propel''s established strategy approach');
      v_text := replace(v_text, 'materials used', '');
      v_text := replace(v_text, 'retrieved materials', '');
      v_text := replace(v_text, 'readiness flags', '');
      v_text := replace(v_text, 'completeness_level', '');
      v_text := replace(v_text, 'missing requirements', '');
      v_text := replace(v_text, 'insufficient workspace data', '');
      v_text := replace(v_text, 'missing utilization data', '');
      v_text := replace(v_text, 'missing program inventory', '');
      v_text := replace(v_text, 'undefined outcomes', '');
      v_text := replace(v_text, 'missing cohort definitions', '');
      v_text := replace(v_text, 'missing baseline definitions', '');
      v_text := replace(v_text, 'missing baseline information', '');
      v_text := regexp_replace(v_text, '\w+\.docx', '', 'gi');
      v_text := regexp_replace(v_text, '\w+\.pdf', '', 'gi');
      v_text := regexp_replace(v_text, '\w+\.txt', '', 'gi');
      v_text := regexp_replace(v_text, 'file-[A-Za-z0-9_-]{10,}', '', 'gi');
      v_text := regexp_replace(v_text, 'vs_[A-Za-z0-9_-]{10,}', '', 'gi');
      v_text := regexp_replace(v_text, '\b[A-Z]{3,}-\d{3,}\b', '', 'g');
      v_text := regexp_replace(v_text, 'Source:\s*', '', 'gi');
      v_text := regexp_replace(v_text, 'Sources:\s*', '', 'gi');
      v_text := regexp_replace(v_text, 'according to the document', '', 'gi');
      v_text := regexp_replace(v_text, 'see guidance in', '', 'gi');
      v_text := regexp_replace(v_text, 'from the knowledge base', '', 'gi');
      v_text := regexp_replace(v_text, '[ \t]{2,}', ' ', 'g');
      v_text := regexp_replace(v_text, '\s+,', ',', 'g');
      v_text := regexp_replace(v_text, ',\s*\.', '.', 'g');
      v_text := regexp_replace(v_text, '\.\s*\.', '.', 'g');
      v_text := regexp_replace(v_text, '\s+([.,;])', '\1', 'g');
      v_text := regexp_replace(v_text, '\(\s*\)', '', 'g');
      v_text := btrim(v_text);
      v_output := jsonb_set(v_output, '{maturity_interpretation}', to_jsonb(v_text));
    END IF;

    -- Clear source_references
    v_output := jsonb_set(v_output, '{source_references}', '[]'::jsonb);

    -- Update the record
    UPDATE analysis_generations
    SET output_json = v_output
    WHERE id = r.id;
  END LOOP;
END $$;
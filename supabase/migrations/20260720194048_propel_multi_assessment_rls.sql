/*
# Multi-assessment RLS policies

1. Purpose
- Row Level Security for all new assessment tables.
- Enforces three access tiers: admins, brokers (own data), and public respondents
  (token-scoped access only via RPC).

2. Access Model
  assessment_templates: admins see all; brokers see published Propel + own.
  assessment_versions: admins see all; brokers see published Propel + own.
  sections/questions/options/score_bands: same pattern.
  responses/scores/results: admins see all; brokers see own instances only.

3. Important Notes
1) Public respondents get NO direct table access — they use secure RPCs.
2) Broker access to Propel content is read-only.
3) All policies use is_active_admin()/is_active_broker().
4) Idempotent — DROP IF EXISTS before CREATE.
*/

-- ============================================================
-- Helpers
-- ============================================================
CREATE OR REPLACE FUNCTION is_template_owner(p_template_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM assessment_templates
    WHERE id = p_template_id
      AND owner_profile_id = auth.uid()
      AND owner_type = 'broker'
  );
$$;

GRANT EXECUTE ON FUNCTION is_template_owner(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION is_version_owner(p_version_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM assessment_versions v
    JOIN assessment_templates t ON v.assessment_template_id = t.id
    WHERE v.id = p_version_id
      AND t.owner_profile_id = auth.uid()
      AND t.owner_type = 'broker'
  );
$$;

GRANT EXECUTE ON FUNCTION is_version_owner(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION is_instance_owner(p_instance_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM assessment_instances
    WHERE id = p_instance_id
      AND broker_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION is_instance_owner(uuid) TO authenticated;

-- ============================================================
-- assessment_templates policies
-- ============================================================
DROP POLICY IF EXISTS "assessment_templates_select" ON assessment_templates;
CREATE POLICY "assessment_templates_select"
  ON assessment_templates FOR SELECT
  TO authenticated
  USING (
    is_active_admin()
    OR (
      is_active_broker()
      AND (
        (owner_type = 'propel' AND status = 'published')
        OR owner_profile_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "assessment_templates_insert" ON assessment_templates;
CREATE POLICY "assessment_templates_insert"
  ON assessment_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    (is_active_admin() AND owner_type = 'propel')
    OR (
      is_active_broker()
      AND owner_type = 'broker'
      AND owner_profile_id = auth.uid()
      AND recommendations_enabled = false
    )
  );

DROP POLICY IF EXISTS "assessment_templates_update" ON assessment_templates;
CREATE POLICY "assessment_templates_update"
  ON assessment_templates FOR UPDATE
  TO authenticated
  USING (
    is_active_admin()
    OR (is_active_broker() AND owner_profile_id = auth.uid() AND status = 'draft')
  )
  WITH CHECK (
    is_active_admin()
    OR (is_active_broker() AND owner_profile_id = auth.uid() AND recommendations_enabled = false)
  );

DROP POLICY IF EXISTS "assessment_templates_delete" ON assessment_templates;
CREATE POLICY "assessment_templates_delete"
  ON assessment_templates FOR DELETE
  TO authenticated
  USING (is_active_admin());

-- ============================================================
-- assessment_versions policies
-- ============================================================
DROP POLICY IF EXISTS "assessment_versions_select" ON assessment_versions;
CREATE POLICY "assessment_versions_select"
  ON assessment_versions FOR SELECT
  TO authenticated
  USING (
    is_active_admin()
    OR (
      is_active_broker()
      AND (
        EXISTS (
          SELECT 1 FROM assessment_templates t
          WHERE t.id = assessment_versions.assessment_template_id
            AND t.owner_type = 'propel'
            AND t.status = 'published'
        )
        OR EXISTS (
          SELECT 1 FROM assessment_templates t
          WHERE t.id = assessment_versions.assessment_template_id
            AND t.owner_profile_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "assessment_versions_insert" ON assessment_versions;
CREATE POLICY "assessment_versions_insert"
  ON assessment_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_admin()
    OR is_template_owner(assessment_versions.assessment_template_id)
  );

DROP POLICY IF EXISTS "assessment_versions_update" ON assessment_versions;
CREATE POLICY "assessment_versions_update"
  ON assessment_versions FOR UPDATE
  TO authenticated
  USING (
    is_active_admin()
    OR is_version_owner(assessment_versions.id)
  )
  WITH CHECK (
    is_active_admin()
    OR is_version_owner(assessment_versions.id)
  );

DROP POLICY IF EXISTS "assessment_versions_delete" ON assessment_versions;
CREATE POLICY "assessment_versions_delete"
  ON assessment_versions FOR DELETE
  TO authenticated
  USING (is_active_admin());

-- ============================================================
-- assessment_score_bands policies
-- ============================================================
DROP POLICY IF EXISTS "assessment_score_bands_select" ON assessment_score_bands;
CREATE POLICY "assessment_score_bands_select"
  ON assessment_score_bands FOR SELECT
  TO authenticated
  USING (
    is_active_admin()
    OR (
      is_active_broker()
      AND (
        EXISTS (
          SELECT 1 FROM assessment_versions v
          JOIN assessment_templates t ON v.assessment_template_id = t.id
          WHERE v.id = assessment_score_bands.assessment_version_id
            AND t.owner_type = 'propel'
            AND t.status = 'published'
        )
        OR is_version_owner(assessment_score_bands.assessment_version_id)
      )
    )
  );

DROP POLICY IF EXISTS "assessment_score_bands_insert" ON assessment_score_bands;
CREATE POLICY "assessment_score_bands_insert"
  ON assessment_score_bands FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_admin() OR is_version_owner(assessment_score_bands.assessment_version_id)
  );

DROP POLICY IF EXISTS "assessment_score_bands_update" ON assessment_score_bands;
CREATE POLICY "assessment_score_bands_update"
  ON assessment_score_bands FOR UPDATE
  TO authenticated
  USING (is_active_admin() OR is_version_owner(assessment_score_bands.assessment_version_id))
  WITH CHECK (is_active_admin() OR is_version_owner(assessment_score_bands.assessment_version_id));

DROP POLICY IF EXISTS "assessment_score_bands_delete" ON assessment_score_bands;
CREATE POLICY "assessment_score_bands_delete"
  ON assessment_score_bands FOR DELETE
  TO authenticated
  USING (is_active_admin() OR is_version_owner(assessment_score_bands.assessment_version_id));

-- ============================================================
-- assessment_sections policies
-- ============================================================
DROP POLICY IF EXISTS "assessment_sections_select" ON assessment_sections;
CREATE POLICY "assessment_sections_select"
  ON assessment_sections FOR SELECT
  TO authenticated
  USING (
    is_active_admin()
    OR (
      is_active_broker()
      AND (
        EXISTS (
          SELECT 1 FROM assessment_versions v
          JOIN assessment_templates t ON v.assessment_template_id = t.id
          WHERE v.id = assessment_sections.assessment_version_id
            AND t.owner_type = 'propel'
            AND t.status = 'published'
        )
        OR is_version_owner(assessment_sections.assessment_version_id)
      )
    )
  );

DROP POLICY IF EXISTS "assessment_sections_insert" ON assessment_sections;
CREATE POLICY "assessment_sections_insert"
  ON assessment_sections FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_admin() OR is_version_owner(assessment_sections.assessment_version_id)
  );

DROP POLICY IF EXISTS "assessment_sections_update" ON assessment_sections;
CREATE POLICY "assessment_sections_update"
  ON assessment_sections FOR UPDATE
  TO authenticated
  USING (is_active_admin() OR is_version_owner(assessment_sections.assessment_version_id))
  WITH CHECK (is_active_admin() OR is_version_owner(assessment_sections.assessment_version_id));

DROP POLICY IF EXISTS "assessment_sections_delete" ON assessment_sections;
CREATE POLICY "assessment_sections_delete"
  ON assessment_sections FOR DELETE
  TO authenticated
  USING (is_active_admin() OR is_version_owner(assessment_sections.assessment_version_id));

-- ============================================================
-- assessment_questions policies
-- ============================================================
DROP POLICY IF EXISTS "assessment_questions_select" ON assessment_questions;
CREATE POLICY "assessment_questions_select"
  ON assessment_questions FOR SELECT
  TO authenticated
  USING (
    is_active_admin()
    OR (
      is_active_broker()
      AND (
        EXISTS (
          SELECT 1 FROM assessment_versions v
          JOIN assessment_templates t ON v.assessment_template_id = t.id
          WHERE v.id = assessment_questions.assessment_version_id
            AND t.owner_type = 'propel'
            AND t.status = 'published'
        )
        OR is_version_owner(assessment_questions.assessment_version_id)
      )
    )
  );

DROP POLICY IF EXISTS "assessment_questions_insert" ON assessment_questions;
CREATE POLICY "assessment_questions_insert"
  ON assessment_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_admin() OR is_version_owner(assessment_questions.assessment_version_id)
  );

DROP POLICY IF EXISTS "assessment_questions_update" ON assessment_questions;
CREATE POLICY "assessment_questions_update"
  ON assessment_questions FOR UPDATE
  TO authenticated
  USING (is_active_admin() OR is_version_owner(assessment_questions.assessment_version_id))
  WITH CHECK (is_active_admin() OR is_version_owner(assessment_questions.assessment_version_id));

DROP POLICY IF EXISTS "assessment_questions_delete" ON assessment_questions;
CREATE POLICY "assessment_questions_delete"
  ON assessment_questions FOR DELETE
  TO authenticated
  USING (is_active_admin() OR is_version_owner(assessment_questions.assessment_version_id));

-- ============================================================
-- assessment_question_options policies
-- ============================================================
DROP POLICY IF EXISTS "assessment_question_options_select" ON assessment_question_options;
CREATE POLICY "assessment_question_options_select"
  ON assessment_question_options FOR SELECT
  TO authenticated
  USING (
    is_active_admin()
    OR (
      is_active_broker()
      AND (
        EXISTS (
          SELECT 1 FROM assessment_questions q
          JOIN assessment_versions v ON q.assessment_version_id = v.id
          JOIN assessment_templates t ON v.assessment_template_id = t.id
          WHERE q.id = assessment_question_options.question_id
            AND t.owner_type = 'propel'
            AND t.status = 'published'
        )
        OR EXISTS (
          SELECT 1 FROM assessment_questions q
          JOIN assessment_versions v ON q.assessment_version_id = v.id
          WHERE q.id = assessment_question_options.question_id
            AND is_version_owner(v.id)
        )
      )
    )
  );

DROP POLICY IF EXISTS "assessment_question_options_insert" ON assessment_question_options;
CREATE POLICY "assessment_question_options_insert"
  ON assessment_question_options FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_admin()
    OR EXISTS (
      SELECT 1 FROM assessment_questions q
      JOIN assessment_versions v ON q.assessment_version_id = v.id
      WHERE q.id = assessment_question_options.question_id
        AND is_version_owner(v.id)
    )
  );

DROP POLICY IF EXISTS "assessment_question_options_update" ON assessment_question_options;
CREATE POLICY "assessment_question_options_update"
  ON assessment_question_options FOR UPDATE
  TO authenticated
  USING (
    is_active_admin()
    OR EXISTS (
      SELECT 1 FROM assessment_questions q
      JOIN assessment_versions v ON q.assessment_version_id = v.id
      WHERE q.id = assessment_question_options.question_id
        AND is_version_owner(v.id)
    )
  )
  WITH CHECK (
    is_active_admin()
    OR EXISTS (
      SELECT 1 FROM assessment_questions q
      JOIN assessment_versions v ON q.assessment_version_id = v.id
      WHERE q.id = assessment_question_options.question_id
        AND is_version_owner(v.id)
    )
  );

DROP POLICY IF EXISTS "assessment_question_options_delete" ON assessment_question_options;
CREATE POLICY "assessment_question_options_delete"
  ON assessment_question_options FOR DELETE
  TO authenticated
  USING (
    is_active_admin()
    OR EXISTS (
      SELECT 1 FROM assessment_questions q
      JOIN assessment_versions v ON q.assessment_version_id = v.id
      WHERE q.id = assessment_question_options.question_id
        AND is_version_owner(v.id)
    )
  );

-- ============================================================
-- assessment_responses policies
-- ============================================================
DROP POLICY IF EXISTS "assessment_responses_select" ON assessment_responses;
CREATE POLICY "assessment_responses_select"
  ON assessment_responses FOR SELECT
  TO authenticated
  USING (
    is_active_admin()
    OR is_instance_owner(assessment_responses.assessment_instance_id)
  );

DROP POLICY IF EXISTS "assessment_responses_insert" ON assessment_responses;
CREATE POLICY "assessment_responses_insert"
  ON assessment_responses FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_admin()
    OR is_instance_owner(assessment_responses.assessment_instance_id)
  );

DROP POLICY IF EXISTS "assessment_responses_update" ON assessment_responses;
CREATE POLICY "assessment_responses_update"
  ON assessment_responses FOR UPDATE
  TO authenticated
  USING (is_active_admin() OR is_instance_owner(assessment_responses.assessment_instance_id))
  WITH CHECK (is_active_admin() OR is_instance_owner(assessment_responses.assessment_instance_id));

DROP POLICY IF EXISTS "assessment_responses_delete" ON assessment_responses;
CREATE POLICY "assessment_responses_delete"
  ON assessment_responses FOR DELETE
  TO authenticated
  USING (is_active_admin());

-- ============================================================
-- assessment_section_scores policies
-- ============================================================
DROP POLICY IF EXISTS "assessment_section_scores_select" ON assessment_section_scores;
CREATE POLICY "assessment_section_scores_select"
  ON assessment_section_scores FOR SELECT
  TO authenticated
  USING (
    is_active_admin()
    OR is_instance_owner(assessment_section_scores.assessment_instance_id)
  );

DROP POLICY IF EXISTS "assessment_section_scores_insert" ON assessment_section_scores;
CREATE POLICY "assessment_section_scores_insert"
  ON assessment_section_scores FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_admin()
    OR is_instance_owner(assessment_section_scores.assessment_instance_id)
  );

DROP POLICY IF EXISTS "assessment_section_scores_update" ON assessment_section_scores;
CREATE POLICY "assessment_section_scores_update"
  ON assessment_section_scores FOR UPDATE
  TO authenticated
  USING (is_active_admin() OR is_instance_owner(assessment_section_scores.assessment_instance_id))
  WITH CHECK (is_active_admin() OR is_instance_owner(assessment_section_scores.assessment_instance_id));

DROP POLICY IF EXISTS "assessment_section_scores_delete" ON assessment_section_scores;
CREATE POLICY "assessment_section_scores_delete"
  ON assessment_section_scores FOR DELETE
  TO authenticated
  USING (is_active_admin());

-- ============================================================
-- assessment_results policies
-- ============================================================
DROP POLICY IF EXISTS "assessment_results_select" ON assessment_results;
CREATE POLICY "assessment_results_select"
  ON assessment_results FOR SELECT
  TO authenticated
  USING (
    is_active_admin()
    OR is_instance_owner(assessment_results.assessment_instance_id)
  );

DROP POLICY IF EXISTS "assessment_results_insert" ON assessment_results;
CREATE POLICY "assessment_results_insert"
  ON assessment_results FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_admin()
    OR is_instance_owner(assessment_results.assessment_instance_id)
  );

DROP POLICY IF EXISTS "assessment_results_update" ON assessment_results;
CREATE POLICY "assessment_results_update"
  ON assessment_results FOR UPDATE
  TO authenticated
  USING (is_active_admin() OR is_instance_owner(assessment_results.assessment_instance_id))
  WITH CHECK (is_active_admin() OR is_instance_owner(assessment_results.assessment_instance_id));

DROP POLICY IF EXISTS "assessment_results_delete" ON assessment_results;
CREATE POLICY "assessment_results_delete"
  ON assessment_results FOR DELETE
  TO authenticated
  USING (is_active_admin());

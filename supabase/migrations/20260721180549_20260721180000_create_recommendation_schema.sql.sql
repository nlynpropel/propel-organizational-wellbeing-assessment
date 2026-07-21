/*
# Recommendation engine schema

Additive tables for the deterministic recommendation engine.
No existing tables are modified.
*/

-- ============================================================
-- 1. recommendation_frameworks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recommendation_frameworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  version text NOT NULL,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, version)
);

-- ============================================================
-- 2. recommendations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id uuid NOT NULL REFERENCES public.recommendation_frameworks(id) ON DELETE CASCADE,
  bank_id text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  recommendation_type text NOT NULL CHECK (recommendation_type IN ('strength', 'priority_opportunity', 'quick_win', 'high_impact_move', 'meeting_question')),
  dimension_key text,
  driver_key text,
  effort_level text CHECK (effort_level IN ('low', 'medium', 'high')),
  impact_level text CHECK (impact_level IN ('low', 'medium', 'high')),
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (framework_id, bank_id)
);

CREATE INDEX IF NOT EXISTS idx_recommendations_framework ON public.recommendations(framework_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_type ON public.recommendations(recommendation_type);
CREATE INDEX IF NOT EXISTS idx_recommendations_active ON public.recommendations(is_active);

-- ============================================================
-- 3. recommendation_tags
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recommendation_tags (
  recommendation_id uuid NOT NULL REFERENCES public.recommendations(id) ON DELETE CASCADE,
  tag_key text NOT NULL,
  PRIMARY KEY (recommendation_id, tag_key)
);

CREATE INDEX IF NOT EXISTS idx_rec_tags_key ON public.recommendation_tags(tag_key);

-- ============================================================
-- 4. assessment_question_diagnostic_tags
-- ============================================================
CREATE TABLE IF NOT EXISTS public.assessment_question_diagnostic_tags (
  assessment_version_id uuid NOT NULL,
  question_id uuid NOT NULL,
  tag_key text NOT NULL,
  severity_threshold integer NOT NULL DEFAULT 3 CHECK (severity_threshold >= 0 AND severity_threshold <= 4),
  PRIMARY KEY (assessment_version_id, question_id, tag_key),
  FOREIGN KEY (assessment_version_id) REFERENCES public.assessment_versions(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES public.assessment_questions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_diag_tags_version ON public.assessment_question_diagnostic_tags(assessment_version_id);
CREATE INDEX IF NOT EXISTS idx_diag_tags_key ON public.assessment_question_diagnostic_tags(tag_key);

-- ============================================================
-- 5. assessment_result_recommendations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.assessment_result_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_result_id uuid NOT NULL REFERENCES public.assessment_results(id) ON DELETE CASCADE,
  recommendation_id uuid NOT NULL REFERENCES public.recommendations(id) ON DELETE RESTRICT,
  priority_score numeric NOT NULL DEFAULT 0,
  recommendation_type text NOT NULL CHECK (recommendation_type IN ('strength', 'priority_opportunity', 'quick_win', 'high_impact_move', 'meeting_question')),
  rationale_snapshot text NOT NULL,
  title_snapshot text NOT NULL,
  description_snapshot text NOT NULL,
  dimension_key_snapshot text,
  driver_key_snapshot text,
  effort_level_snapshot text,
  impact_level_snapshot text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_result_id, recommendation_id)
);

CREATE INDEX IF NOT EXISTS idx_arr_result ON public.assessment_result_recommendations(assessment_result_id);
CREATE INDEX IF NOT EXISTS idx_arr_type ON public.assessment_result_recommendations(recommendation_type);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.recommendation_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_question_diagnostic_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_result_recommendations ENABLE ROW LEVEL SECURITY;

-- Recommendation content is read-only reference data.
-- Brokers and admins can read; only service_role can write.
CREATE POLICY "read_recommendation_frameworks" ON public.recommendation_frameworks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "read_recommendations" ON public.recommendations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "read_recommendation_tags" ON public.recommendation_tags
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "read_diagnostic_tags" ON public.assessment_question_diagnostic_tags
  FOR SELECT TO authenticated USING (true);

-- Result recommendations: brokers can read their own instances' recommendations
CREATE POLICY "read_result_recommendations" ON public.assessment_result_recommendations
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.assessment_results ar
      JOIN public.assessment_instances ai ON ai.id = ar.assessment_instance_id
      WHERE ar.id = assessment_result_recommendations.assessment_result_id
        AND (ai.broker_id = auth.uid() OR public.is_active_admin())
    )
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_recommendation_frameworks_updated_at ON public.recommendation_frameworks;
CREATE TRIGGER trg_recommendation_frameworks_updated_at BEFORE UPDATE ON public.recommendation_frameworks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_recommendations_updated_at ON public.recommendations;
CREATE TRIGGER trg_recommendations_updated_at BEFORE UPDATE ON public.recommendations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
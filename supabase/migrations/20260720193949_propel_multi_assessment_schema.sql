/*
# Multi-assessment platform architecture

1. Purpose
- Transforms the Propel platform from a single-assessment system into a reusable
  multi-assessment architecture supporting Propel-owned and broker-owned
  assessments with versioning, sections, questions, scoring, and reporting.
- All existing tables and data are preserved. Changes are additive.

2. New Tables
- `assessment_templates` — top-level assessment definition (name, owner, category).
  - owner_type: 'propel' | 'broker'
  - owner_profile_id: nullable (null for Propel-owned)
  - status: 'draft' | 'published' | 'archived'
  - scoring_enabled, recommendations_enabled ( Propel-only )
  - category, estimated_minutes, short_description, full_description
- `assessment_sections` — sections within a version (e.g. "Leadership", "Culture").
  - assessment_version_id, title, description, display_order, weight, is_scored
- `assessment_questions` — questions within a section/version.
  - assessment_version_id, assessment_section_id, question_text, help_text
  - question_type (enum: agreement5, frequency5, maturity5, numeric_rating,
    yes_no, single_select, multi_select, custom_scored, short_text, long_text,
    numeric_input, date, information)
  - display_order, is_required, is_scored, weight, reverse_scored
  - reporting_label, scoring_dimension
- `assessment_question_options` — selectable options for a question.
  - question_id, option_label, option_value, score_value, display_order, is_not_applicable
- `assessment_responses` — a respondent's answer to a question.
  - assessment_instance_id, question_id
  - selected_option_id, numeric_value, text_value, boolean_value, score_value
- `assessment_section_scores` — computed section scores for an instance.
  - assessment_instance_id, section_id
  - raw_score, normalized_score, answered_question_count, possible_question_count
- `assessment_results` — final computed result for an instance.
  - assessment_instance_id, raw_score, normalized_score, score_band
  - completed_at, scoring_version, result_snapshot (JSONB)
- `assessment_score_bands` — per-version score band overrides.
  - assessment_version_id, band_name, min_threshold, max_threshold, display_order

3. Modified Tables
- `assessment_versions` — extended with:
  - assessment_template_id (FK to assessment_templates)
  - version_label, introduction_text, completion_message
  - scoring_method ('none' | 'simple' | 'weighted_sections')
  - maximum_possible_score, created_by
  - updated_at, recommendation_framework_id (nullable, future use)
  - show_overall_score (boolean)
  The existing (name, version_number, status, published_at, created_at) columns
  are preserved. `name` is kept for backward compatibility but the canonical
  name now lives on assessment_templates.
- `assessment_instances` — extended with:
  - assessment_template_id (FK to assessment_templates, nullable for back-compat)
  - broker_message (text, optional message from broker to respondent)
  - These are additive; existing rows keep NULL values.

4. Enums
- `assessment_owner_type`: 'propel' | 'broker'
- `assessment_template_status`: 'draft' | 'published' | 'archived'
- `assessment_question_type`: 13 question types (scored + unscored)
- `assessment_scoring_method`: 'none' | 'simple' | 'weighted_sections'

5. Indexes
- assessment_templates: owner_type, owner_profile_id, status, category
- assessment_versions: assessment_template_id, status
- assessment_sections: assessment_version_id, display_order
- assessment_questions: assessment_version_id, assessment_section_id, display_order
- assessment_question_options: question_id, display_order
- assessment_responses: assessment_instance_id, question_id (unique)
- assessment_section_scores: assessment_instance_id, section_id (unique)
- assessment_results: assessment_instance_id (unique)
- assessment_score_bands: assessment_version_id, display_order

6. Triggers
- assessment_templates, assessment_versions, assessment_questions: BEFORE UPDATE → set_updated_at()

7. Security
- RLS enabled on all new tables.
- Policies are in a SEPARATE migration for clarity.

8. Important Notes
1) The existing assessment_versions table is EXTENDED, not replaced. The
   existing unique constraint on (name, version_number) is preserved.
2) assessment_instances.assessment_version_id is now wired to the version
   that was selected when the instance was created, locking the respondent
   to that exact version.
3) assessment_templates.recommendations_enabled has a CHECK constraint:
   recommendations_enabled can only be true when owner_type = 'propel'.
   Broker-owned assessments can never have recommendations.
4) assessment_score_bands allows each version to override the default band
   names and thresholds. If no rows exist for a version, defaults are used.
5) All statements are idempotent (IF NOT EXISTS / DO $$ blocks / DROP IF EXISTS).
*/

-- ============================================================
-- Enums
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assessment_owner_type') THEN
    CREATE TYPE assessment_owner_type AS ENUM ('propel', 'broker');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assessment_template_status') THEN
    CREATE TYPE assessment_template_status AS ENUM ('draft', 'published', 'archived');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assessment_question_type') THEN
    CREATE TYPE assessment_question_type AS ENUM (
      'agreement5', 'frequency5', 'maturity5', 'numeric_rating',
      'yes_no', 'single_select', 'multi_select', 'custom_scored',
      'short_text', 'long_text', 'numeric_input', 'date', 'information'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assessment_scoring_method') THEN
    CREATE TYPE assessment_scoring_method AS ENUM ('none', 'simple', 'weighted_sections');
  END IF;
END $$;

-- ============================================================
-- assessment_templates
-- ============================================================
CREATE TABLE IF NOT EXISTS assessment_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  short_description text,
  full_description text,
  owner_type assessment_owner_type NOT NULL DEFAULT 'broker',
  owner_profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status assessment_template_status NOT NULL DEFAULT 'draft',
  category text,
  estimated_minutes integer,
  scoring_enabled boolean NOT NULL DEFAULT true,
  recommendations_enabled boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assessment_templates_recommendations_propel_only
    CHECK (
      recommendations_enabled = false
      OR owner_type = 'propel'
    )
);

CREATE INDEX IF NOT EXISTS idx_assessment_templates_owner_type ON assessment_templates(owner_type);
CREATE INDEX IF NOT EXISTS idx_assessment_templates_owner_profile_id ON assessment_templates(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_assessment_templates_status ON assessment_templates(status);
CREATE INDEX IF NOT EXISTS idx_assessment_templates_category ON assessment_templates(category);

ALTER TABLE assessment_templates ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_assessment_templates_set_updated_at ON assessment_templates;
CREATE TRIGGER trg_assessment_templates_set_updated_at
  BEFORE UPDATE ON assessment_templates
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- assessment_versions: extend existing table
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assessment_versions' AND column_name = 'assessment_template_id'
  ) THEN
    ALTER TABLE assessment_versions ADD COLUMN assessment_template_id uuid REFERENCES assessment_templates(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assessment_versions' AND column_name = 'version_label'
  ) THEN
    ALTER TABLE assessment_versions ADD COLUMN version_label text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assessment_versions' AND column_name = 'introduction_text'
  ) THEN
    ALTER TABLE assessment_versions ADD COLUMN introduction_text text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assessment_versions' AND column_name = 'completion_message'
  ) THEN
    ALTER TABLE assessment_versions ADD COLUMN completion_message text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assessment_versions' AND column_name = 'scoring_method'
  ) THEN
    ALTER TABLE assessment_versions ADD COLUMN scoring_method assessment_scoring_method NOT NULL DEFAULT 'none';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assessment_versions' AND column_name = 'maximum_possible_score'
  ) THEN
    ALTER TABLE assessment_versions ADD COLUMN maximum_possible_score numeric;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assessment_versions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE assessment_versions ADD COLUMN created_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assessment_versions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE assessment_versions ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assessment_versions' AND column_name = 'recommendation_framework_id'
  ) THEN
    ALTER TABLE assessment_versions ADD COLUMN recommendation_framework_id uuid;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assessment_versions' AND column_name = 'show_overall_score'
  ) THEN
    ALTER TABLE assessment_versions ADD COLUMN show_overall_score boolean NOT NULL DEFAULT true;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_assessment_versions_template_id ON assessment_versions(assessment_template_id);
CREATE INDEX IF NOT EXISTS idx_assessment_versions_status ON assessment_versions(status);

DROP TRIGGER IF EXISTS trg_assessment_versions_set_updated_at ON assessment_versions;
CREATE TRIGGER trg_assessment_versions_set_updated_at
  BEFORE UPDATE ON assessment_versions
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- assessment_score_bands
-- ============================================================
CREATE TABLE IF NOT EXISTS assessment_score_bands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_version_id uuid NOT NULL REFERENCES assessment_versions(id) ON DELETE CASCADE,
  band_name text NOT NULL,
  min_threshold numeric NOT NULL CHECK (min_threshold >= 0 AND min_threshold <= 100),
  max_threshold numeric NOT NULL CHECK (max_threshold >= 0 AND max_threshold <= 100),
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assessment_score_bands_min_lt_max CHECK (min_threshold < max_threshold)
);

CREATE INDEX IF NOT EXISTS idx_assessment_score_bands_version_id ON assessment_score_bands(assessment_version_id);
CREATE INDEX IF NOT EXISTS idx_assessment_score_bands_display_order ON assessment_score_bands(display_order);

ALTER TABLE assessment_score_bands ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- assessment_sections
-- ============================================================
CREATE TABLE IF NOT EXISTS assessment_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_version_id uuid NOT NULL REFERENCES assessment_versions(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  weight numeric NOT NULL DEFAULT 1.0,
  is_scored boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assessment_sections_version_id ON assessment_sections(assessment_version_id);
CREATE INDEX IF NOT EXISTS idx_assessment_sections_display_order ON assessment_sections(display_order);

ALTER TABLE assessment_sections ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_assessment_sections_set_updated_at ON assessment_sections;
CREATE TRIGGER trg_assessment_sections_set_updated_at
  BEFORE UPDATE ON assessment_sections
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- assessment_questions
-- ============================================================
CREATE TABLE IF NOT EXISTS assessment_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_version_id uuid NOT NULL REFERENCES assessment_versions(id) ON DELETE CASCADE,
  assessment_section_id uuid NOT NULL REFERENCES assessment_sections(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  help_text text,
  question_type assessment_question_type NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT true,
  is_scored boolean NOT NULL DEFAULT false,
  weight numeric NOT NULL DEFAULT 1.0,
  reverse_scored boolean NOT NULL DEFAULT false,
  reporting_label text,
  scoring_dimension text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assessment_questions_version_id ON assessment_questions(assessment_version_id);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_section_id ON assessment_questions(assessment_section_id);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_display_order ON assessment_questions(display_order);

ALTER TABLE assessment_questions ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_assessment_questions_set_updated_at ON assessment_questions;
CREATE TRIGGER trg_assessment_questions_set_updated_at
  BEFORE UPDATE ON assessment_questions
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- assessment_question_options
-- ============================================================
CREATE TABLE IF NOT EXISTS assessment_question_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES assessment_questions(id) ON DELETE CASCADE,
  option_label text NOT NULL,
  option_value text NOT NULL,
  score_value numeric,
  display_order integer NOT NULL DEFAULT 0,
  is_not_applicable boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assessment_question_options_question_id ON assessment_question_options(question_id);
CREATE INDEX IF NOT EXISTS idx_assessment_question_options_display_order ON assessment_question_options(display_order);

ALTER TABLE assessment_question_options ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- assessment_responses
-- ============================================================
CREATE TABLE IF NOT EXISTS assessment_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_instance_id uuid NOT NULL REFERENCES assessment_instances(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES assessment_questions(id) ON DELETE CASCADE,
  selected_option_id uuid REFERENCES assessment_question_options(id) ON DELETE SET NULL,
  numeric_value numeric,
  text_value text,
  boolean_value boolean,
  score_value numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_assessment_responses_instance_question ON assessment_responses(assessment_instance_id, question_id);
CREATE INDEX IF NOT EXISTS idx_assessment_responses_instance_id ON assessment_responses(assessment_instance_id);

ALTER TABLE assessment_responses ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_assessment_responses_set_updated_at ON assessment_responses;
CREATE TRIGGER trg_assessment_responses_set_updated_at
  BEFORE UPDATE ON assessment_responses
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- assessment_section_scores
-- ============================================================
CREATE TABLE IF NOT EXISTS assessment_section_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_instance_id uuid NOT NULL REFERENCES assessment_instances(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES assessment_sections(id) ON DELETE CASCADE,
  raw_score numeric,
  normalized_score numeric,
  answered_question_count integer NOT NULL DEFAULT 0,
  possible_question_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_assessment_section_scores_instance_section ON assessment_section_scores(assessment_instance_id, section_id);

ALTER TABLE assessment_section_scores ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- assessment_results
-- ============================================================
CREATE TABLE IF NOT EXISTS assessment_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_instance_id uuid NOT NULL UNIQUE REFERENCES assessment_instances(id) ON DELETE CASCADE,
  raw_score numeric,
  normalized_score numeric,
  score_band text,
  completed_at timestamptz NOT NULL DEFAULT now(),
  scoring_version text NOT NULL DEFAULT '1.0',
  result_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assessment_results_instance_id ON assessment_results(assessment_instance_id);

ALTER TABLE assessment_results ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_assessment_results_set_updated_at ON assessment_results;
CREATE TRIGGER trg_assessment_results_set_updated_at
  BEFORE UPDATE ON assessment_results
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- assessment_instances: extend existing table
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assessment_instances' AND column_name = 'assessment_template_id'
  ) THEN
    ALTER TABLE assessment_instances ADD COLUMN assessment_template_id uuid REFERENCES assessment_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assessment_instances' AND column_name = 'broker_message'
  ) THEN
    ALTER TABLE assessment_instances ADD COLUMN broker_message text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_assessment_instances_template_id ON assessment_instances(assessment_template_id);

/*
# Propel 360 — AI Analysis Generation Table and Vector Store Config

## Overview
Creates a dedicated generation table for Propel 360 AI analyses, plus a config table
to store the OpenAI vector store ID server-side.

## New Tables

### propel_360_generations
Stores versioned AI analysis generations for the 360 assessment.
- assessment_instance_id: links to the submitted assessment
- status: queued | generating | completed | failed
- output_markdown: the rendered AI analysis as markdown
- output_json: structured JSON version of the analysis
- model: OpenAI model used (e.g. gpt-4o)
- prompt_version: version of the prompt template used
- vector_store_id: OpenAI vector store ID used for file search
- guide_file_id: OpenAI file ID of the analysis guide
- created_by: the user who triggered generation
- created_at: when generation was started
- completed_at: when generation finished (success or failure)
- error_message: error details if status = failed
- supersedes_generation_id: links to the prior generation this one replaces

### propel_360_config
Stores server-side configuration for the 360 AI analysis.
- key: config key name (e.g. OPENAI_360_VECTOR_STORE_ID)
- value: the config value
- updated_at: last update timestamp

## Security
- RLS enabled on both tables
- propel_360_generations: only authenticated users with propel_csm or superadmin role can access
- propel_360_config: only authenticated superadmin can read/write
*/

-- Create enum type if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'propel_360_generation_status') THEN
    CREATE TYPE propel_360_generation_status AS ENUM ('queued', 'generating', 'completed', 'failed');
  END IF;
END $$;

-- ============================================================
-- 1. propel_360_generations table
-- ============================================================

CREATE TABLE IF NOT EXISTS propel_360_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_instance_id uuid NOT NULL REFERENCES assessment_instances(id) ON DELETE CASCADE,
  status propel_360_generation_status NOT NULL DEFAULT 'queued',
  output_markdown text,
  output_json jsonb,
  model text NOT NULL,
  prompt_version text NOT NULL,
  vector_store_id text,
  guide_file_id text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_message text,
  supersedes_generation_id uuid REFERENCES propel_360_generations(id) ON DELETE SET NULL
);

ALTER TABLE propel_360_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "propel_360_gen_select_csm_admin" ON propel_360_generations;
CREATE POLICY "propel_360_gen_select_csm_admin"
ON propel_360_generations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('superadmin', 'propel_csm')
    AND p.status = 'active'
  )
);

DROP POLICY IF EXISTS "propel_360_gen_insert_csm_admin" ON propel_360_generations;
CREATE POLICY "propel_360_gen_insert_csm_admin"
ON propel_360_generations FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('superadmin', 'propel_csm')
    AND p.status = 'active'
  )
);

DROP POLICY IF EXISTS "propel_360_gen_update_csm_admin" ON propel_360_generations;
CREATE POLICY "propel_360_gen_update_csm_admin"
ON propel_360_generations FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('superadmin', 'propel_csm')
    AND p.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('superadmin', 'propel_csm')
    AND p.status = 'active'
  )
);

CREATE INDEX IF NOT EXISTS idx_propel_360_gen_instance ON propel_360_generations(assessment_instance_id);
CREATE INDEX IF NOT EXISTS idx_propel_360_gen_status ON propel_360_generations(status);

-- ============================================================
-- 2. propel_360_config table
-- ============================================================

CREATE TABLE IF NOT EXISTS propel_360_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE propel_360_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "propel_360_config_select_admin" ON propel_360_config;
CREATE POLICY "propel_360_config_select_admin"
ON propel_360_config FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'superadmin'
    AND p.status = 'active'
  )
);

DROP POLICY IF EXISTS "propel_360_config_write_admin" ON propel_360_config;
CREATE POLICY "propel_360_config_write_admin"
ON propel_360_config FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'superadmin'
    AND p.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'superadmin'
    AND p.status = 'active'
  )
);

-- ============================================================
-- 3. Seed the guide file ID config
-- ============================================================

INSERT INTO propel_360_config (key, value)
VALUES ('OPENAI_360_GUIDE_FILE_ID', 'file-5sddQHMVKz7ALqZzJtb1ri')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
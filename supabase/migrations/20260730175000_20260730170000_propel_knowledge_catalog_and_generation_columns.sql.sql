/*
# Propel Knowledge Catalog + AI Generation Retrieval Columns

1. New Tables
- `propel_knowledge_catalog`
  - `id` (uuid, primary key)
  - `openai_file_id` (text, unique, not null) — the file ID returned by OpenAI when the knowledge document was uploaded
  - `title` (text, not null) — human-readable document title
  - `content_type` (text, not null) — category of knowledge (e.g. "framework", "research", "playbook")
  - `is_active` (boolean, default true) — whether this document should be included in retrieval
  - `client_facing_eligible` (boolean, default true) — whether this document is eligible to be cited in client-facing output
  - `created_at` (timestamptz, default now())

2. Modified Tables
- `analysis_generations`
  - ADD `retrieval_metadata` (jsonb, nullable) — stores file_search results, citation annotations, and validation status for audit
  - ADD `knowledge_enabled` (boolean, default false) — whether knowledge retrieval was active for this generation

3. Security
- Enable RLS on `propel_knowledge_catalog`.
- No policies are added: this table is service-role only (edge function reads it to verify citations). The anon/authenticated roles get no access, which is intentional — brokers and clients never query this table directly.
- The `analysis_generations` table already has RLS enabled; the two new columns inherit existing policies.

4. Important Notes
- The catalog table is populated manually via INSERT statements after files are uploaded to the OpenAI vector store.
- The edge function reads this table using the service role client to validate that cited files are active and client-facing eligible.
- `retrieval_metadata` stores internal OpenAI file IDs and vector store IDs for audit purposes; these are never exposed in broker-facing output.
- `knowledge_enabled` defaults to false so existing generations are unaffected.
*/

-- ============================================================
-- Propel Knowledge Catalog
-- ============================================================
CREATE TABLE IF NOT EXISTS propel_knowledge_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  openai_file_id text UNIQUE NOT NULL,
  title text NOT NULL,
  content_type text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  client_facing_eligible boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE propel_knowledge_catalog ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Analysis Generations: retrieval metadata columns
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'analysis_generations' AND column_name = 'retrieval_metadata'
  ) THEN
    ALTER TABLE analysis_generations ADD COLUMN retrieval_metadata jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'analysis_generations' AND column_name = 'knowledge_enabled'
  ) THEN
    ALTER TABLE analysis_generations ADD COLUMN knowledge_enabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;
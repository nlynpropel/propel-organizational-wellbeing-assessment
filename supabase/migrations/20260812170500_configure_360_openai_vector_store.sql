/*
# Configure OpenAI vector store for Propel 360 analysis

The generate-360-analysis Edge Function reads the vector store ID from
public.propel_360_config. Without this row, completed 360 assessments fail
with "Vector store ID not configured.".
*/

INSERT INTO public.propel_360_config (key, value)
VALUES
  ('OPENAI_360_VECTOR_STORE_ID', 'vs_6a6b90e8a9708191bdd70e76e118aa3e'),
  ('OPENAI_360_GUIDE_FILE_ID', 'file-5sddQHMVKz7ALqZzJtb1ri')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;

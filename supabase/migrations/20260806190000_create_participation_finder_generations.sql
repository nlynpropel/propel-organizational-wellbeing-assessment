/*
# participation_finder_generations

Stores the AI-generated (or fallback) result shown to a respondent after
completing The Well-being Participation Improvement Finder. Unlike
analysis_generations (broker-reviewed strategy reports), there is no
draft/review/approval workflow -- a prospect sees their result
immediately, so this is intentionally minimal: one row per instance.

No anon/authenticated RLS policies are granted -- this table is only
ever read/written by the generate-participation-opportunity-result edge
function using the service role key, the same trust model already used
for assessment_instances/assessment_responses (SECURITY DEFINER RPCs
validated by secure_token, not direct table grants).
*/

CREATE TABLE IF NOT EXISTS public.participation_finder_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_instance_id uuid NOT NULL UNIQUE REFERENCES public.assessment_instances(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'succeeded' CHECK (status IN ('succeeded', 'failed')),
  output_json jsonb NOT NULL,
  used_fallback boolean NOT NULL DEFAULT false,
  error_message text,
  model_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_participation_finder_generations_instance_id
  ON public.participation_finder_generations(assessment_instance_id);

ALTER TABLE public.participation_finder_generations ENABLE ROW LEVEL SECURITY;
/*
# Add 'category_weighted' scoring method

Supports assessments (like the Employee Participation Opportunity Finder)
that compute several independently-weighted category scores instead of
a single section-averaged score. Must be its own migration — Postgres
won't let a new enum value be used in the same transaction it's added in.
*/

ALTER TYPE assessment_scoring_method ADD VALUE 'category_weighted';

-- Tags a specific answer OPTION (not a whole question) with an opportunity
-- category. Used only by the priority/tie-break question (Q9), where each
-- of the 6 answer choices maps to a different category.
CREATE TABLE IF NOT EXISTS public.assessment_question_option_categories (
  option_id uuid PRIMARY KEY REFERENCES public.assessment_question_options(id) ON DELETE CASCADE,
  category_key text NOT NULL
);

ALTER TABLE public.assessment_question_option_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_option_categories" ON public.assessment_question_option_categories
  FOR SELECT USING (true);
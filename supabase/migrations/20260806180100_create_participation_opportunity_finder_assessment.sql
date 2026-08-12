/*
# The Well-being Participation Improvement Finder — assessment definition

9-question lead-magnet assessment. Q1-Q8 are diagnostic (4-point scale,
reverse-scored). Q9 is a priority/tie-break question, not scored on the
same scale -- its 6 options are tagged with categories via
assessment_question_option_categories instead.

Category weights use a dedicated table, assessment_question_category_weights
(not assessment_question_driver_mappings, which is hard-locked via CHECK
constraint to the other assessment's behavioral-readiness driver keys).

Every ID below is captured via RETURNING ... INTO and used only within
this same transaction -- nothing outside this file ever references a
literal UUID from here.
*/

CREATE TABLE IF NOT EXISTS public.assessment_question_category_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_version_id uuid NOT NULL REFERENCES public.assessment_versions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
  category_key text NOT NULL,
  weight numeric NOT NULL DEFAULT 1.0 CHECK (weight > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.assessment_question_category_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_category_weights" ON public.assessment_question_category_weights
  FOR SELECT USING (true);

DO $$
DECLARE
  v_template_id uuid;
  v_version_id uuid;
  v_section_id uuid;
  q1 uuid; q2 uuid; q3 uuid; q4 uuid; q5 uuid; q6 uuid; q7 uuid; q8 uuid; q9 uuid;
  q9_a uuid; q9_b uuid; q9_c uuid; q9_d uuid; q9_e uuid; q9_f uuid;
BEGIN
  -- 1. Template
  INSERT INTO public.assessment_templates (name, short_description, owner_type, status, category, estimated_minutes, scoring_enabled, recommendations_enabled)
  VALUES (
    'The Well-being Participation Improvement Finder',
    'A 3-minute diagnostic that identifies the single most practical opportunity to improve employee well-being participation.',
    'propel', 'draft', 'lead_magnet', 3, true, false
  ) RETURNING id INTO v_template_id;

  -- 2. Version
  INSERT INTO public.assessment_versions (
    name, version_number, status, assessment_template_id, version_label,
    introduction_text, completion_message, scoring_method, show_overall_score,
    respondent_results_enabled, respondent_score_enabled,
    respondent_section_scores_enabled, respondent_recommendations_enabled
  ) VALUES (
    'The Well-being Participation Improvement Finder v1', 1, 'draft', v_template_id, 'v1.0',
    'What is the most practical way to improve employee well-being participation? You may already offer valuable resources, activities, and benefits. This short assessment identifies the participation opportunity most likely to make a difference for your organization right now. In about three minutes, you will receive your primary participation opportunity, a secondary opportunity, a practical 30-day action, and one simple measure to track. No detailed participation data is required.',
    'Thank you for completing The Well-being Participation Improvement Finder. Your personalized results are ready below.',
    'category_weighted', false, true, false, false, false
  ) RETURNING id INTO v_version_id;

  -- 3. Section (single, flat -- the source spec doesn't describe sub-groupings)
  INSERT INTO public.assessment_sections (assessment_version_id, title, description, display_order, weight, is_scored)
  VALUES (v_version_id, 'Participation Diagnostic', 'Nine questions about how employees currently engage with well-being programming.', 1, 1, true)
  RETURNING id INTO v_section_id;

  -- 4. Questions 1-8: 4-point scale, reverse-scored (opportunity points = 4 - value)
  INSERT INTO public.assessment_questions (assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored)
  VALUES (v_version_id, v_section_id, 'When employees encounter our well-being efforts, they are usually given one clear and manageable action to take first.', 'Examples might include joining a short challenge, completing a brief educational activity, exploring a behavioral pathway, or selecting a recommended personal goal.', 'custom_scored', 1, true, true, 1, true)
  RETURNING id INTO q1;

  INSERT INTO public.assessment_questions (assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored)
  VALUES (v_version_id, v_section_id, 'Employees can begin participating without having to sort through multiple messages, resources, or complicated instructions.', NULL, 'custom_scored', 2, true, true, 1, true)
  RETURNING id INTO q2;

  INSERT INTO public.assessment_questions (assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored)
  VALUES (v_version_id, v_section_id, 'After an employee completes one activity, we provide another relevant reason or opportunity to participate.', NULL, 'custom_scored', 3, true, true, 1, true)
  RETURNING id INTO q3;

  INSERT INTO public.assessment_questions (assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored)
  VALUES (v_version_id, v_section_id, 'Employees receive well-being activities or participation opportunities at multiple points during the year, rather than only during an annual event or isolated campaign.', 'This question does not assume that year-round programming is inherently required. It helps determine whether lack of continuity is limiting participation.', 'custom_scored', 4, true, true, 1, true)
  RETURNING id INTO q4;

  INSERT INTO public.assessment_questions (assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored)
  VALUES (v_version_id, v_section_id, 'Our well-being activities give employees opportunities to participate with coworkers, teams, departments, or other groups.', NULL, 'custom_scored', 5, true, true, 1, true)
  RETURNING id INTO q5;

  INSERT INTO public.assessment_questions (assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored)
  VALUES (v_version_id, v_section_id, 'Employees can participate through multiple topics or formats -- not only physical activity or a single type of challenge.', 'Examples might include physical, mental, financial, social, educational, or lifestyle-focused activities.', 'custom_scored', 6, true, true, 1, true)
  RETURNING id INTO q6;

  INSERT INTO public.assessment_questions (assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored)
  VALUES (v_version_id, v_section_id, 'Our team can launch and manage a new well-being activity without it becoming a major administrative project.', NULL, 'custom_scored', 7, true, true, 1, true)
  RETURNING id INTO q7;

  INSERT INTO public.assessment_questions (assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored)
  VALUES (v_version_id, v_section_id, 'We can quickly access enough information to understand which activities employees are using and where participation is strongest or weakest.', 'This refers to participation, activity, challenge, and educational engagement data -- not claims analysis or clinical outcomes.', 'custom_scored', 8, true, true, 1, true)
  RETURNING id INTO q8;

  -- Question 9: priority/tie-break question, NOT scored on the 1-4 scale
  INSERT INTO public.assessment_questions (assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored)
  VALUES (v_version_id, v_section_id, 'Which outcome would be most valuable to your organization over the next six months?', NULL, 'single_select', 9, true, false, 0, false)
  RETURNING id INTO q9;

  -- 5. Options for Q1-Q8 (identical 4-point scale on every question)
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, display_order) VALUES
    (q1, 'Not currently true', '1', 1), (q1, 'True to a limited extent', '2', 2), (q1, 'Mostly true', '3', 3), (q1, 'Consistently true', '4', 4);
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, display_order) VALUES
    (q2, 'Not currently true', '1', 1), (q2, 'True to a limited extent', '2', 2), (q2, 'Mostly true', '3', 3), (q2, 'Consistently true', '4', 4);
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, display_order) VALUES
    (q3, 'Not currently true', '1', 1), (q3, 'True to a limited extent', '2', 2), (q3, 'Mostly true', '3', 3), (q3, 'Consistently true', '4', 4);
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, display_order) VALUES
    (q4, 'Not currently true', '1', 1), (q4, 'True to a limited extent', '2', 2), (q4, 'Mostly true', '3', 3), (q4, 'Consistently true', '4', 4);
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, display_order) VALUES
    (q5, 'Not currently true', '1', 1), (q5, 'True to a limited extent', '2', 2), (q5, 'Mostly true', '3', 3), (q5, 'Consistently true', '4', 4);
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, display_order) VALUES
    (q6, 'Not currently true', '1', 1), (q6, 'True to a limited extent', '2', 2), (q6, 'Mostly true', '3', 3), (q6, 'Consistently true', '4', 4);
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, display_order) VALUES
    (q7, 'Not currently true', '1', 1), (q7, 'True to a limited extent', '2', 2), (q7, 'Mostly true', '3', 3), (q7, 'Consistently true', '4', 4);
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, display_order) VALUES
    (q8, 'Not currently true', '1', 1), (q8, 'True to a limited extent', '2', 2), (q8, 'Mostly true', '3', 3), (q8, 'Consistently true', '4', 4);

  -- Options for Q9 -- capture each option's id so we can tag it with a category below
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, display_order) VALUES (q9, 'Help more employees take a first action', 'A', 1) RETURNING id INTO q9_a;
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, display_order) VALUES (q9, 'Keep employees participating after an initial activity', 'B', 2) RETURNING id INTO q9_b;
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, display_order) VALUES (q9, 'Create more team or peer participation', 'C', 3) RETURNING id INTO q9_c;
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, display_order) VALUES (q9, 'Engage employees through a wider variety of topics', 'D', 4) RETURNING id INTO q9_d;
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, display_order) VALUES (q9, 'Make the program easier for HR to manage', 'E', 5) RETURNING id INTO q9_e;
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, display_order) VALUES (q9, 'Better understand what employees are using', 'F', 6) RETURNING id INTO q9_f;

  -- 6. Category weights (Q1-Q8)
  INSERT INTO public.assessment_question_category_weights (assessment_version_id, question_id, category_key, weight) VALUES
    (v_version_id, q1, 'CFA', 2.0),
    (v_version_id, q2, 'CFA', 1.0),
    (v_version_id, q2, 'RAB', 0.5),
    (v_version_id, q3, 'BPM', 2.0),
    (v_version_id, q4, 'BPM', 1.0),
    (v_version_id, q5, 'MPS', 2.0),
    (v_version_id, q6, 'EWP', 2.0),
    (v_version_id, q7, 'RAB', 2.0),
    (v_version_id, q8, 'IVW', 2.0);

  -- 7. Q9 option -> category tags (priority adjustment)
  INSERT INTO public.assessment_question_option_categories (option_id, category_key) VALUES
    (q9_a, 'CFA'), (q9_b, 'BPM'), (q9_c, 'MPS'), (q9_d, 'EWP'), (q9_e, 'RAB'), (q9_f, 'IVW');

  -- 8. Interpretation bands (internal tone guidance, not a prospect-facing score)
  INSERT INTO public.assessment_score_bands (assessment_version_id, band_name, min_threshold, max_threshold) VALUES
    (v_version_id, 'Existing strength', 0, 24),
    (v_version_id, 'Enhancement opportunity', 25, 49),
    (v_version_id, 'Meaningful opportunity', 50, 74),
    (v_version_id, 'Priority opportunity', 75, 100);
END $$;
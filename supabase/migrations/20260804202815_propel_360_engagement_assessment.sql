/*
# Propel 360 Engagement Assessment — Template, Version, Sections, Questions, Options

## Overview
Creates a new published assessment template called "Propel 360 Engagement Assessment"
with 8 sections, structured questions, and response options. This is an unscored
internal-planning assessment — no scoring, no maturity, no respondent-facing results.

## Sections (in document order)
1. Mission and Vision
2. Program Structure
3. Program Administration
4. Program Reach
5. Program Communication
6. Program Measurables
7. Incentives
8. Culture Integration

## Question Types Used
- single_select: for program component, program reach, communication-resource, and satisfaction/culture scales
- multi_select: for selecting multiple items
- long_text: for open-text responses
- short_text: for brief text responses

## Response Option Sets
- Program component: Will Include, May Include, Will Not Include
- Program reach: Included, May Be Included, Will Not Be Included
- Communication-resource: Currently Available, Unavailable but Would Like to Use, Do Not Use and Would Not Use
- Satisfaction/culture: 5-point scale (Strongly Disagree -> Strongly Agree)

## Report Configuration
- report_type = 'unscored_internal'
- scoring_enabled = false
- maturity_enabled = false
- section_scores_enabled = false
- behavioral_driver_scores_enabled = false
- respondent_result_mode = 'submission_confirmation'
- recommendations_enabled = false
*/

-- ============================================================
-- 1. Create the assessment template
-- ============================================================

INSERT INTO assessment_templates (
  id, name, short_description, full_description, owner_type, status,
  category, estimated_minutes, scoring_enabled, recommendations_enabled,
  report_type, maturity_enabled, section_scores_enabled,
  behavioral_driver_scores_enabled, respondent_result_mode
)
VALUES (
  'a1b2c3d4-0001-4000-8000-000000000001'::uuid,
  'Propel 360 Engagement Assessment',
  'A comprehensive internal-planning assessment covering mission, programs, communication, measurables, incentives, and culture.',
  'The Propel 360 Engagement Assessment is an unscored internal-planning instrument designed to capture a holistic picture of an organization''s employee health and well-being engagement. It covers mission and vision, program structure, administration, reach, communication, measurables, incentives, and culture integration. Responses are used to generate an internal AI analysis for Propel Client Services — no scores, recommendations, or analysis are shown to the respondent.',
  'propel', 'published', 'Engagement', 30,
  false, false,
  'unscored_internal', false, false, false,
  'submission_confirmation'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  full_description = EXCLUDED.full_description,
  status = EXCLUDED.status,
  category = EXCLUDED.category,
  estimated_minutes = EXCLUDED.estimated_minutes,
  scoring_enabled = EXCLUDED.scoring_enabled,
  recommendations_enabled = EXCLUDED.recommendations_enabled,
  report_type = EXCLUDED.report_type,
  maturity_enabled = EXCLUDED.maturity_enabled,
  section_scores_enabled = EXCLUDED.section_scores_enabled,
  behavioral_driver_scores_enabled = EXCLUDED.behavioral_driver_scores_enabled,
  respondent_result_mode = EXCLUDED.respondent_result_mode,
  updated_at = now();

-- ============================================================
-- 2. Create the published version
-- ============================================================

INSERT INTO assessment_versions (
  id, assessment_template_id, name, version_number, version_label, status,
  introduction_text, completion_message, scoring_method, show_overall_score,
  respondent_results_enabled, respondent_score_enabled,
  respondent_section_scores_enabled, respondent_recommendations_enabled,
  respondent_intro_text, published_at
)
VALUES (
  'a1b2c3d4-0002-4000-8000-000000000001'::uuid,
  'a1b2c3d4-0001-4000-8000-000000000001'::uuid,
  'Propel 360 Engagement Assessment v1', 1, 'v1', 'published',
  'This assessment helps us understand your organization''s approach to employee health and well-being engagement. Your responses will be used internally by your Propel Client Services team to tailor recommendations and program design. There are no scores or grades — your honest input is what matters.',
  'Thank you — your assessment has been submitted. Your Propel Client Services team will follow up with you soon.',
  'none', false, false, false, false, false,
  'This assessment helps us understand your organization''s approach to employee health and well-being engagement.',
  now()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, version_number = EXCLUDED.version_number,
  version_label = EXCLUDED.version_label, status = EXCLUDED.status,
  introduction_text = EXCLUDED.introduction_text,
  completion_message = EXCLUDED.completion_message,
  scoring_method = EXCLUDED.scoring_method,
  show_overall_score = EXCLUDED.show_overall_score,
  respondent_results_enabled = EXCLUDED.respondent_results_enabled,
  respondent_score_enabled = EXCLUDED.respondent_score_enabled,
  respondent_section_scores_enabled = EXCLUDED.respondent_section_scores_enabled,
  respondent_recommendations_enabled = EXCLUDED.respondent_recommendations_enabled,
  respondent_intro_text = EXCLUDED.respondent_intro_text,
  published_at = EXCLUDED.published_at, updated_at = now();

-- ============================================================
-- 3. Create sections (deterministic UUIDs via uuid_generate_v5)
-- ============================================================

DO $$
DECLARE
  v_id uuid := 'a1b2c3d4-0002-4000-8000-000000000001'::uuid;
  ns uuid := 'b1000000-0000-4000-8000-000000000000'::uuid;
  sections text[][] := ARRAY[
    ['Mission and Vision', 'Understanding the organization''s overarching mission and vision for employee health and well-being.'],
    ['Program Structure', 'The programs and services that make up the organization''s well-being offering.'],
    ['Program Administration', 'How programs are managed, staffed, and governed.'],
    ['Program Reach', 'Who programs are designed to reach and how access is provided.'],
    ['Program Communication', 'How the organization communicates about programs and resources to employees.'],
    ['Program Measurables', 'How the organization measures program effectiveness and outcomes.'],
    ['Incentives', 'How incentives are used to drive engagement in well-being programs.'],
    ['Culture Integration', 'How well-being is integrated into the organization''s culture.']
  ];
  s_id uuid;
BEGIN
  FOR i IN 1..array_length(sections, 1) LOOP
    s_id := uuid_generate_v5(ns, 'section-' || i::text);
    INSERT INTO assessment_sections (id, assessment_version_id, title, description, display_order, weight, is_scored)
    VALUES (s_id, v_id, sections[i][1], sections[i][2], i, 1.0, false)
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title, description = EXCLUDED.description,
      display_order = EXCLUDED.display_order, is_scored = EXCLUDED.is_scored,
      updated_at = now();
  END LOOP;
END $$;

-- ============================================================
-- 4. Create questions
-- ============================================================

DO $$
DECLARE
  v_id uuid := 'a1b2c3d4-0002-4000-8000-000000000001'::uuid;
  ns uuid := 'b2000000-0000-4000-8000-000000000000'::uuid;
  s1 uuid := uuid_generate_v5('b1000000-0000-4000-8000-000000000000'::uuid, 'section-1');
  s2 uuid := uuid_generate_v5('b1000000-0000-4000-8000-000000000000'::uuid, 'section-2');
  s3 uuid := uuid_generate_v5('b1000000-0000-4000-8000-000000000000'::uuid, 'section-3');
  s4 uuid := uuid_generate_v5('b1000000-0000-4000-8000-000000000000'::uuid, 'section-4');
  s5 uuid := uuid_generate_v5('b1000000-0000-4000-8000-000000000000'::uuid, 'section-5');
  s6 uuid := uuid_generate_v5('b1000000-0000-4000-8000-000000000000'::uuid, 'section-6');
  s7 uuid := uuid_generate_v5('b1000000-0000-4000-8000-000000000000'::uuid, 'section-7');
  s8 uuid := uuid_generate_v5('b1000000-0000-4000-8000-000000000000'::uuid, 'section-8');
  q_id uuid;
  order_idx int;
BEGIN
  -- Section 1: Mission and Vision
  q_id := uuid_generate_v5(ns, 'q-1-1');
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (q_id, v_id, s1, 'What is your organization''s mission statement?', 'long_text', 1, false, false, 1.0, 'If your organization has a formal mission statement, please share it here.')
  ON CONFLICT (id) DO UPDATE SET question_text = EXCLUDED.question_text, question_type = EXCLUDED.question_type, display_order = EXCLUDED.display_order, help_text = EXCLUDED.help_text, updated_at = now();

  q_id := uuid_generate_v5(ns, 'q-1-2');
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (q_id, v_id, s1, 'What is your organization''s vision for employee health and well-being?', 'long_text', 2, false, false, 1.0, 'Describe the aspirational goals your organization has for employee well-being.')
  ON CONFLICT (id) DO UPDATE SET question_text = EXCLUDED.question_text, question_type = EXCLUDED.question_type, display_order = EXCLUDED.display_order, help_text = EXCLUDED.help_text, updated_at = now();

  q_id := uuid_generate_v5(ns, 'q-1-3');
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (q_id, v_id, s1, 'How does employee health and well-being align with your organization''s broader business objectives?', 'long_text', 3, false, false, 1.0, NULL)
  ON CONFLICT (id) DO UPDATE SET question_text = EXCLUDED.question_text, question_type = EXCLUDED.question_type, display_order = EXCLUDED.display_order, updated_at = now();

  q_id := uuid_generate_v5(ns, 'q-1-4');
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (q_id, v_id, s1, 'Who is the executive sponsor or champion for employee well-being at your organization?', 'short_text', 4, false, false, 1.0, 'Please provide the name and title if available.')
  ON CONFLICT (id) DO UPDATE SET question_text = EXCLUDED.question_text, question_type = EXCLUDED.question_type, display_order = EXCLUDED.display_order, help_text = EXCLUDED.help_text, updated_at = now();

  -- Section 2: Program Structure
  q_id := uuid_generate_v5(ns, 'q-2-1');
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (q_id, v_id, s2, 'Which of the following program components does your organization currently offer? Select all that apply.', 'multi_select', 1, false, false, 1.0, 'Select all components that are part of your well-being program.')
  ON CONFLICT (id) DO UPDATE SET question_text = EXCLUDED.question_text, question_type = EXCLUDED.question_type, display_order = EXCLUDED.display_order, help_text = EXCLUDED.help_text, updated_at = now();

  q_id := uuid_generate_v5(ns, 'q-2-2');
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (q_id, v_id, s2, 'For each program component below, indicate whether your organization will include it, may include it, or will not include it in the coming year.', 'single_select', 2, false, false, 1.0, 'Select one option per row.')
  ON CONFLICT (id) DO UPDATE SET question_text = EXCLUDED.question_text, question_type = EXCLUDED.question_type, display_order = EXCLUDED.display_order, help_text = EXCLUDED.help_text, updated_at = now();

  q_id := uuid_generate_v5(ns, 'q-2-3');
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (q_id, v_id, s2, 'Please describe any additional programs or services not listed above.', 'long_text', 3, false, false, 1.0, NULL)
  ON CONFLICT (id) DO UPDATE SET question_text = EXCLUDED.question_text, question_type = EXCLUDED.question_type, display_order = EXCLUDED.display_order, updated_at = now();

  -- Section 3: Program Administration
  q_id := uuid_generate_v5(ns, 'q-3-1');
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (q_id, v_id, s3, 'Who is responsible for administering your well-being program? (List staff names, titles, and roles)', 'long_text', 1, false, false, 1.0, 'Add or remove rows as needed to capture all staff involved.')
  ON CONFLICT (id) DO UPDATE SET question_text = EXCLUDED.question_text, question_type = EXCLUDED.question_type, display_order = EXCLUDED.display_order, help_text = EXCLUDED.help_text, updated_at = now();

  q_id := uuid_generate_v5(ns, 'q-3-2');
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (q_id, v_id, s3, 'What external resources or vendors does your organization use to support well-being programs? (List vendor name, service provided, and contact)', 'long_text', 2, false, false, 1.0, 'Add or remove rows as needed to capture all external resources.')
  ON CONFLICT (id) DO UPDATE SET question_text = EXCLUDED.question_text, question_type = EXCLUDED.question_type, display_order = EXCLUDED.display_order, help_text = EXCLUDED.help_text, updated_at = now();

  q_id := uuid_generate_v5(ns, 'q-3-3');
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (q_id, v_id, s3, 'How is your well-being program governed? (e.g., steering committee, advisory board, etc.)', 'long_text', 3, false, false, 1.0, NULL)
  ON CONFLICT (id) DO UPDATE SET question_text = EXCLUDED.question_text, question_type = EXCLUDED.question_type, display_order = EXCLUDED.display_order, updated_at = now();

  q_id := uuid_generate_v5(ns, 'q-3-4');
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (q_id, v_id, s3, 'What is your annual well-being program budget range?', 'single_select', 4, false, false, 1.0, NULL)
  ON CONFLICT (id) DO UPDATE SET question_text = EXCLUDED.question_text, question_type = EXCLUDED.question_type, display_order = EXCLUDED.display_order, updated_at = now();

  -- Section 4: Program Reach
  q_id := uuid_generate_v5(ns, 'q-4-1');
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (q_id, v_id, s4, 'Which populations are included in your well-being program reach? Indicate whether each group is included, may be included, or will not be included.', 'single_select', 1, false, false, 1.0, 'Select one option per row.')
  ON CONFLICT (id) DO UPDATE SET question_text = EXCLUDED.question_text, question_type = EXCLUDED.question_type, display_order = EXCLUDED.display_order, help_text = EXCLUDED.help_text, updated_at = now();

  q_id := uuid_generate_v5(ns, 'q-4-2');
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (q_id, v_id, s4, 'How do employees access your well-being programs? (e.g., on-site, online, app, phone, etc.)', 'long_text', 2, false, false, 1.0, NULL)
  ON CONFLICT (id) DO UPDATE SET question_text = EXCLUDED.question_text, question_type = EXCLUDED.question_type, display_order = EXCLUDED.display_order, updated_at = now();

  q_id := uuid_generate_v5(ns, 'q-4-3');
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (q_id, v_id, s4, 'What barriers prevent employees from accessing your well-being programs?', 'long_text', 3, false, false, 1.0, NULL)
  ON CONFLICT (id) DO UPDATE SET question_text = EXCLUDED.question_text, question_type = EXCLUDED.question_type, display_order = EXCLUDED.display_order, updated_at = now();

  -- Section 5: Program Communication
  q_id := uuid_generate_v5(ns, 'q-5-1');
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (q_id, v_id, s5, 'For each communication resource below, indicate whether it is currently available, unavailable but you would like to use it, or you do not use it and would not use it.', 'single_select', 1, false, false, 1.0, 'Select one option per row.')
  ON CONFLICT (id) DO UPDATE SET question_text = EXCLUDED.question_text, question_type = EXCLUDED.question_type, display_order = EXCLUDED.display_order, help_text = EXCLUDED.help_text, updated_at = now();

  q_id := uuid_generate_v5(ns, 'q-5-2');
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (q_id, v_id, s5, 'How frequently do you communicate with employees about well-being programs?', 'single_select', 2, false, false, 1.0, NULL)
  ON CONFLICT (id) DO UPDATE SET question_text = EXCLUDED.question_text, question_type = EXCLUDED.question_type, display_order = EXCLUDED.display_order, updated_at = now();

  q_id := uuid_generate_v5(ns, 'q-5-3');
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (q_id, v_id, s5, 'What is your primary communication channel for well-being information?', 'short_text', 3, false, false, 1.0, NULL)
  ON CONFLICT (id) DO UPDATE SET question_text = EXCLUDED.question_text, question_type = EXCLUDED.question_type, display_order = EXCLUDED.display_order, updated_at = now();

  -- Section 6: Program Measurables
  q_id := uuid_generate_v5(ns, 'q-6-1');
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (q_id, v_id, s6, 'What metrics does your organization track to measure well-being program effectiveness?', 'long_text', 1, false, false, 1.0, 'List the specific metrics or KPIs you track.')
  ON CONFLICT (id) DO UPDATE SET question_text = EXCLUDED.question_text, question_type = EXCLUDED.question_type, display_order = EXCLUDED.display_order, help_text = EXCLUDED.help_text, updated_at = now();

  q_id := uuid_generate_v5(ns, 'q-6-2');
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (q_id, v_id, s6, 'How do you collect and report on well-being program data?', 'long_text', 2, false, false, 1.0, NULL)
  ON CONFLICT (id) DO UPDATE SET question_text = EXCLUDED.question_text, question_type = EXCLUDED.question_type, display_order = EXCLUDED.display_order, updated_at = now();

  q_id := uuid_generate_v5(ns, 'q-6-3');
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (q_id, v_id, s6, 'What outcomes or goals has your organization set for its well-being program?', 'long_text', 3, false, false, 1.0, NULL)
  ON CONFLICT (id) DO UPDATE SET question_text = EXCLUDED.question_text, question_type = EXCLUDED.question_type, display_order = EXCLUDED.display_order, updated_at = now();

  -- Section 7: Incentives
  q_id := uuid_generate_v5(ns, 'q-7-1');
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (q_id, v_id, s7, 'Does your organization use incentives to encourage participation in well-being programs?', 'single_select', 1, false, false, 1.0, NULL)
  ON CONFLICT (id) DO UPDATE SET question_text = EXCLUDED.question_text, question_type = EXCLUDED.question_type, display_order = EXCLUDED.display_order, updated_at = now();

  q_id := uuid_generate_v5(ns, 'q-7-2');
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (q_id, v_id, s7, 'If yes, what types of incentives are offered? Select all that apply.', 'multi_select', 2, false, false, 1.0, 'Select all incentive types that apply.')
  ON CONFLICT (id) DO UPDATE SET question_text = EXCLUDED.question_text, question_type = EXCLUDED.question_type, display_order = EXCLUDED.display_order, help_text = EXCLUDED.help_text, updated_at = now();

  q_id := uuid_generate_v5(ns, 'q-7-3');
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (q_id, v_id, s7, 'What is the approximate annual incentive budget for well-being programs?', 'short_text', 3, false, false, 1.0, NULL)
  ON CONFLICT (id) DO UPDATE SET question_text = EXCLUDED.question_text, question_type = EXCLUDED.question_type, display_order = EXCLUDED.display_order, updated_at = now();

  q_id := uuid_generate_v5(ns, 'q-7-4');
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (q_id, v_id, s7, 'How are incentives structured? (e.g., individual, team-based, tiered, etc.)', 'long_text', 4, false, false, 1.0, NULL)
  ON CONFLICT (id) DO UPDATE SET question_text = EXCLUDED.question_text, question_type = EXCLUDED.question_type, display_order = EXCLUDED.display_order, updated_at = now();

  -- Section 8: Culture Integration
  q_id := uuid_generate_v5(ns, 'q-8-1');
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (q_id, v_id, s8, 'Leadership at my organization actively supports and participates in well-being initiatives.', 'single_select', 1, false, false, 1.0, 'Rate on a 5-point scale from Strongly Disagree to Strongly Agree.')
  ON CONFLICT (id) DO UPDATE SET question_text = EXCLUDED.question_text, question_type = EXCLUDED.question_type, display_order = EXCLUDED.display_order, help_text = EXCLUDED.help_text, updated_at = now();

  q_id := uuid_generate_v5(ns, 'q-8-2');
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (q_id, v_id, s8, 'Well-being is integrated into our organization''s values and daily practices.', 'single_select', 2, false, false, 1.0, 'Rate on a 5-point scale from Strongly Disagree to Strongly Agree.')
  ON CONFLICT (id) DO UPDATE SET question_text = EXCLUDED.question_text, question_type = EXCLUDED.question_type, display_order = EXCLUDED.display_order, help_text = EXCLUDED.help_text, updated_at = now();

  q_id := uuid_generate_v5(ns, 'q-8-3');
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (q_id, v_id, s8, 'Managers at my organization encourage and support employee well-being.', 'single_select', 3, false, false, 1.0, 'Rate on a 5-point scale from Strongly Disagree to Strongly Agree.')
  ON CONFLICT (id) DO UPDATE SET question_text = EXCLUDED.question_text, question_type = EXCLUDED.question_type, display_order = EXCLUDED.display_order, help_text = EXCLUDED.help_text, updated_at = now();

  q_id := uuid_generate_v5(ns, 'q-8-4');
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (q_id, v_id, s8, 'Employees at my organization feel comfortable participating in well-being programs without stigma.', 'single_select', 4, false, false, 1.0, 'Rate on a 5-point scale from Strongly Disagree to Strongly Agree.')
  ON CONFLICT (id) DO UPDATE SET question_text = EXCLUDED.question_text, question_type = EXCLUDED.question_type, display_order = EXCLUDED.display_order, help_text = EXCLUDED.help_text, updated_at = now();

  q_id := uuid_generate_v5(ns, 'q-8-5');
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (q_id, v_id, s8, 'How would you describe the overall culture of well-being at your organization?', 'long_text', 5, false, false, 1.0, NULL)
  ON CONFLICT (id) DO UPDATE SET question_text = EXCLUDED.question_text, question_type = EXCLUDED.question_type, display_order = EXCLUDED.display_order, updated_at = now();
END $$;

-- ============================================================
-- 5. Create response options
-- ============================================================

DO $$
DECLARE
  ns uuid := 'b3000000-0000-4000-8000-000000000000'::uuid;
  qns uuid := 'b2000000-0000-4000-8000-000000000000'::uuid;
  q_id uuid;
  opt_id uuid;
  i int;
  labels text[];
  vals text[];
BEGIN
  -- Program component options (Will Include / May Include / Will Not Include)
  q_id := uuid_generate_v5(qns, 'q-2-2');
  labels := ARRAY['Will Include', 'May Include', 'Will Not Include'];
  vals := ARRAY['will_include', 'may_include', 'will_not_include'];
  FOR i IN 1..3 LOOP
    opt_id := uuid_generate_v5(ns, 'opt-2-2-' || i::text);
    INSERT INTO assessment_question_options (id, question_id, option_label, option_value, score_value, display_order, is_not_applicable)
    VALUES (opt_id, q_id, labels[i], vals[i], null, i, false)
    ON CONFLICT (id) DO UPDATE SET option_label = EXCLUDED.option_label, option_value = EXCLUDED.option_value, display_order = EXCLUDED.display_order;
  END LOOP;

  -- Multi-select program components (for q-2-1)
  q_id := uuid_generate_v5(qns, 'q-2-1');
  labels := ARRAY['Biometric Screening','Health Coaching','Mental Health / EAP','Fitness Program','Nutrition Program','Weight Management','Stress Management','Financial Wellness','Tobacco Cessation','Sleep Health','On-Site Clinic','Telehealth Services'];
  vals := ARRAY['biometric_screening','health_coaching','mental_health_eap','fitness_program','nutrition_program','weight_management','stress_management','financial_wellness','tobacco_cessation','sleep_health','onsite_clinic','telehealth_services'];
  FOR i IN 1..array_length(labels, 1) LOOP
    opt_id := uuid_generate_v5(ns, 'opt-2-1-' || i::text);
    INSERT INTO assessment_question_options (id, question_id, option_label, option_value, score_value, display_order, is_not_applicable)
    VALUES (opt_id, q_id, labels[i], vals[i], null, i, false)
    ON CONFLICT (id) DO UPDATE SET option_label = EXCLUDED.option_label, option_value = EXCLUDED.option_value, display_order = EXCLUDED.display_order;
  END LOOP;

  -- Budget range options (for q-3-4)
  q_id := uuid_generate_v5(qns, 'q-3-4');
  labels := ARRAY['Less than $25,000','$25,000 - $50,000','$50,001 - $100,000','$100,001 - $250,000','More than $250,000','Prefer not to say'];
  vals := ARRAY['under_25k','25k_50k','50k_100k','100k_250k','over_250k','prefer_not_to_say'];
  FOR i IN 1..6 LOOP
    opt_id := uuid_generate_v5(ns, 'opt-3-4-' || i::text);
    INSERT INTO assessment_question_options (id, question_id, option_label, option_value, score_value, display_order, is_not_applicable)
    VALUES (opt_id, q_id, labels[i], vals[i], null, i, false)
    ON CONFLICT (id) DO UPDATE SET option_label = EXCLUDED.option_label, option_value = EXCLUDED.option_value, display_order = EXCLUDED.display_order;
  END LOOP;

  -- Program reach options (Included / May Be Included / Will Not Be Included)
  q_id := uuid_generate_v5(qns, 'q-4-1');
  labels := ARRAY['Included', 'May Be Included', 'Will Not Be Included'];
  vals := ARRAY['included', 'may_be_included', 'will_not_be_included'];
  FOR i IN 1..3 LOOP
    opt_id := uuid_generate_v5(ns, 'opt-4-1-' || i::text);
    INSERT INTO assessment_question_options (id, question_id, option_label, option_value, score_value, display_order, is_not_applicable)
    VALUES (opt_id, q_id, labels[i], vals[i], null, i, false)
    ON CONFLICT (id) DO UPDATE SET option_label = EXCLUDED.option_label, option_value = EXCLUDED.option_value, display_order = EXCLUDED.display_order;
  END LOOP;

  -- Communication resource options
  q_id := uuid_generate_v5(qns, 'q-5-1');
  labels := ARRAY['Currently Available', 'Unavailable but Would Like to Use', 'Do Not Use and Would Not Use'];
  vals := ARRAY['currently_available', 'unavailable_would_like', 'do_not_use'];
  FOR i IN 1..3 LOOP
    opt_id := uuid_generate_v5(ns, 'opt-5-1-' || i::text);
    INSERT INTO assessment_question_options (id, question_id, option_label, option_value, score_value, display_order, is_not_applicable)
    VALUES (opt_id, q_id, labels[i], vals[i], null, i, false)
    ON CONFLICT (id) DO UPDATE SET option_label = EXCLUDED.option_label, option_value = EXCLUDED.option_value, display_order = EXCLUDED.display_order;
  END LOOP;

  -- Communication frequency options
  q_id := uuid_generate_v5(qns, 'q-5-2');
  labels := ARRAY['Weekly','Monthly','Quarterly','Annually','Only for specific events/campaigns'];
  vals := ARRAY['weekly','monthly','quarterly','annually','event_based'];
  FOR i IN 1..5 LOOP
    opt_id := uuid_generate_v5(ns, 'opt-5-2-' || i::text);
    INSERT INTO assessment_question_options (id, question_id, option_label, option_value, score_value, display_order, is_not_applicable)
    VALUES (opt_id, q_id, labels[i], vals[i], null, i, false)
    ON CONFLICT (id) DO UPDATE SET option_label = EXCLUDED.option_label, option_value = EXCLUDED.option_value, display_order = EXCLUDED.display_order;
  END LOOP;

  -- Incentive yes/no/planning
  q_id := uuid_generate_v5(qns, 'q-7-1');
  labels := ARRAY['Yes', 'No', 'Planning to add incentives'];
  vals := ARRAY['yes', 'no', 'planning'];
  FOR i IN 1..3 LOOP
    opt_id := uuid_generate_v5(ns, 'opt-7-1-' || i::text);
    INSERT INTO assessment_question_options (id, question_id, option_label, option_value, score_value, display_order, is_not_applicable)
    VALUES (opt_id, q_id, labels[i], vals[i], null, i, false)
    ON CONFLICT (id) DO UPDATE SET option_label = EXCLUDED.option_label, option_value = EXCLUDED.option_value, display_order = EXCLUDED.display_order;
  END LOOP;

  -- Incentive types multi-select
  q_id := uuid_generate_v5(qns, 'q-7-2');
  labels := ARRAY['Cash / Gift Cards','Premium Contributions / Insurance Discount','HSA / FSA Contributions','Merchandise / Wearables','Extra PTO','Recognition / Awards','Points-Based Rewards','Team-Based Competitions'];
  vals := ARRAY['cash_gift_cards','premium_discount','hsa_fsa','merchandise','extra_pto','recognition_awards','points_based','team_competitions'];
  FOR i IN 1..8 LOOP
    opt_id := uuid_generate_v5(ns, 'opt-7-2-' || i::text);
    INSERT INTO assessment_question_options (id, question_id, option_label, option_value, score_value, display_order, is_not_applicable)
    VALUES (opt_id, q_id, labels[i], vals[i], null, i, false)
    ON CONFLICT (id) DO UPDATE SET option_label = EXCLUDED.option_label, option_value = EXCLUDED.option_value, display_order = EXCLUDED.display_order;
  END LOOP;

  -- 5-point satisfaction/culture scale for questions q-8-1 through q-8-4
  labels := ARRAY['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'];
  vals := ARRAY['strongly_disagree', 'disagree', 'neutral', 'agree', 'strongly_agree'];
  FOR q_num IN 1..4 LOOP
    q_id := uuid_generate_v5(qns, 'q-8-' || q_num::text);
    FOR i IN 1..5 LOOP
      opt_id := uuid_generate_v5(ns, 'opt-8-' || q_num::text || '-' || i::text);
      INSERT INTO assessment_question_options (id, question_id, option_label, option_value, score_value, display_order, is_not_applicable)
      VALUES (opt_id, q_id, labels[i], vals[i], null, i, false)
      ON CONFLICT (id) DO UPDATE SET option_label = EXCLUDED.option_label, option_value = EXCLUDED.option_value, display_order = EXCLUDED.display_order;
    END LOOP;
  END LOOP;
END $$;
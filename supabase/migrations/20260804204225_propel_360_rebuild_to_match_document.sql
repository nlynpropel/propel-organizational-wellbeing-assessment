/*
# Propel 360 — Rebuild assessment to match source document exactly
*/

SET search_path TO public, extensions;

-- Disable triggers temporarily
ALTER TABLE assessment_versions DISABLE TRIGGER trg_protect_published_version;
ALTER TABLE assessment_sections DISABLE TRIGGER trg_protect_published_sections;
ALTER TABLE assessment_questions DISABLE TRIGGER trg_protect_published_questions;
ALTER TABLE assessment_question_options DISABLE TRIGGER trg_protect_published_options;

-- Set to draft
UPDATE assessment_versions
SET status = 'draft'
WHERE id = 'a1b2c3d4-0002-4000-8000-000000000001'::uuid;

-- Delete all existing sections (cascades to questions, then options)
DELETE FROM assessment_sections
WHERE assessment_version_id = 'a1b2c3d4-0002-4000-8000-000000000001'::uuid;

-- Create 7 sections
DO $$
DECLARE
  v_id uuid := 'a1b2c3d4-0002-4000-8000-000000000001'::uuid;
  ns uuid := 'b1000000-0000-4000-8000-000000000000'::uuid;
  sections text[][] := ARRAY[
    ['Mission and Vision', 'Understanding the organization''s overarching mission and vision for employee health and well-being.'],
    ['Program Structure', 'The programs and services that make up the organization''s well-being offering.'],
    ['Program Administration', 'How programs are managed, staffed, and resourced.'],
    ['Program Reach', 'Who programs are designed to reach and how eligibility is defined.'],
    ['Program Communication', 'How the organization communicates about programs and resources to employees.'],
    ['Program Measurables', 'How the organization measures program effectiveness, satisfaction, and outcomes.'],
    ['Culture Integration', 'How well-being is integrated into the organization''s culture.']
  ];
  s_id uuid;
BEGIN
  FOR i IN 1..array_length(sections, 1) LOOP
    s_id := uuid_generate_v5(ns, 'section-' || i::text);
    INSERT INTO assessment_sections (id, assessment_version_id, title, description, display_order, weight, is_scored)
    VALUES (s_id, v_id, sections[i][1], sections[i][2], i, 1.0, false);
  END LOOP;
END $$;

-- Create all questions and options
DO $$
DECLARE
  v_id uuid := 'a1b2c3d4-0002-4000-8000-000000000001'::uuid;
  qns uuid := 'b2000000-0000-4000-8000-000000000000'::uuid;
  ons uuid := 'b3000000-0000-4000-8000-000000000000'::uuid;
  sns uuid := 'b1000000-0000-4000-8000-000000000000'::uuid;
  s1 uuid := uuid_generate_v5(sns, 'section-1');
  s2 uuid := uuid_generate_v5(sns, 'section-2');
  s3 uuid := uuid_generate_v5(sns, 'section-3');
  s4 uuid := uuid_generate_v5(sns, 'section-4');
  s5 uuid := uuid_generate_v5(sns, 'section-5');
  s6 uuid := uuid_generate_v5(sns, 'section-6');
  s7 uuid := uuid_generate_v5(sns, 'section-7');
  q_id uuid;
  opt_id uuid;

  components text[] := ARRAY[
    'Financial incentive program',
    'Non-financial incentive program (e.g., a program that rewards virtual badges or certificates, or that may include minimal financial incentives such as spot awards, raffles, dept party, etc.)',
    'Health Risk Assessment',
    'Biometric Screenings (you may decide to include screenings for some or all your members)',
    'Health Coaching (you may decide to include coaching for some or all your members)',
    'Disease Management (you may decide to include DM for some or all your members)',
    'Well-being Challenges (Individual/team/group)',
    'Virtual Health Fair and/or Benefits Fair',
    'Compliance Education Section (this can be used for any type of content—does not have to be well-being-related)',
    'Well-being Content and Self-paced programs (includes physical activity, nutrition, stress-management, sleep-management, mental health, financial well-being, recipe library, etc.)',
    'Comprehensive Guided Fitness Video Library',
    '"Well-being Champions" Program',
    'Employee recognition (this can be used for any type of recognition—does not have to be well-being-program-related—and can include a colleague-nomination component as well as a gift-card award if desired)',
    'Benefits Communication Section ("Benefits Hub")',
    'Community Initiatives Section',
    'Single-Sign-On Connection to Company Intranet',
    'Single-Sign-On Connection to Third-party Vendor(s)'
  ];

  groups_arr text[] := ARRAY[
    'U.S.-based Employees',
    'Employees outside the U.S.',
    'Spouses',
    'Dependents (other than spouses)',
    'Retirees',
    'Contractors',
    'Other (please describe in the response to question 2 below)'
  ];

  internal_resources text[] := ARRAY[
    'Company Email',
    'Flyers (8.5x11")',
    'Posters (11x17")',
    'Digital Message (for TV monitors)',
    'Postcards/Desk-drops',
    'PowerPoint Presentations',
    'Talking Points for Team Meetings',
    'Video Promos/Messaging',
    'Other (please describe in the response to question 2 below)'
  ];

  thirdparty_resources text[] := ARRAY[
    'Email',
    'Flyers (8.5x11")',
    'Posters (11x17")',
    'Digital Message (for TV monitors)',
    'Postcards/Desk-drops',
    'PowerPoint Presentations',
    'Talking Points for Team Meetings',
    'Video Promos/Messaging',
    'Other (please describe in the response to question 2 below)'
  ];

  satisfaction_labels text[] := ARRAY['Extremely Dissatisfied', 'Somewhat Dissatisfied', 'Satisfied', 'Very Satisfied', 'Extremely Satisfied'];
  satisfaction_vals text[] := ARRAY['extremely_dissatisfied', 'somewhat_dissatisfied', 'satisfied', 'very_satisfied', 'extremely_satisfied'];

  culture_labels text[] := ARRAY['Non-existent', 'Just getting started', 'Have had some success but need to improve', 'Well-defined and ready to move to the next level', 'Fully integrated; a key to our success'];
  culture_vals text[] := ARRAY['non_existent', 'just_getting_started', 'some_success_need_to_improve', 'well_defined_ready_for_next_level', 'fully_integrated_key_to_success'];

  leadership_labels text[] := ARRAY['Not on board yet', 'Not engaged but there is interest', 'Reasonable support but not fully integrated', 'Great support with key sponsors', 'Clear active support from all senior leadership'];
  leadership_vals text[] := ARRAY['not_on_board_yet', 'not_engaged_but_interest', 'reasonable_support_not_fully_integrated', 'great_support_key_sponsors', 'clear_active_support_all_leadership'];

  comp_labels text[] := ARRAY['Will Include', 'May Include', 'Will Not Include'];
  comp_vals text[] := ARRAY['will_include', 'may_include', 'will_not_include'];

  reach_labels text[] := ARRAY['Included', 'May Be Included', 'Will Not Be Included'];
  reach_vals text[] := ARRAY['included', 'may_be_included', 'will_not_be_included'];

  comm_labels text[] := ARRAY['Currently Available', 'Unavailable but Would Like to Use', 'Do Not Use and Would Not Use'];
  comm_vals text[] := ARRAY['currently_available', 'unavailable_would_like', 'do_not_use'];

BEGIN
  -- Section 1: Mission and Vision
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (uuid_generate_v5(qns, 'q-1-1'), v_id, s1, 'What is your organization''s mission statement?', 'long_text', 1, false, false, 1.0, NULL);

  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (uuid_generate_v5(qns, 'q-1-2'), v_id, s1, 'What is the vision for your well-being program? Do you have core well-being program pillars?', 'long_text', 2, false, false, 1.0, NULL);

  -- Section 2: Program Structure
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (uuid_generate_v5(qns, 'q-2-0'), v_id, s2, 'What do you intend to include as program elements going forward?', 'information', 1, false, false, 1.0, 'For each component below, indicate whether your organization will include it, may include it, or will not include it.');

  FOR i IN 1..array_length(components, 1) LOOP
    q_id := uuid_generate_v5(qns, 'q-2-c' || i::text);
    INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
    VALUES (q_id, v_id, s2, components[i], 'single_select', i + 1, false, false, 1.0, NULL);

    FOR j IN 1..3 LOOP
      opt_id := uuid_generate_v5(ons, 'opt-2-c' || i::text || '-' || j::text);
      INSERT INTO assessment_question_options (id, question_id, option_label, option_value, score_value, display_order, is_not_applicable)
      VALUES (opt_id, q_id, comp_labels[j], comp_vals[j], null, j, false);
    END LOOP;
  END LOOP;

  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (uuid_generate_v5(qns, 'q-2-oth'), v_id, s2, 'What other program components do you intend to include that are not described above?', 'long_text', 19, false, false, 1.0, NULL);

  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (uuid_generate_v5(qns, 'q-2-gap'), v_id, s2, 'What program components are currently in place but not meeting your expectations? Please indicate for each, the gap that exists and the desired state.', 'long_text', 20, false, false, 1.0, NULL);

  -- Section 3: Program Administration
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (uuid_generate_v5(qns, 'q-3-1'), v_id, s3, 'In the table below, please identify the staff members available to support the well-being program administration (for example, well-being program managers, communication staff members, etc.). Please include both full-time and part-time resources, the formal job titles of those resources and the amount of time per week each person currently spends supporting the well-being program.', 'long_text', 1, false, false, 1.0, 'Please list: Staff Member Name, Job Title, Average Amount of Time Spent Per Week Supporting the Program');

  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (uuid_generate_v5(qns, 'q-3-2'), v_id, s3, 'Please list and describe all available tools/resources (non-staff resources) available to assist in program administration (for example, you may receive support from your broker or a communication/design vendor or you may have a vendor managing an onsite fitness center, or you may use scheduling software to help schedule onsite events, etc.).', 'long_text', 2, false, false, 1.0, 'Please list: Resource, What Support Is Provided, Average Amount of Time Spent Per Week Supporting the Program');

  -- Section 4: Program Reach
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (uuid_generate_v5(qns, 'q-4-0'), v_id, s4, 'Who will be eligible to participate in your well-being program going forward?', 'information', 1, false, false, 1.0, 'For each group below, indicate whether they are included, may be included, or will not be included.');

  FOR i IN 1..array_length(groups_arr, 1) LOOP
    q_id := uuid_generate_v5(qns, 'q-4-g' || i::text);
    INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
    VALUES (q_id, v_id, s4, groups_arr[i], 'single_select', i + 1, false, false, 1.0, NULL);

    FOR j IN 1..3 LOOP
      opt_id := uuid_generate_v5(ons, 'opt-4-g' || i::text || '-' || j::text);
      INSERT INTO assessment_question_options (id, question_id, option_label, option_value, score_value, display_order, is_not_applicable)
      VALUES (opt_id, q_id, reach_labels[j], reach_vals[j], null, j, false);
    END LOOP;
  END LOOP;

  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (uuid_generate_v5(qns, 'q-4-spec'), v_id, s4, 'Please indicate any special conditions or considerations regarding who will be included in the well-being program (for example, you may include employees from some divisions/countries but not all; you may include some members in incentive programming while others are not included, members may subject to different incentive programs, etc.).', 'long_text', 9, false, false, 1.0, NULL);

  -- Section 5: Program Communication
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (uuid_generate_v5(qns, 'q-5-0a'), v_id, s5, 'Please complete the following table for internal company communication resources.', 'information', 1, false, false, 1.0, 'For each resource below, indicate whether it is currently available, unavailable but you would like to use it, or you do not use it and would not use it.');

  FOR i IN 1..array_length(internal_resources, 1) LOOP
    q_id := uuid_generate_v5(qns, 'q-5-ir' || i::text);
    INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
    VALUES (q_id, v_id, s5, internal_resources[i], 'single_select', i + 1, false, false, 1.0, NULL);

    FOR j IN 1..3 LOOP
      opt_id := uuid_generate_v5(ons, 'opt-5-ir' || i::text || '-' || j::text);
      INSERT INTO assessment_question_options (id, question_id, option_label, option_value, score_value, display_order, is_not_applicable)
      VALUES (opt_id, q_id, comm_labels[j], comm_vals[j], null, j, false);
    END LOOP;
  END LOOP;

  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (uuid_generate_v5(qns, 'q-5-1'), v_id, s5, 'Please list and describe any additional internal communication tools not identified above that are available to you currently. Please be specific.', 'long_text', 11, false, false, 1.0, NULL);

  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (uuid_generate_v5(qns, 'q-5-2'), v_id, s5, 'For the above-identified currently-available resources (from the chart and your response to question 2), please identify who is responsible (a) for creating the resource and (b) for distributing the resource.', 'long_text', 12, false, false, 1.0, NULL);

  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (uuid_generate_v5(qns, 'q-5-3'), v_id, s5, 'In what ways do employees currently connect/communicate with one another using your current vendor''s program resources (if any)? In what ways would you like to see changes?', 'long_text', 13, false, false, 1.0, NULL);

  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (uuid_generate_v5(qns, 'q-5-0b'), v_id, s5, 'Please complete the following table for third-party communication resources. This would include communication resources that are provided by your current program vendor or other third-party vendor in support of your well-being program.', 'information', 14, false, false, 1.0, 'For each resource below, indicate whether it is currently available, unavailable but you would like to use it, or you do not use it and would not use it.');

  FOR i IN 1..array_length(thirdparty_resources, 1) LOOP
    q_id := uuid_generate_v5(qns, 'q-5-tr' || i::text);
    INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
    VALUES (q_id, v_id, s5, thirdparty_resources[i], 'single_select', i + 14, false, false, 1.0, NULL);

    FOR j IN 1..3 LOOP
      opt_id := uuid_generate_v5(ons, 'opt-5-tr' || i::text || '-' || j::text);
      INSERT INTO assessment_question_options (id, question_id, option_label, option_value, score_value, display_order, is_not_applicable)
      VALUES (opt_id, q_id, comm_labels[j], comm_vals[j], null, j, false);
    END LOOP;
  END LOOP;

  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (uuid_generate_v5(qns, 'q-5-gap'), v_id, s5, 'In the space below, please identify the current gaps in overall communication effectiveness and describe the desired state.', 'long_text', 24, false, false, 1.0, NULL);

  -- Section 6: Program Measurables
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (uuid_generate_v5(qns, 'q-6-1'), v_id, s6, 'What are the key objectives/goals of the program in the year ahead, and the year after?', 'long_text', 1, false, false, 1.0, NULL);

  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (uuid_generate_v5(qns, 'q-6-2'), v_id, s6, 'Please list the current well-being program''s top three successes.', 'long_text', 2, false, false, 1.0, NULL);

  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (uuid_generate_v5(qns, 'q-6-3'), v_id, s6, 'Please list the current well-being program''s top three pain points.', 'long_text', 3, false, false, 1.0, NULL);

  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (uuid_generate_v5(qns, 'q-6-4a'), v_id, s6, 'If you have a current well-being program platform, please provide rough estimates for the below:', 'information', 4, false, false, 1.0, NULL);

  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (uuid_generate_v5(qns, 'q-6-4b'), v_id, s6, 'Current registration percentage (# registered/total eligible employees)', 'short_text', 5, false, false, 1.0, NULL);

  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (uuid_generate_v5(qns, 'q-6-4c'), v_id, s6, 'Current incentive program participation percentage (calculated by dividing the # of registered employees completing at least some of the program by the total # registered). Mark N/A if you aren''t running an incentive program.', 'short_text', 6, false, false, 1.0, NULL);

  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (uuid_generate_v5(qns, 'q-6-4d'), v_id, s6, 'Any platform statistics you have been given by your previous platform provider', 'long_text', 7, false, false, 1.0, NULL);

  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (uuid_generate_v5(qns, 'q-6-5'), v_id, s6, 'In what ways will you measure the success of your program in each of the next two years?', 'long_text', 8, false, false, 1.0, NULL);

  FOR i IN 1..4 LOOP
    q_id := uuid_generate_v5(qns, 'q-6-s' || i::text);
    INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
    VALUES (q_id, v_id, s6,
      CASE i
        WHEN 1 THEN 'How satisfied are you with the current level of employee well-being program engagement?'
        WHEN 2 THEN 'How satisfied are you with the current state of program administration support and resources?'
        WHEN 3 THEN 'How satisfied are you with the current state of all program communication support, tools, and resources?'
        WHEN 4 THEN 'How satisfied are you with the incentive program strategy/design you are using?'
      END,
      'single_select', i + 8, false, false, 1.0, NULL);

    FOR j IN 1..5 LOOP
      opt_id := uuid_generate_v5(ons, 'opt-6-s' || i::text || '-' || j::text);
      INSERT INTO assessment_question_options (id, question_id, option_label, option_value, score_value, display_order, is_not_applicable)
      VALUES (opt_id, q_id, satisfaction_labels[j], satisfaction_vals[j], null, j, false);
    END LOOP;
  END LOOP;

  -- Section 7: Culture Integration
  q_id := uuid_generate_v5(qns, 'q-7-1');
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (q_id, v_id, s7, 'How would you define your well-being culture today?', 'single_select', 1, false, false, 1.0, NULL);

  FOR j IN 1..5 LOOP
    opt_id := uuid_generate_v5(ons, 'opt-7-1-' || j::text);
    INSERT INTO assessment_question_options (id, question_id, option_label, option_value, score_value, display_order, is_not_applicable)
    VALUES (opt_id, q_id, culture_labels[j], culture_vals[j], null, j, false);
  END LOOP;

  q_id := uuid_generate_v5(qns, 'q-7-2');
  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (q_id, v_id, s7, 'To what extent is the senior leadership team committed to building a culture of well-being?', 'single_select', 2, false, false, 1.0, NULL);

  FOR j IN 1..5 LOOP
    opt_id := uuid_generate_v5(ons, 'opt-7-2-' || j::text);
    INSERT INTO assessment_question_options (id, question_id, option_label, option_value, score_value, display_order, is_not_applicable)
    VALUES (opt_id, q_id, leadership_labels[j], leadership_vals[j], null, j, false);
  END LOOP;

  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (uuid_generate_v5(qns, 'q-7-3'), v_id, s7, 'What times during the year are employees brought together, either in-person or virtually? (e.g., annual conference, quarterly reporting, community event, etc.)', 'long_text', 3, false, false, 1.0, NULL);

  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (uuid_generate_v5(qns, 'q-7-4'), v_id, s7, 'Please list any brand marketing assets or partnerships your organization has? (e.g., NASCAR or Formula 1 Sponsorship; major league sports sponsorship, etc.)', 'long_text', 4, false, false, 1.0, NULL);

  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (uuid_generate_v5(qns, 'q-7-5'), v_id, s7, 'What is unique about your organization''s culture? What would employees miss if they left your organization and went to work elsewhere?', 'long_text', 5, false, false, 1.0, NULL);

  INSERT INTO assessment_questions (id, assessment_version_id, assessment_section_id, question_text, question_type, display_order, is_required, is_scored, weight, help_text)
  VALUES (uuid_generate_v5(qns, 'q-7-6'), v_id, s7, 'Please list any social/affinity/community/support group initiatives your organization has in place.', 'long_text', 6, false, false, 1.0, NULL);
END $$;

-- Re-publish the version
UPDATE assessment_versions
SET status = 'published', published_at = now()
WHERE id = 'a1b2c3d4-0002-4000-8000-000000000001'::uuid;

-- Re-enable triggers
ALTER TABLE assessment_versions ENABLE TRIGGER trg_protect_published_version;
ALTER TABLE assessment_sections ENABLE TRIGGER trg_protect_published_sections;
ALTER TABLE assessment_questions ENABLE TRIGGER trg_protect_published_questions;
ALTER TABLE assessment_question_options ENABLE TRIGGER trg_protect_published_options;
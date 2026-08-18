/*
# Create Propel Well-being Opportunity Index assessment (first production Propel-owned assessment)

1. Summary
   Creates the first production Propel-owned assessment template with one draft version
   containing 7 sections, 28 questions (25 scored custom_scored + 3 contextual), 128 answer
   options, and 5 score bands. Respondent visibility is disabled (broker-facing report only).

2. Records Created
   - 1 assessment_template (owner_type='propel', category='Organizational Well-being Strategy')
   - 1 assessment_version (version_number=1, status='draft', scoring_method='weighted_sections')
   - 7 assessment_sections (6 scored with weight=1, 1 contextual with weight=0)
   - 28 assessment_questions (25 scored custom_scored with weight=1, 3 contextual: 2 multi_select, 1 long_text)
   - 128 assessment_question_options (5 per scored question, 12 per multi_select, 0 for long_text)
   - 5 assessment_score_bands (Reactive, Developing, Established, Strategic, Leading)

3. Scoring Configuration
   - Each scored response: 1-5 points
   - Section normalization: points earned / max possible * 100
   - Overall: equal-weighted average of 6 normalized section scores
   - All scored questions: weight=1, reverse_scored=false, is_required=true
   - Not-applicable: not enabled for scored questions
   - Contextual section (Section 7): weight=0, is_scored=false

4. Respondent Visibility
   - respondent_results_enabled = false
   - respondent_score_enabled = false
   - respondent_section_scores_enabled = false
   - respondent_recommendations_enabled = false
   - show_overall_score = true (broker report)

5. Security
   - No RLS or policy changes. Records inherit existing policies.
   - owner_type='propel' means no owner_profile_id is needed.

6. Important Notes
   - Version status is 'draft' — it will be published in a subsequent migration after validation.
   - No recommendation mappings are created (per requirements).
   - maximum_selections=3 set on the two multi_select contextual questions.
*/

DO $$
DECLARE
  v_template_id uuid;
  v_version_id uuid;
  s1 uuid; s2 uuid; s3 uuid; s4 uuid; s5 uuid; s6 uuid; s7 uuid;
  q1 uuid; q2 uuid; q3 uuid; q4 uuid; q5 uuid; q6 uuid; q7 uuid; q8 uuid; q9 uuid; q10 uuid;
  q11 uuid; q12 uuid; q13 uuid; q14 uuid; q15 uuid; q16 uuid; q17 uuid; q18 uuid; q19 uuid; q20 uuid;
  q21 uuid; q22 uuid; q23 uuid; q24 uuid; q25 uuid; q26 uuid; q27 uuid; q28 uuid;
BEGIN
  -- Template
  INSERT INTO public.assessment_templates (name, short_description, full_description, owner_type, status, category, estimated_minutes, scoring_enabled, recommendations_enabled)
  VALUES (
    'Propel Well-being Opportunity Index',
    'An organizational assessment for identifying well-being strategy maturity, behavioral barriers, and priority opportunities.',
    'The Propel Well-being Opportunity Index helps an employer evaluate the maturity of the employer''s well-being strategy, identify behavioral barriers that may limit employee action, and prioritize practical opportunities for the next client conversation.\n\nThis is a strategy maturity and opportunity assessment. It is not a clinical, diagnostic, or validated health-risk instrument.\n\nRespondents should answer based on the organization''s current, typical experience rather than its desired future state. Responses should reflect what is consistently in place for the majority of employees.',
    'propel', 'draft', 'Organizational Well-being Strategy', 12, true, true
  ) RETURNING id INTO v_template_id;

-- Version (draft)
  INSERT INTO public.assessment_versions (id, name, version_number, status, assessment_template_id, version_label, introduction_text, completion_message, scoring_method, show_overall_score, respondent_results_enabled, respondent_score_enabled, respondent_section_scores_enabled, respondent_recommendations_enabled)
  VALUES (
    '20e8137a-7254-4376-930d-84951efbb68f', 'Propel Well-being Opportunity Index v1', 1, 'draft', v_template_id, 'v1.0',
    'This assessment helps evaluate the maturity of your organization''s well-being strategy across six dimensions. Your responses will help identify strengths, gaps, and priority opportunities. Answer based on what is consistently in place for the majority of employees today.',
    'Thank you for completing the Propel Well-being Opportunity Index. Your responses have been submitted and will be reviewed with your broker.',
    'weighted_sections', true, false, false, false, false
  ) RETURNING id INTO v_version_id;

  -- Sections
  INSERT INTO public.assessment_sections (assessment_version_id, title, description, display_order, weight, is_scored) VALUES (v_version_id, 'Strategy and Leadership', 'Evaluates whether the organization has clear objectives, strategic alignment, visible leadership support, and defined ownership for its well-being strategy.', 1, 1, true) RETURNING id INTO s1;
  INSERT INTO public.assessment_sections (assessment_version_id, title, description, display_order, weight, is_scored) VALUES (v_version_id, 'Employee Relevance', 'Evaluates how well the strategy reflects employee input, population differences, individual choice, and the full range of employee well-being needs.', 2, 1, true) RETURNING id INTO s2;
  INSERT INTO public.assessment_sections (assessment_version_id, title, description, display_order, weight, is_scored) VALUES (v_version_id, 'Engagement and Communication', 'Evaluates communication consistency, employee value framing, population targeting, sustained engagement, and incentive clarity.', 3, 1, true) RETURNING id INTO s3;
  INSERT INTO public.assessment_sections (assessment_version_id, title, description, display_order, weight, is_scored) VALUES (v_version_id, 'Experience and Access', 'Evaluates whether employees have a clear starting point, centralized resources, convenient mobile access, and equitable access across work environments.', 4, 1, true) RETURNING id INTO s4;
  INSERT INTO public.assessment_sections (assessment_version_id, title, description, display_order, weight, is_scored) VALUES (v_version_id, 'Culture and Social Support', 'Evaluates manager reinforcement, visible peer participation, employee trust, and whether the work environment supports healthy participation.', 5, 1, true) RETURNING id INTO s5;
  INSERT INTO public.assessment_sections (assessment_version_id, title, description, display_order, weight, is_scored) VALUES (v_version_id, 'Measurement and Improvement', 'Evaluates performance measures, engagement-funnel visibility, population-level analysis, and the organization''s use of results for continuous improvement.', 6, 1, true) RETURNING id INTO s6;
  INSERT INTO public.assessment_sections (assessment_version_id, title, description, display_order, weight, is_scored) VALUES (v_version_id, 'Organizational Priorities', 'Collects contextual information used to understand organizational priorities and concerns. These responses do not contribute to the numeric score.', 7, 0, false) RETURNING id INTO s7;

  -- Section 1 Questions (1-4)
  INSERT INTO public.assessment_questions (id, assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored) VALUES ('b607275f-9953-40f0-8655-87193a32a214', v_version_id, s1, 'How clearly has the organization defined what it wants its well-being strategy to accomplish?', 'Select the response that best reflects the organization''s current and consistently applied approach.', 'custom_scored', 1, true, true, 1, false) RETURNING id INTO q1;
  INSERT INTO public.assessment_questions (id, assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored) VALUES ('bb85bf50-71d5-4bfb-b766-b45ec4761488', v_version_id, s1, 'How closely are well-being priorities connected to broader organizational goals?', 'Consider workforce, people, culture, and business objectives.', 'custom_scored', 2, true, true, 1, false) RETURNING id INTO q2;
  INSERT INTO public.assessment_questions (id, assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored) VALUES ('e83b9416-b640-4add-bcb8-5a05de3bb061', v_version_id, s1, 'How visibly do senior leaders support the well-being strategy?', 'Consider communication, participation, role modeling, and accountability.', 'custom_scored', 3, true, true, 1, false) RETURNING id INTO q3;
  INSERT INTO public.assessment_questions (id, assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored) VALUES ('936de9ad-c07f-4614-9598-48ac6a5ccf3a', v_version_id, s1, 'How clearly is ownership of the well-being strategy defined?', 'Consider responsibility, authority, resources, coordination, and accountability.', 'custom_scored', 4, true, true, 1, false) RETURNING id INTO q4;

  -- Section 2 Questions (5-8)
  INSERT INTO public.assessment_questions (id, assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored) VALUES ('5781b10e-9875-48e6-9979-83bbde41a75d', v_version_id, s2, 'How recently has the organization gathered employee input about well-being needs and barriers?', 'Consider surveys, focus groups, interviews, listening sessions, and other direct employee feedback.', 'custom_scored', 1, true, true, 1, false) RETURNING id INTO q5;
  INSERT INTO public.assessment_questions (id, assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored) VALUES ('9f13e00f-01bd-4239-86c5-5785d73ba11b', v_version_id, s2, 'How well does programming reflect differences across employee groups?', 'Consider differences in need, role, location, work environment, schedule, and employee population.', 'custom_scored', 2, true, true, 1, false) RETURNING id INTO q6;
  INSERT INTO public.assessment_questions (id, assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored) VALUES ('8f2cf9b5-eeba-45b8-b688-5f6f35ea80ec', v_version_id, s2, 'How much choice do employees have in how they participate?', 'Consider choice of topics, activities, goals, participation formats, and personalized pathways.', 'custom_scored', 3, true, true, 1, false) RETURNING id INTO q7;
  INSERT INTO public.assessment_questions (id, assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored) VALUES ('8bf13e35-6905-43b2-b1b2-c61f77c6f762', v_version_id, s2, 'How comprehensively does the strategy address employee well-being?', 'Consider physical, mental, financial, social, and other relevant dimensions of well-being.', 'custom_scored', 4, true, true, 1, false) RETURNING id INTO q8;

  -- Section 3 Questions (9-13)
  INSERT INTO public.assessment_questions (id, assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored) VALUES ('0ecfe3fa-291c-47e2-97a8-4b4c6fc2e2b8', v_version_id, s3, 'How consistently does the organization communicate about well-being throughout the year?', 'Consider communication frequency, continuity, targeting, timing, and measurement.', 'custom_scored', 1, true, true, 1, false) RETURNING id INTO q9;
  INSERT INTO public.assessment_questions (id, assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored) VALUES ('12e51354-98f0-4b17-aee6-fc0a9ad4750f', v_version_id, s3, 'How clearly do communications explain why a program or action matters to the employee?', 'Consider whether communications explain personal relevance and immediate employee value rather than only tasks or requirements.', 'custom_scored', 2, true, true, 1, false) RETURNING id INTO q10;
  INSERT INTO public.assessment_questions (id, assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored) VALUES ('4374ffe3-ec44-4d98-8847-138b7f010604', v_version_id, s3, 'How effectively are communications tailored to different employee populations?', 'Consider tailoring by role, need, location, schedule, work environment, behavior, or other meaningful characteristics.', 'custom_scored', 3, true, true, 1, false) RETURNING id INTO q11;
  INSERT INTO public.assessment_questions (id, assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored) VALUES ('0bd5c704-e946-43e4-9149-ee529a1a9ae2', v_version_id, s3, 'How well does the organization maintain engagement after initial launch or enrollment?', 'Consider year-round activity, recurring opportunities, variety, progress visibility, and sustained participation.', 'custom_scored', 4, true, true, 1, false) RETURNING id INTO q12;
  INSERT INTO public.assessment_questions (id, assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored) VALUES ('e8829cdb-c2fd-4733-aa82-1b81790ae4a0', v_version_id, s3, 'How clearly do employees understand the well-being incentive program, including required actions, progress, deadlines, and rewards?', 'Consider whether employees can understand requirements, their current status, deadlines, available rewards, and the next action they should take.', 'custom_scored', 5, true, true, 1, false) RETURNING id INTO q13;

  -- Section 4 Questions (14-17)
  INSERT INTO public.assessment_questions (id, assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored) VALUES ('f9173f4d-5daa-42bd-9382-19b5fae89be6', v_version_id, s4, 'How easy is it for an employee to know where to begin?', 'Consider whether employees receive a clear, visible, and relevant starting point.', 'custom_scored', 1, true, true, 1, false) RETURNING id INTO q14;
  INSERT INTO public.assessment_questions (id, assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored) VALUES ('ba390172-3a12-4116-8ea6-78f276f2b477', v_version_id, s4, 'How centralized are the organization''s well-being benefits and resources?', 'Consider the number of systems, access points, links, logins, and disconnected vendor experiences employees must navigate.', 'custom_scored', 2, true, true, 1, false) RETURNING id INTO q15;
  INSERT INTO public.assessment_questions (id, assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored) VALUES ('b3806f95-a60a-4399-9cfe-082c39a69bd6', v_version_id, s4, 'How easy is it for employees to participate from mobile devices?', 'Consider accessibility, convenience, usability, and the ability to complete core activities from a mobile device.', 'custom_scored', 3, true, true, 1, false) RETURNING id INTO q16;
  INSERT INTO public.assessment_questions (id, assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored) VALUES ('9fefa313-7557-4b23-b35b-da70306d40f3', v_version_id, s4, 'How accessible is the program to frontline, remote, shift, field, and deskless employees?', 'Consider access, communication, scheduling, technology, and work-environment barriers.', 'custom_scored', 4, true, true, 1, false) RETURNING id INTO q17;

  -- Section 5 Questions (18-21)
  INSERT INTO public.assessment_questions (id, assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored) VALUES ('a8795f54-b19f-4c22-b0a5-486784556701', v_version_id, s5, 'How well do managers reinforce employee well-being?', 'Consider manager communication, encouragement, role modeling, guidance, and accountability.', 'custom_scored', 1, true, true, 1, false) RETURNING id INTO q18;
  INSERT INTO public.assessment_questions (id, assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored) VALUES ('0951228e-f5d0-4c6a-9976-20e551f5c6cc', v_version_id, s5, 'How often do employees see relatable peers participating or succeeding?', 'Consider peer visibility, success stories, recognition, social participation, privacy, and inclusion.', 'custom_scored', 2, true, true, 1, false) RETURNING id INTO q19;
  INSERT INTO public.assessment_questions (id, assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored) VALUES ('7963cb35-8ba8-4bee-8e42-437b9488d15e', v_version_id, s5, 'How clearly does the organization explain privacy and data protections?', 'Consider confidentiality, data collection, data use, access, and how these protections are communicated.', 'custom_scored', 3, true, true, 1, false) RETURNING id INTO q20;
  INSERT INTO public.assessment_questions (id, assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored) VALUES ('8fed70e9-ffa7-4248-8ba7-65e5f172db49', v_version_id, s5, 'How well does the work environment support healthy participation?', 'Consider policies, workload, scheduling, leadership, team norms, and opportunities to participate during normal work demands.', 'custom_scored', 4, true, true, 1, false) RETURNING id INTO q21;

  -- Section 6 Questions (22-25)
  INSERT INTO public.assessment_questions (id, assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored) VALUES ('8b28d4b5-2fb7-40e2-8172-3e4b0a522c53', v_version_id, s6, 'How clearly has the organization defined its well-being performance measures?', 'Consider whether performance measures connect participation, engagement, behavior, health, and organizational outcomes with strategic objectives.', 'custom_scored', 1, true, true, 1, false) RETURNING id INTO q22;
  INSERT INTO public.assessment_questions (id, assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored) VALUES ('71b4c0f2-fd46-42c0-b326-157ceb4f3374', v_version_id, s6, 'How well can the organization distinguish awareness, registration, participation, and sustained engagement?', 'Consider whether the organization can identify where employees enter, progress through, and disengage from the participation funnel.', 'custom_scored', 2, true, true, 1, false) RETURNING id INTO q23;
  INSERT INTO public.assessment_questions (id, assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored) VALUES ('1a45502b-2857-41eb-b34a-6bc703eb2051', v_version_id, s6, 'How effectively does the organization identify differences in engagement across employee groups?', 'Consider comparisons by department, location, role, population, work environment, or other meaningful employee segment.', 'custom_scored', 3, true, true, 1, false) RETURNING id INTO q24;
  INSERT INTO public.assessment_questions (id, assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored) VALUES ('31a16f0a-f2ef-4621-97a5-d9301c9bbe3a', v_version_id, s6, 'How frequently does the organization use results to improve the strategy?', 'Consider whether results lead to testing, scheduled reviews, program changes, targeted adjustments, and continuous optimization.', 'custom_scored', 4, true, true, 1, false) RETURNING id INTO q25;

  -- Section 7 Contextual Questions (26-28)
  INSERT INTO public.assessment_questions (assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored, maximum_selections) VALUES (v_version_id, s7, 'Which outcomes are most important to the organization?', 'Select up to three.', 'multi_select', 1, true, false, 0, false, 3) RETURNING id INTO q26;
  INSERT INTO public.assessment_questions (assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored, maximum_selections) VALUES (v_version_id, s7, 'Which challenges concern the organization most?', 'Select up to three.', 'multi_select', 2, true, false, 0, false, 3) RETURNING id INTO q27;
  INSERT INTO public.assessment_questions (assessment_version_id, assessment_section_id, question_text, help_text, question_type, display_order, is_required, is_scored, weight, reverse_scored) VALUES (v_version_id, s7, 'What else should be understood about the organization''s current strategy or employee population?', 'Provide any additional context that may help the broker understand the organization''s priorities, workforce, barriers, or current approach.', 'long_text', 3, false, false, 0, false) RETURNING id INTO q28;

  -- Options for all 25 scored questions (5 options each, scores 1-5)
  -- Q1
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, score_value, display_order, is_not_applicable) VALUES
    (q1, 'No clear objectives have been established.', '1', 1, 1, false),
    (q1, 'General goals exist but are not documented.', '2', 2, 2, false),
    (q1, 'Some objectives have been defined, but they are not consistently used.', '3', 3, 3, false),
    (q1, 'Clear objectives guide most program decisions.', '4', 4, 4, false),
    (q1, 'Specific, measurable objectives are integrated with workforce strategy.', '5', 5, 5, false);
  -- Q2
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, score_value, display_order, is_not_applicable) VALUES
    (q2, 'They are not connected.', '1', 1, 1, false),
    (q2, 'Connections are occasionally discussed but not formalized.', '2', 2, 2, false),
    (q2, 'Some priorities align with organizational goals.', '3', 3, 3, false),
    (q2, 'Most well-being priorities support defined workforce or business goals.', '4', 4, 4, false),
    (q2, 'Well-being is embedded in the organization''s people and business strategy.', '5', 5, 5, false);
  -- Q3
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, score_value, display_order, is_not_applicable) VALUES
    (q3, 'Leadership support is not visible.', '1', 1, 1, false),
    (q3, 'Leaders occasionally mention the program.', '2', 2, 2, false),
    (q3, 'Some leaders participate or communicate support.', '3', 3, 3, false),
    (q3, 'Leaders regularly reinforce and model the strategy.', '4', 4, 4, false),
    (q3, 'Leadership visibly champions, participates in, and holds the organization accountable for well-being.', '5', 5, 5, false);
  -- Q4
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, score_value, display_order, is_not_applicable) VALUES
    (q4, 'No one clearly owns it.', '1', 1, 1, false),
    (q4, 'Responsibility shifts between people or departments.', '2', 2, 2, false),
    (q4, 'A primary owner exists but has limited resources or authority.', '3', 3, 3, false),
    (q4, 'Ownership, responsibilities, and resources are well defined.', '4', 4, 4, false),
    (q4, 'A coordinated team owns strategy, execution, measurement, and improvement.', '5', 5, 5, false);
  -- Q5
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, score_value, display_order, is_not_applicable) VALUES
    (q5, 'It has not gathered meaningful input.', '1', 1, 1, false),
    (q5, 'Informal feedback is occasionally collected.', '2', 2, 2, false),
    (q5, 'Input has been gathered within the past three years.', '3', 3, 3, false),
    (q5, 'Input has been gathered within the past two years and influenced decisions.', '4', 4, 4, false),
    (q5, 'Employee input is gathered regularly and directly shapes programming.', '5', 5, 5, false);
  -- Q6
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, score_value, display_order, is_not_applicable) VALUES
    (q6, 'The same programming is offered to everyone without adjustment.', '1', 1, 1, false),
    (q6, 'Minor differences are acknowledged but rarely addressed.', '2', 2, 2, false),
    (q6, 'Some programs are adapted for particular populations.', '3', 3, 3, false),
    (q6, 'Programming is regularly tailored by need, role, location, or work environment.', '4', 4, 4, false),
    (q6, 'Data and employee input drive highly relevant population-specific experiences.', '5', 5, 5, false);
  -- Q7
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, score_value, display_order, is_not_applicable) VALUES
    (q7, 'Employees have little or no meaningful choice.', '1', 1, 1, false),
    (q7, 'A few options exist, but most participation follows one path.', '2', 2, 2, false),
    (q7, 'Employees can choose among several activities or topics.', '3', 3, 3, false),
    (q7, 'Employees have meaningful choices based on interests and goals.', '4', 4, 4, false),
    (q7, 'Employees can create a highly personalized experience with clear guidance.', '5', 5, 5, false);
  -- Q8
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, score_value, display_order, is_not_applicable) VALUES
    (q8, 'It focuses almost entirely on one area, such as physical health.', '1', 1, 1, false),
    (q8, 'It touches on a few areas inconsistently.', '2', 2, 2, false),
    (q8, 'It addresses several dimensions of well-being.', '3', 3, 3, false),
    (q8, 'It consistently addresses physical, mental, financial, and social needs.', '4', 4, 4, false),
    (q8, 'It integrates multiple dimensions around employee needs and organizational priorities.', '5', 5, 5, false);
  -- Q9
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, score_value, display_order, is_not_applicable) VALUES
    (q9, 'Communication is rare or limited to enrollment.', '1', 1, 1, false),
    (q9, 'Communication occurs a few times per year.', '2', 2, 2, false),
    (q9, 'Communication is regular but largely general.', '3', 3, 3, false),
    (q9, 'Communication is consistent and sometimes targeted.', '4', 4, 4, false),
    (q9, 'Communication is continuous, segmented, timely, and measured.', '5', 5, 5, false);
  -- Q10
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, score_value, display_order, is_not_applicable) VALUES
    (q10, 'Messages primarily list tasks, requirements, or links.', '1', 1, 1, false),
    (q10, 'Personal value is occasionally mentioned.', '2', 2, 2, false),
    (q10, 'Messages explain some employee benefits.', '3', 3, 3, false),
    (q10, 'Most messages clearly connect actions with meaningful benefits.', '4', 4, 4, false),
    (q10, 'Communications consistently make the immediate personal value clear and relevant.', '5', 5, 5, false);
  -- Q11
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, score_value, display_order, is_not_applicable) VALUES
    (q11, 'Everyone receives the same communication.', '1', 1, 1, false),
    (q11, 'Only basic differences, such as location, are considered.', '2', 2, 2, false),
    (q11, 'Some campaigns are segmented.', '3', 3, 3, false),
    (q11, 'Communications are regularly tailored by role, need, location, or behavior.', '4', 4, 4, false),
    (q11, 'Communication is highly targeted and adjusted using response data.', '5', 5, 5, false);
  -- Q12
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, score_value, display_order, is_not_applicable) VALUES
    (q12, 'Participation typically ends after initial activity.', '1', 1, 1, false),
    (q12, 'Engagement declines significantly after launch.', '2', 2, 2, false),
    (q12, 'Periodic activities create temporary increases.', '3', 3, 3, false),
    (q12, 'A year-round cadence sustains meaningful participation.', '4', 4, 4, false),
    (q12, 'Employees experience continuous, varied opportunities with visible progress.', '5', 5, 5, false);
  -- Q13
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, score_value, display_order, is_not_applicable) VALUES
    (q13, 'The incentive is unavailable or employees are unlikely to understand it.', '1', 1, 1, false),
    (q13, 'Basic information exists, but confusion is common.', '2', 2, 2, false),
    (q13, 'Most requirements are documented, although progress or next steps may be unclear.', '3', 3, 3, false),
    (q13, 'Employees receive clear instructions and can usually understand their status.', '4', 4, 4, false),
    (q13, 'Employees can easily see requirements, progress, deadlines, rewards, and their next action.', '5', 5, 5, false);
  -- Q14
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, score_value, display_order, is_not_applicable) VALUES
    (q14, 'There is no clear starting point.', '1', 1, 1, false),
    (q14, 'Employees must search through several resources.', '2', 2, 2, false),
    (q14, 'Basic instructions exist but are not always easy to find.', '3', 3, 3, false),
    (q14, 'A clear starting experience is available.', '4', 4, 4, false),
    (q14, 'Each employee receives a simple, guided, relevant next step.', '5', 5, 5, false);
  -- Q15
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, score_value, display_order, is_not_applicable) VALUES
    (q15, 'Resources are spread across many disconnected systems.', '1', 1, 1, false),
    (q15, 'Employees receive lists or links but no central experience.', '2', 2, 2, false),
    (q15, 'Some resources are centralized while others remain fragmented.', '3', 3, 3, false),
    (q15, 'Most resources can be accessed through a central location.', '4', 4, 4, false),
    (q15, 'Employees have one integrated, intuitive access point.', '5', 5, 5, false);
  -- Q16
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, score_value, display_order, is_not_applicable) VALUES
    (q16, 'Mobile participation is difficult or unavailable.', '1', 1, 1, false),
    (q16, 'Only limited activities work well on mobile.', '2', 2, 2, false),
    (q16, 'Core activities are accessible, but the experience is inconsistent.', '3', 3, 3, false),
    (q16, 'Most participation is convenient on mobile.', '4', 4, 4, false),
    (q16, 'The experience is designed for quick, intuitive mobile use.', '5', 5, 5, false);
  -- Q17
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, score_value, display_order, is_not_applicable) VALUES
    (q17, 'The program mainly serves desk-based employees.', '1', 1, 1, false),
    (q17, 'Some accommodations exist but major barriers remain.', '2', 2, 2, false),
    (q17, 'Most populations have access, although participation opportunities vary.', '3', 3, 3, false),
    (q17, 'Access and communication are designed for different work environments.', '4', 4, 4, false),
    (q17, 'The organization routinely identifies and removes population-specific barriers.', '5', 5, 5, false);
  -- Q18
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, score_value, display_order, is_not_applicable) VALUES
    (q18, 'Managers rarely discuss or support it.', '1', 1, 1, false),
    (q18, 'Support varies widely by manager.', '2', 2, 2, false),
    (q18, 'Managers receive basic information or occasional guidance.', '3', 3, 3, false),
    (q18, 'Most managers actively reinforce participation and available resources.', '4', 4, 4, false),
    (q18, 'Managers are equipped and accountable for creating supportive team environments.', '5', 5, 5, false);
  -- Q19
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, score_value, display_order, is_not_applicable) VALUES
    (q19, 'Participation is largely invisible.', '1', 1, 1, false),
    (q19, 'Occasional success stories are shared.', '2', 2, 2, false),
    (q19, 'Employees sometimes see peer participation.', '3', 3, 3, false),
    (q19, 'Peer examples and recognition are regularly visible.', '4', 4, 4, false),
    (q19, 'Social participation is embedded while respecting privacy and inclusion.', '5', 5, 5, false);
  -- Q20
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, score_value, display_order, is_not_applicable) VALUES
    (q20, 'Privacy is not meaningfully addressed.', '1', 1, 1, false),
    (q20, 'Information exists but is difficult to find or understand.', '2', 2, 2, false),
    (q20, 'Basic privacy information is available.', '3', 3, 3, false),
    (q20, 'Privacy protections are explained clearly and proactively.', '4', 4, 4, false),
    (q20, 'Trust, confidentiality, and data use are consistently reinforced throughout the experience.', '5', 5, 5, false);
  -- Q21
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, score_value, display_order, is_not_applicable) VALUES
    (q21, 'Work conditions frequently conflict with participation.', '1', 1, 1, false),
    (q21, 'Employees can participate only outside normal work demands.', '2', 2, 2, false),
    (q21, 'Some teams or locations provide meaningful support.', '3', 3, 3, false),
    (q21, 'Most employees have reasonable opportunities and encouragement to participate.', '4', 4, 4, false),
    (q21, 'Policies, leadership, workload, and environment actively reinforce healthy behavior.', '5', 5, 5, false);
  -- Q22
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, score_value, display_order, is_not_applicable) VALUES
    (q22, 'No meaningful measures are defined.', '1', 1, 1, false),
    (q22, 'Participation totals are reviewed occasionally.', '2', 2, 2, false),
    (q22, 'Several basic metrics are tracked.', '3', 3, 3, false),
    (q22, 'KPIs are connected to major program objectives.', '4', 4, 4, false),
    (q22, 'A structured measurement framework connects engagement, behavior, health, and organizational outcomes.', '5', 5, 5, false);
  -- Q23
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, score_value, display_order, is_not_applicable) VALUES
    (q23, 'It cannot reliably distinguish them.', '1', 1, 1, false),
    (q23, 'It mainly tracks registration or completion.', '2', 2, 2, false),
    (q23, 'It tracks several stages but does not routinely analyze them.', '3', 3, 3, false),
    (q23, 'It measures participation across multiple stages.', '4', 4, 4, false),
    (q23, 'It uses funnel and sustained-engagement measures to identify where employees disengage.', '5', 5, 5, false);
  -- Q24
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, score_value, display_order, is_not_applicable) VALUES
    (q24, 'Only organization-wide totals are reviewed.', '1', 1, 1, false),
    (q24, 'Limited group comparisons are occasionally available.', '2', 2, 2, false),
    (q24, 'Some data can be viewed by department, location, or population.', '3', 3, 3, false),
    (q24, 'Segment-level differences are regularly analyzed.', '4', 4, 4, false),
    (q24, 'Segment analysis directly informs targeted engagement strategies.', '5', 5, 5, false);
  -- Q25
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, score_value, display_order, is_not_applicable) VALUES
    (q25, 'The strategy rarely changes based on results.', '1', 1, 1, false),
    (q25, 'Adjustments are mostly reactive.', '2', 2, 2, false),
    (q25, 'Results inform occasional changes.', '3', 3, 3, false),
    (q25, 'The strategy is reviewed and improved on a regular schedule.', '4', 4, 4, false),
    (q25, 'Continuous testing, feedback, and performance data drive ongoing optimization.', '5', 5, 5, false);

  -- Q26 options (outcomes, 12 options, no scores)
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, score_value, display_order, is_not_applicable) VALUES
    (q26, 'Improve benefits awareness', 'improve-benefits-awareness', NULL, 1, false),
    (q26, 'Increase preventive care', 'increase-preventive-care', NULL, 2, false),
    (q26, 'Increase physical activity', 'increase-physical-activity', NULL, 3, false),
    (q26, 'Support mental well-being', 'support-mental-wellbeing', NULL, 4, false),
    (q26, 'Support financial well-being', 'support-financial-wellbeing', NULL, 5, false),
    (q26, 'Improve employee connection', 'improve-employee-connection', NULL, 6, false),
    (q26, 'Support chronic-condition management', 'support-chronic-condition-management', NULL, 7, false),
    (q26, 'Strengthen recruitment and retention', 'strengthen-recruitment-retention', NULL, 8, false),
    (q26, 'Improve organizational culture', 'improve-organizational-culture', NULL, 9, false),
    (q26, 'Increase overall engagement', 'increase-overall-engagement', NULL, 10, false),
    (q26, 'Reduce administrative burden', 'reduce-administrative-burden', NULL, 11, false),
    (q26, 'Improve measurement', 'improve-measurement', NULL, 12, false);

  -- Q27 options (challenges, 12 options, no scores)
  INSERT INTO public.assessment_question_options (question_id, option_label, option_value, score_value, display_order, is_not_applicable) VALUES
    (q27, 'Employees do not understand the program', 'employees-do-not-understand', NULL, 1, false),
    (q27, 'Employees do not know where to begin', 'employees-do-not-know-where-to-begin', NULL, 2, false),
    (q27, 'Participation declines after launch', 'participation-declines-after-launch', NULL, 3, false),
    (q27, 'Incentives are confusing', 'incentives-are-confusing', NULL, 4, false),
    (q27, 'Programming feels generic', 'programming-feels-generic', NULL, 5, false),
    (q27, 'Employees have privacy concerns', 'employee-privacy-concerns', NULL, 6, false),
    (q27, 'Leadership is not visibly involved', 'leadership-not-visibly-involved', NULL, 7, false),
    (q27, 'Resources are fragmented', 'resources-are-fragmented', NULL, 8, false),
    (q27, 'Mobile or frontline access is difficult', 'mobile-frontline-access-difficult', NULL, 9, false),
    (q27, 'Communication is not reaching employees', 'communication-not-reaching-employees', NULL, 10, false),
    (q27, 'Administration takes too much time', 'administration-takes-too-much-time', NULL, 11, false),
    (q27, 'Results are difficult to measure', 'results-difficult-to-measure', NULL, 12, false);

  -- Score bands
  INSERT INTO public.assessment_score_bands (assessment_version_id, band_name, min_threshold, max_threshold, display_order) VALUES
    (v_version_id, 'Reactive', 0, 39.9999, 1),
    (v_version_id, 'Developing', 40, 59.9999, 2),
    (v_version_id, 'Established', 60, 74.9999, 3),
    (v_version_id, 'Strategic', 75, 89.9999, 4),
    (v_version_id, 'Leading', 90, 100, 5);
END $$;
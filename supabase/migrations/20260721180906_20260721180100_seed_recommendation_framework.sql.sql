/*
# Seed Propel Recommendation Framework v1

Creates the immutable recommendation framework, seeds all 35 recommendations
plus 12 meeting questions, maps diagnostic tags to all 25 scored questions,
and wires the framework to the published Propel assessment version.

The published-version protection trigger is temporarily disabled to set
recommendation_framework_id, then re-enabled.
*/

-- ============================================================
-- 1. Create the recommendation framework
-- ============================================================
INSERT INTO public.recommendation_frameworks (id, name, version, status)
VALUES ('11111111-0000-0000-0000-000000000001', 'Propel Well-being Opportunity Index', '1.0', 'published')
ON CONFLICT (name, version) DO NOTHING;

-- ============================================================
-- 2. Seed all recommendations + meeting questions + diagnostic tags
-- ============================================================
DO $$
DECLARE
  v_framework_id uuid := '11111111-0000-0000-0000-000000000001';
  v_version_id uuid := '20e8137a-7254-4376-930d-84951efbb68f';
  v_rec_id uuid;
BEGIN
  -- CLARITY-001
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'CLARITY-001', 'Create a Guided Starting Experience',
    'Create one highly visible starting experience that quickly explains what the well-being program offers and directs employees to one relevant first action.',
    'quick_win', 'experience_and_access', 'clarity_of_value', 'low', 'high', 1, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'onboarding'), (v_rec_id, 'q13'), (v_rec_id, 'q14'), (v_rec_id, 'concern_employees_do_not_know_where_to_begin');

  -- CLARITY-002
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'CLARITY-002', 'Define the Program''s Employee Value Proposition',
    'Develop a concise employee-facing value proposition that explains what the program helps employees do, why it is useful now, and how participation fits into everyday life.',
    'quick_win', 'strategy_and_leadership', 'clarity_of_value', 'low', 'high', 2, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'value_proposition'), (v_rec_id, 'q1'), (v_rec_id, 'q10'), (v_rec_id, 'concern_employees_do_not_understand_program');

  -- CLARITY-003
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'CLARITY-003', 'Simplify Incentive Communication',
    'Reformat incentive communication around a small number of clear actions, visible progress, important dates, and concrete examples of how an employee earns the reward.',
    'quick_win', 'engagement_and_communication', 'clarity_of_value', 'low', 'high', 3, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'incentive_communication'), (v_rec_id, 'q13'), (v_rec_id, 'q10'), (v_rec_id, 'concern_incentives_are_confusing');

  -- CLARITY-004
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'CLARITY-004', 'Consolidate the Employee Resource Experience',
    'Create a centralized employee well-being experience that organizes available benefits by employee need rather than by vendor name.',
    'high_impact_move', 'experience_and_access', 'clarity_of_value', 'high', 'high', 4, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'resource_consolidation'), (v_rec_id, 'q14'), (v_rec_id, 'concern_resources_are_fragmented'), (v_rec_id, 'q13');

  -- CLARITY-005
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'CLARITY-005', 'Replace Generic Communication With Population-Specific Relevance',
    'Segment at least one major communication or campaign by meaningful employee characteristics such as work location, job environment, department, schedule, or demonstrated interest.',
    'quick_win', 'employee_relevance', 'clarity_of_value', 'low', 'high', 5, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'segmentation'), (v_rec_id, 'q6'), (v_rec_id, 'q11'), (v_rec_id, 'concern_programming_feels_generic');

  -- CLARITY-006
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'CLARITY-006', 'Create a Year-Round Program Roadmap',
    'Create a year-round roadmap connecting organizational priorities, employee needs, communications, campaigns, incentives, benefits, and measurement.',
    'high_impact_move', 'strategy_and_leadership', 'clarity_of_value', 'medium', 'high', 6, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'program_roadmap'), (v_rec_id, 'q1'), (v_rec_id, 'q9'), (v_rec_id, 'q12');

  -- CLARITY-007
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'CLARITY-007', 'Make the Next Action Explicit',
    'End every major well-being message with one specific next action rather than several competing links or general encouragement.',
    'quick_win', 'engagement_and_communication', 'clarity_of_value', 'low', 'high', 7, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'calls_to_action'), (v_rec_id, 'q9'), (v_rec_id, 'q10'), (v_rec_id, 'q13');

  -- CLARITY-008
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'CLARITY-008', 'Equip Leaders and Managers to Explain the Strategy',
    'Provide leaders and managers with a concise explanation of the strategy, the value for employees, and the specific role leaders are expected to play.',
    'quick_win', 'strategy_and_leadership', 'clarity_of_value', 'low', 'high', 8, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'leadership_communication'), (v_rec_id, 'q3'), (v_rec_id, 'q17'), (v_rec_id, 'q1');

  -- MOTIVATION-001
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'MOTIVATION-001', 'Break Large Goals Into Immediate Micro-Actions',
    'Translate broad goals into small actions that can be completed quickly and repeated over time.',
    'quick_win', 'engagement_and_communication', 'motivation_overcoming_inertia', 'low', 'high', 9, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'goal_design'), (v_rec_id, 'q12'), (v_rec_id, 'q7'), (v_rec_id, 'concern_participation_declines_after_launch');

  -- MOTIVATION-002
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'MOTIVATION-002', 'Make Progress Visible Early',
    'Show employees visible progress after the first action and at meaningful milestones.',
    'quick_win', 'engagement_and_communication', 'motivation_overcoming_inertia', 'medium', 'high', 10, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'progress_visibility'), (v_rec_id, 'q12'), (v_rec_id, 'q10');

  -- MOTIVATION-003
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'MOTIVATION-003', 'Replace One Long Program Year With Episodic Campaigns',
    'Organize year-round engagement into shorter, distinct campaigns with specific themes, goals, and milestones.',
    'high_impact_move', 'engagement_and_communication', 'motivation_overcoming_inertia', 'medium', 'high', 11, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'program_cadence'), (v_rec_id, 'q9'), (v_rec_id, 'q12'), (v_rec_id, 'concern_participation_declines_after_launch');

  -- MOTIVATION-004
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'MOTIVATION-004', 'Increase Employee Choice and Ownership',
    'Offer guided choices that allow employees to select topics, activities, or goals that fit their interests and circumstances.',
    'high_impact_move', 'employee_relevance', 'motivation_overcoming_inertia', 'medium', 'high', 12, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'autonomy'), (v_rec_id, 'q7'), (v_rec_id, 'q6'), (v_rec_id, 'concern_programming_feels_generic');

  -- MOTIVATION-005
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'MOTIVATION-005', 'Use Immediate Reinforcement Instead of Distant Rewards',
    'Add immediate recognition, progress feedback, or small milestone rewards before the final incentive is earned.',
    'high_impact_move', 'engagement_and_communication', 'motivation_overcoming_inertia', 'medium', 'high', 13, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'reward_timing'), (v_rec_id, 'q13'), (v_rec_id, 'q12'), (v_rec_id, 'concern_incentives_are_confusing');

  -- MOTIVATION-006
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'MOTIVATION-006', 'Match Challenge Difficulty to Participant Readiness',
    'Offer multiple entry levels or adaptive goals so employees can participate at an appropriate level of difficulty.',
    'high_impact_move', 'employee_relevance', 'motivation_overcoming_inertia', 'medium', 'high', 14, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'challenge_design'), (v_rec_id, 'q6'), (v_rec_id, 'q7'), (v_rec_id, 'q12');

  -- MOTIVATION-007
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'MOTIVATION-007', 'Connect Programming to Immediate Life Moments',
    'Align outreach and recommended actions with meaningful employee events, seasonal needs, and moments of elevated relevance.',
    'high_impact_move', 'employee_relevance', 'motivation_overcoming_inertia', 'medium', 'high', 15, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'contextual_relevance'), (v_rec_id, 'q5'), (v_rec_id, 'q6'), (v_rec_id, 'q10');

  -- MOTIVATION-008
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'MOTIVATION-008', 'Refresh Repetitive Programming',
    'Vary campaign formats, social structures, content types, and participation pathways while preserving strategic consistency.',
    'quick_win', 'engagement_and_communication', 'motivation_overcoming_inertia', 'low', 'medium', 16, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'novelty'), (v_rec_id, 'q9'), (v_rec_id, 'q12'), (v_rec_id, 'concern_programming_feels_generic');

  -- TRUST-001
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'TRUST-001', 'Make Privacy Protections Visible and Understandable',
    'Explain privacy protections in plain language at the moments when employees are asked to share information.',
    'quick_win', 'culture_and_social_support', 'trust_social_proof', 'low', 'high', 17, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'privacy'), (v_rec_id, 'q20'), (v_rec_id, 'concern_privacy_concerns');

  -- TRUST-002
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'TRUST-002', 'Increase Visible Leadership Participation',
    'Ask leaders to demonstrate support through visible participation, personal stories, and consistent reinforcement.',
    'quick_win', 'strategy_and_leadership', 'trust_social_proof', 'low', 'high', 18, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'leadership_modeling'), (v_rec_id, 'q3'), (v_rec_id, 'q17'), (v_rec_id, 'concern_leadership_not_visibly_involved');

  -- TRUST-003
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'TRUST-003', 'Use Relatable Peer Stories',
    'Share authentic stories and examples from employees across roles, locations, and levels of engagement.',
    'quick_win', 'culture_and_social_support', 'trust_social_proof', 'low', 'high', 19, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'social_proof'), (v_rec_id, 'q19'), (v_rec_id, 'concern_participation_is_invisible');

  -- TRUST-004
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'TRUST-004', 'Align Program Language With Workforce Culture',
    'Adapt language, examples, visuals, and participation formats to the organization''s workforce and culture.',
    'high_impact_move', 'employee_relevance', 'trust_social_proof', 'medium', 'high', 20, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'cultural_alignment'), (v_rec_id, 'q6'), (v_rec_id, 'q11'), (v_rec_id, 'q20');

  -- TRUST-005
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'TRUST-005', 'Equip Managers to Reinforce Without Pressuring',
    'Provide managers with guidance on encouraging participation while respecting privacy and voluntariness.',
    'quick_win', 'culture_and_social_support', 'trust_social_proof', 'low', 'high', 21, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'manager_support'), (v_rec_id, 'q17'), (v_rec_id, 'q19');

  -- TRUST-006
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'TRUST-006', 'Acknowledge and Repair Past Program Frustrations',
    'Acknowledge prior frustrations directly and explain what is different in the new approach.',
    'high_impact_move', 'strategy_and_leadership', 'trust_social_proof', 'medium', 'high', 22, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'trust_repair'), (v_rec_id, 'q3'), (v_rec_id, 'q19');

  -- TRUST-007
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'TRUST-007', 'Create Inclusive Social Participation Options',
    'Offer both visible social participation and lower-pressure individual or small-group options.',
    'high_impact_move', 'culture_and_social_support', 'trust_social_proof', 'medium', 'medium', 23, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'inclusive_social_design'), (v_rec_id, 'q18'), (v_rec_id, 'q20');

  -- FRICTION-001
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'FRICTION-001', 'Create One Central Access Point',
    'Create a centralized hub that organizes resources around employee needs and actions.',
    'high_impact_move', 'experience_and_access', 'structural_environmental_friction', 'high', 'high', 24, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'centralization'), (v_rec_id, 'q14'), (v_rec_id, 'concern_resources_are_fragmented');

  -- FRICTION-002
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'FRICTION-002', 'Reduce Login and Authentication Barriers',
    'Reduce login steps through SSO, deep links, and clearer authentication guidance.',
    'high_impact_move', 'experience_and_access', 'structural_environmental_friction', 'high', 'high', 25, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'authentication'), (v_rec_id, 'q13'), (v_rec_id, 'q14');

  -- FRICTION-003
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'FRICTION-003', 'Design for Frontline and Deskless Access',
    'Adapt access, communication, and activities for shift, field, manufacturing, remote, and deskless populations.',
    'high_impact_move', 'experience_and_access', 'structural_environmental_friction', 'medium', 'high', 26, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'frontline_access'), (v_rec_id, 'q16'), (v_rec_id, 'concern_mobile_frontline_access_difficult');

  -- FRICTION-004
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'FRICTION-004', 'Improve the Mobile Participation Journey',
    'Optimize the most common employee actions for fast, intuitive mobile completion.',
    'high_impact_move', 'experience_and_access', 'structural_environmental_friction', 'medium', 'high', 27, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'mobile_experience'), (v_rec_id, 'q15'), (v_rec_id, 'concern_mobile_frontline_access_difficult');

  -- FRICTION-005
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'FRICTION-005', 'Reduce Communication Noise',
    'Coordinate communication frequency, channel, timing, and audience to reduce noise and increase salience.',
    'quick_win', 'engagement_and_communication', 'structural_environmental_friction', 'low', 'high', 28, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'communication_load'), (v_rec_id, 'q9'), (v_rec_id, 'q11');

  -- FRICTION-006
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'FRICTION-006', 'Remove Administrative Burden From Program Operations',
    'Automate repetitive administrative work and clarify ownership for remaining tasks.',
    'high_impact_move', 'measurement_and_improvement', 'structural_environmental_friction', 'medium', 'high', 29, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'administration'), (v_rec_id, 'q4'), (v_rec_id, 'q24'), (v_rec_id, 'concern_administration_takes_too_much_time');

  -- FRICTION-007
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'FRICTION-007', 'Stabilize Eligibility and Data Feeds',
    'Establish clear feed ownership, validation, exception handling, and monitoring.',
    'high_impact_move', 'measurement_and_improvement', 'structural_environmental_friction', 'high', 'high', 30, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'data_reliability'), (v_rec_id, 'q22'), (v_rec_id, 'q23'), (v_rec_id, 'q24');

  -- FRICTION-008
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'FRICTION-008', 'Simplify Navigation and Choice Architecture',
    'Organize navigation around common employee needs and feature a small number of recommended next actions.',
    'quick_win', 'experience_and_access', 'structural_environmental_friction', 'low', 'high', 31, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'navigation'), (v_rec_id, 'q13'), (v_rec_id, 'q14');

  -- STRATEGY-001
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'STRATEGY-001', 'Define Measurable Well-being Objectives',
    'Define a small set of measurable objectives connected to employee and organizational priorities.',
    'high_impact_move', 'strategy_and_leadership', 'clarity_of_value', 'medium', 'high', 32, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'strategy_definition'), (v_rec_id, 'q1'), (v_rec_id, 'q22');

  -- STRATEGY-002
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'STRATEGY-002', 'Connect Well-being to Workforce Priorities',
    'Explicitly connect well-being initiatives to workforce goals such as prevention, retention, culture, safety, or benefits utilization.',
    'high_impact_move', 'strategy_and_leadership', 'clarity_of_value', 'medium', 'high', 33, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'business_alignment'), (v_rec_id, 'q2'), (v_rec_id, 'q1');

  -- STRATEGY-003
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'STRATEGY-003', 'Clarify Governance and Decision Rights',
    'Define strategy ownership, operational responsibilities, decision rights, and review cadence.',
    'high_impact_move', 'strategy_and_leadership', 'structural_environmental_friction', 'medium', 'high', 34, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'governance'), (v_rec_id, 'q4'), (v_rec_id, 'q24');

  -- STRATEGY-004
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'STRATEGY-004', 'Establish a Leadership Reinforcement Cadence',
    'Create a recurring cadence for leaders to reinforce priorities, recognize progress, and connect well-being to organizational goals.',
    'quick_win', 'strategy_and_leadership', 'trust_social_proof', 'low', 'high', 35, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'leadership_cadence'), (v_rec_id, 'q3'), (v_rec_id, 'q17');

  -- STRATEGY-005
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'STRATEGY-005', 'Build the Strategy Around Priority Populations',
    'Identify priority populations and define differentiated objectives, barriers, and engagement approaches for each.',
    'high_impact_move', 'employee_relevance', 'clarity_of_value', 'medium', 'high', 36, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'population_strategy'), (v_rec_id, 'q5'), (v_rec_id, 'q6'), (v_rec_id, 'q23');

  -- STRATEGY-006
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'STRATEGY-006', 'Create a Formal Annual Strategy Review',
    'Conduct an annual review of objectives, engagement, outcomes, employee input, vendor performance, and next-year priorities.',
    'high_impact_move', 'strategy_and_leadership', 'clarity_of_value', 'medium', 'high', 37, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'review_cadence'), (v_rec_id, 'q24'), (v_rec_id, 'q22');

  -- MEASURE-001
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'MEASURE-001', 'Define a Balanced Well-being KPI Framework',
    'Track a balanced set of awareness, activation, sustained engagement, behavior, health, and organizational measures.',
    'high_impact_move', 'measurement_and_improvement', 'clarity_of_value', 'medium', 'high', 38, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'kpi_design'), (v_rec_id, 'q22');

  -- MEASURE-002
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'MEASURE-002', 'Separate Awareness, Registration, Activation, and Retention',
    'Measure distinct stages of the engagement journey and identify the largest conversion gaps.',
    'quick_win', 'measurement_and_improvement', 'clarity_of_value', 'low', 'high', 39, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'engagement_funnel'), (v_rec_id, 'q23');

  -- MEASURE-003
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'MEASURE-003', 'Analyze Engagement by Employee Segment',
    'Analyze engagement by meaningful dimensions such as location, department, role, or work environment.',
    'quick_win', 'measurement_and_improvement', 'clarity_of_value', 'low', 'high', 40, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'segmentation_analytics'), (v_rec_id, 'q23'), (v_rec_id, 'q6'), (v_rec_id, 'q11');

  -- MEASURE-004
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'MEASURE-004', 'Measure Sustained Engagement, Not Only Completion',
    'Add recurring engagement measures such as active weeks, return rates, WAU/MAU, or repeated behavior completion.',
    'high_impact_move', 'measurement_and_improvement', 'motivation_overcoming_inertia', 'medium', 'high', 41, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'retention_metrics'), (v_rec_id, 'q12'), (v_rec_id, 'q23');

  -- MEASURE-005
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'MEASURE-005', 'Connect Program Activity to Priority Outcomes',
    'Define the expected pathway from program activity to priority outcomes and select measures at each step.',
    'high_impact_move', 'measurement_and_improvement', 'clarity_of_value', 'high', 'high', 42, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'outcome_linkage'), (v_rec_id, 'q1'), (v_rec_id, 'q2'), (v_rec_id, 'q22');

  -- MEASURE-006
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'MEASURE-006', 'Use Employee Feedback as a Continuous Data Source',
    'Collect brief recurring feedback and visibly communicate how it shapes program decisions.',
    'quick_win', 'measurement_and_improvement', 'trust_social_proof', 'low', 'high', 43, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'employee_feedback'), (v_rec_id, 'q5'), (v_rec_id, 'q24');

  -- MEASURE-007
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'MEASURE-007', 'Create a Test-and-Learn Improvement Cycle',
    'Run small tests of messages, timing, incentives, or audience segmentation and compare results before scaling.',
    'quick_win', 'measurement_and_improvement', 'motivation_overcoming_inertia', 'low', 'high', 44, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'optimization'), (v_rec_id, 'q24');

  -- MEASURE-008
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, effort_level, impact_level, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'MEASURE-008', 'Build a Broker- and Leadership-Ready Scorecard',
    'Create a concise scorecard showing objectives, current performance, trends, population gaps, and recommended actions.',
    'quick_win', 'measurement_and_improvement', 'clarity_of_value', 'medium', 'high', 45, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'reporting'), (v_rec_id, 'q22'), (v_rec_id, 'q23'), (v_rec_id, 'q24'), (v_rec_id, 'concern_results_difficult_to_measure');

  -- Meeting questions
  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'MQ-CLARITY-001', 'Could an employee who has never used the program determine their next step within 60 seconds?',
    'Could an employee who has never used the program determine their next step within 60 seconds?',
    'meeting_question', 'experience_and_access', 'clarity_of_value', 100, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'onboarding'), (v_rec_id, 'q13'), (v_rec_id, 'q14');

  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'MQ-CLARITY-002', 'When employees hear the program''s name, what immediate personal benefit should they associate with it?',
    'When employees hear the program''s name, what immediate personal benefit should they associate with it?',
    'meeting_question', 'strategy_and_leadership', 'clarity_of_value', 101, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'value_proposition'), (v_rec_id, 'q1'), (v_rec_id, 'q10');

  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'MQ-CLARITY-003', 'Where do employees most often become confused about qualifying for the incentive?',
    'Where do employees most often become confused about qualifying for the incentive?',
    'meeting_question', 'engagement_and_communication', 'clarity_of_value', 102, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'incentive_communication'), (v_rec_id, 'q13');

  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'MQ-CLARITY-004', 'Does the current experience require employees to know which vendor provides a service before they can find help?',
    'Does the current experience require employees to know which vendor provides a service before they can find help?',
    'meeting_question', 'experience_and_access', 'clarity_of_value', 103, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'resource_consolidation'), (v_rec_id, 'q14');

  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'MQ-MOTIVATION-001', 'What is the easiest meaningful action an employee could take today?',
    'What is the easiest meaningful action an employee could take today?',
    'meeting_question', 'engagement_and_communication', 'motivation_overcoming_inertia', 104, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'goal_design'), (v_rec_id, 'q12');

  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'MQ-TRUST-001', 'What assumptions might employees be making about who can access their data?',
    'What assumptions might employees be making about who can access their data?',
    'meeting_question', 'culture_and_social_support', 'trust_social_proof', 105, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'privacy'), (v_rec_id, 'q20');

  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'MQ-TRUST-002', 'What behavior do employees currently see leaders model?',
    'What behavior do employees currently see leaders model?',
    'meeting_question', 'strategy_and_leadership', 'trust_social_proof', 106, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'leadership_modeling'), (v_rec_id, 'q3'), (v_rec_id, 'q17');

  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'MQ-FRICTION-001', 'How many clicks, systems, and decisions separate an employee from the right resource?',
    'How many clicks, systems, and decisions separate an employee from the right resource?',
    'meeting_question', 'experience_and_access', 'structural_environmental_friction', 107, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'centralization'), (v_rec_id, 'q14');

  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'MQ-STRATEGY-001', 'What decision should these objectives help the organization make?',
    'What decision should these objectives help the organization make?',
    'meeting_question', 'strategy_and_leadership', 'clarity_of_value', 108, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'strategy_definition'), (v_rec_id, 'q1'), (v_rec_id, 'q22');

  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'MQ-MEASURE-002', 'Where is the largest drop between awareness and sustained action?',
    'Where is the largest drop between awareness and sustained action?',
    'meeting_question', 'measurement_and_improvement', 'clarity_of_value', 109, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'engagement_funnel'), (v_rec_id, 'q23');

  v_rec_id := gen_random_uuid();
  INSERT INTO public.recommendations (id, framework_id, bank_id, title, description, recommendation_type, dimension_key, driver_key, display_order, is_active)
  VALUES (v_rec_id, v_framework_id, 'MQ-MEASURE-008', 'What should a leader understand within two minutes of opening the report?',
    'What should a leader understand within two minutes of opening the report?',
    'meeting_question', 'measurement_and_improvement', 'clarity_of_value', 110, true);
  INSERT INTO public.recommendation_tags VALUES (v_rec_id, 'reporting'), (v_rec_id, 'q22'), (v_rec_id, 'q24');

  -- Diagnostic tags for all 25 scored questions
  INSERT INTO public.assessment_question_diagnostic_tags (assessment_version_id, question_id, tag_key, severity_threshold) VALUES
  (v_version_id, 'b607275f-9953-40f0-8655-87193a32a214', 'q1', 3),
  (v_version_id, 'bb85bf50-71d5-4bfb-b766-b45ec4761488', 'q2', 3),
  (v_version_id, 'e83b9416-b640-4add-bcb8-5a05de3bb061', 'q3', 3),
  (v_version_id, '936de9ad-c07f-4614-9598-48ac6a5ccf3a', 'q4', 3),
  (v_version_id, '5781b10e-9875-48e6-9979-83bbde41a75d', 'q5', 3),
  (v_version_id, '9f13e00f-01bd-4239-86c5-5785d73ba11b', 'q6', 3),
  (v_version_id, '8f2cf9b5-eeba-45b8-b688-5f6f35ea80ec', 'q7', 3),
  (v_version_id, '8bf13e35-6905-43b2-b1b2-c61f77c6f762', 'q8', 3),
  (v_version_id, '0ecfe3fa-291c-47e2-97a8-4b4c6fc2e2b8', 'q9', 3),
  (v_version_id, '12e51354-98f0-4b17-aee6-fc0a9ad4750f', 'q10', 3),
  (v_version_id, '4374ffe3-ec44-4d98-8847-138b7f010604', 'q11', 3),
  (v_version_id, '0bd5c704-e946-43e4-9149-ee529a1a9ae2', 'q12', 3),
  (v_version_id, 'e8829cdb-c2fd-4733-aa82-1b81790ae4a0', 'q13', 3),
  (v_version_id, 'f9173f4d-5daa-42bd-9382-19b5fae89be6', 'q14', 3),
  (v_version_id, 'ba390172-3a12-4116-8ea6-78f276f2b477', 'q15', 3),
  (v_version_id, 'b3806f95-a60a-4399-9cfe-082c39a69bd6', 'q16', 3),
  (v_version_id, '9fefa313-7557-4b23-b35b-da70306d40f3', 'q17', 3),
  (v_version_id, 'a8795f54-b19f-4c22-b0a5-486784556701', 'q18', 3),
  (v_version_id, '0951228e-f5d0-4c6a-9976-20e551f5c6cc', 'q19', 3),
  (v_version_id, '7963cb35-8ba8-4bee-8e42-437b9488d15e', 'q20', 3),
  (v_version_id, '8fed70e9-ffa7-4248-8ba7-65e5f172db49', 'q21', 3),
  (v_version_id, '8b28d4b5-2fb7-40e2-8172-3e4b0a522c53', 'q22', 3),
  (v_version_id, '71b4c0f2-fd46-42c0-b326-157ceb4f3374', 'q23', 3),
  (v_version_id, '1a45502b-2857-41eb-b34a-6bc703eb2051', 'q24', 3),
  (v_version_id, '31a16f0a-f2ef-4621-97a5-d9301c9bbe3a', 'q25', 3)
  ON CONFLICT DO NOTHING;
END $$;

-- ============================================================
-- 3. Wire framework to published Propel version (temporarily disable trigger)
-- ============================================================
ALTER TABLE public.assessment_versions DISABLE TRIGGER trg_protect_published_version;
UPDATE public.assessment_versions
SET recommendation_framework_id = '11111111-0000-0000-0000-000000000001'
WHERE id = '20e8137a-7254-4376-930d-84951efbb68f';
ALTER TABLE public.assessment_versions ENABLE TRIGGER trg_protect_published_version;
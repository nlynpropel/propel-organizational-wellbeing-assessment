import type {
  SnapshotStrategyDimensionScore,
  SnapshotBehavioralReadinessDriver,
  SnapshotContextualResponse,
  SnapshotDiagnosticFinding,
  SnapshotRecommendation,
  SnapshotInputJson,
  SnapshotStructureValidation,
} from './database.types';

export type {
  SnapshotStrategyDimensionScore,
  SnapshotBehavioralReadinessDriver,
  SnapshotContextualResponse,
  SnapshotDiagnosticFinding,
  SnapshotRecommendation,
  SnapshotInputJson,
  SnapshotStructureValidation,
};

export function validateSnapshotStructure(input: Record<string, unknown>): SnapshotStructureValidation {
  const requiredSections = [
    'snapshot_version',
    'workspace_title',
    'workspace_status',
    'client_organization',
    'assessment',
    'recommendations',
    'outcomes',
    'metrics',
    'programs',
    'utilization',
    'resource_gaps',
    'notes',
    'evidence_sources',
    'readiness',
    'created_at',
  ];

  const requiredAssessmentKeys = [
    'template_name',
    'instance_status',
    'overall_score',
    'maturity_band',
    'strategy_dimension_scores',
    'behavioral_readiness',
    'contextual_responses',
    'diagnostic_findings',
  ];

  const requiredOrgKeys = ['name', 'type', 'industry', 'size_band'];
  const requiredReadinessKeys = [
    'clarity_of_value',
    'motivation_overcoming_inertia',
    'trust_social_proof',
    'structural_environmental_friction',
  ];

  const missing: string[] = [];
  const details: Record<string, boolean> = {};

  for (const key of requiredSections) {
    const present = key in input && input[key] !== undefined;
    details[key] = present;
    if (!present) missing.push(key);
  }

  const assessment = input.assessment as Record<string, unknown> | undefined;
  if (assessment) {
    for (const key of requiredAssessmentKeys) {
      const present = key in assessment;
      details[`assessment.${key}`] = present;
      if (!present) missing.push(`assessment.${key}`);
    }

    const br = assessment.behavioral_readiness as Record<string, unknown> | undefined;
    if (br) {
      for (const driver of requiredReadinessKeys) {
        const present = driver in br;
        details[`assessment.behavioral_readiness.${driver}`] = present;
        if (!present) missing.push(`assessment.behavioral_readiness.${driver}`);
      }
    } else {
      for (const driver of requiredReadinessKeys) {
        details[`assessment.behavioral_readiness.${driver}`] = false;
        missing.push(`assessment.behavioral_readiness.${driver}`);
      }
    }
  }

  const org = input.client_organization as Record<string, unknown> | undefined;
  if (org) {
    for (const key of requiredOrgKeys) {
      const present = key in org;
      details[`client_organization.${key}`] = present;
      if (!present) missing.push(`client_organization.${key}`);
    }
  }

  return {
    valid: missing.length === 0,
    missingSections: missing,
    details,
  };
}

export function makeMockSnapshotInput(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    snapshot_version: 1,
    workspace_title: 'Test Workspace',
    workspace_status: 'draft',
    client_organization: {
      name: 'Test Corp',
      type: 'employer',
      industry: 'Technology',
      size_band: '500-1000',
      description: 'A test company',
    },
    assessment: {
      template_name: 'Propel Wellbeing Opportunity Index',
      template_description: 'Comprehensive assessment',
      instance_status: 'submitted',
      submitted_at: '2026-01-15T10:00:00Z',
      overall_score: 72.5,
      maturity_band: 'Established',
      strategy_dimension_scores: [
        { dimension: 'Strategy and Leadership', normalized_score: 78, raw_score: 39, answered_questions: 5, possible_questions: 5 },
        { dimension: 'Employee Relevance', normalized_score: 65, raw_score: 33, answered_questions: 5, possible_questions: 5 },
        { dimension: 'Engagement and Communication', normalized_score: 70, raw_score: 35, answered_questions: 5, possible_questions: 5 },
        { dimension: 'Experience and Access', normalized_score: 68, raw_score: 34, answered_questions: 5, possible_questions: 5 },
        { dimension: 'Culture and Social Support', normalized_score: 75, raw_score: 38, answered_questions: 5, possible_questions: 5 },
        { dimension: 'Measurement and Improvement', normalized_score: 80, raw_score: 40, answered_questions: 5, possible_questions: 5 },
      ],
      behavioral_readiness: {
        clarity_of_value: {
          score: 72,
          label: 'Clarity of Value',
          interpretation: 'Employees have moderate understanding of program value; communication could be strengthened.',
        },
        motivation_overcoming_inertia: {
          score: 60,
          label: 'Motivation and Overcoming Inertia',
          interpretation: 'Employees show moderate motivation; some barriers to engagement remain.',
        },
        trust_social_proof: {
          score: 55,
          label: 'Trust and Social Proof',
          interpretation: 'Moderate trust exists; social proof mechanisms could be strengthened.',
        },
        structural_environmental_friction: {
          score: 48,
          label: 'Structural and Environmental Friction',
          interpretation: 'Significant structural friction; access barriers are notable.',
        },
      },
      contextual_responses: [
        {
          question: 'How would you rate leadership commitment to wellbeing?',
          reporting_label: 'Leadership Commitment',
          question_type: 'numeric_rating',
          is_scored: true,
          selected_option: null,
          numeric_value: 4,
          text_value: null,
          boolean_value: null,
          score_value: 80,
        },
      ],
      diagnostic_findings: [
        {
          tag: 'concern_resources_are_fragmented',
          severity_threshold: 3,
          question: 'Are wellbeing resources easy to find?',
          reporting_label: 'Resource Accessibility',
        },
      ],
      driver_mapping: [
        {
          driver_key: 'clarity_of_value',
          question: 'Do employees understand the value of available programs?',
          reporting_label: 'Program Value Awareness',
          mapping_weight: 1.0,
        },
      ],
    },
    recommendations: [
      {
        title: 'Establish a Wellbeing Champion Network',
        description: 'Identify and train champions across departments.',
        rationale: 'Low engagement scores suggest a need for social proof.',
        recommendation_type: 'high_impact_move',
        dimension: 'culture_and_social_support',
        driver: 'trust_social_proof',
        effort_level: 'medium',
        impact_level: 'high',
        strength_title: null,
        strength_description: null,
        display_order: 1,
      },
    ],
    outcomes: [
      { outcome_category: 'engagement', title: 'Improve program participation', description: 'Increase overall engagement', priority: 'high', target_population: 'All employees', desired_timeframe: '6 months', source_type: 'analyst_entered', source_note: null },
    ],
    metrics: [
      { metric_name: 'Program participation rate', metric_category: 'engagement', current_value: '45%', target_value: '70%', unit: 'percentage', measurement_period: 'quarterly', population_description: 'All employees', data_source: 'HR system', data_quality: 'client_reported', notes: null },
    ],
    programs: [
      { program_name: 'EAP', provider_name: 'LifeWorks', program_category: 'Mental Health', description: 'Employee Assistance Program', target_population: 'All employees', eligibility_summary: 'All eligible', access_method: 'Phone and app', communication_channels: 'Email, intranet', incentive_connected: false, status: 'active', start_date: '2025-01-01', end_date: null, source_type: 'client_reported', source_note: null },
    ],
    utilization: [
      { program_name: 'EAP', measurement_start: '2026-01-01', measurement_end: '2026-03-31', eligible_population: 500, registered_count: 100, active_user_count: 45, completion_count: 20, utilization_rate: 9.0, repeat_engagement_rate: 15.0, benchmark_value: '15%', benchmark_source: 'Industry average', utilization_status: 'low', data_quality: 'client_reported', notes: 'Low utilization despite high eligibility' },
    ],
    resource_gaps: [
      { gap_category: 'program_gap', title: 'No mental health first aiders', description: 'No trained mental health first aiders on site', affected_population: 'On-site staff', evidence_source: 'manual', severity: 'medium', confidence: 'high', status: 'open', user_confirmed: true },
    ],
    notes: [
      { note_type: 'analyst_question', title: 'Budget constraints', content: 'Client mentioned budget constraints for new programs', visibility: 'internal', importance: 'high' },
    ],
    evidence_sources: [
      { source_type: 'assessment_data', source_name: '2026 Wellness Survey', source_date: '2026-01-15', description: 'Annual employee survey', file_reference: 'survey-2026.pdf', verification_status: 'verified' },
    ],
    readiness: {
      level: 'sufficient',
      requirements: [],
      complete_count: 7,
      total_required: 7,
    },
    created_at: '2026-07-22T16:00:00Z',
    ...overrides,
  };
}

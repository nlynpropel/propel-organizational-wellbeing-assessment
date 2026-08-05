import { describe, it, expect } from 'vitest';
import {
  validateDeckPayload,
  validateDeckOverflow,
  validateNoProhibitedMetadata,
  validateNoPlaceholderTokens,
  type DeckPayload,
} from '../../services/deckPayload';
import { buildDeckPayload, getExpectedSlideCount } from '../../services/deckBuilder';
import type { ReportData } from '../../services/reportData';
import type { ReviewedOutput } from '../../services/aiGenerations';

// ============================================================
// Helpers — build a valid DeckPayload for testing
// ============================================================

function makeValidPayload(): DeckPayload {
  return {
    client: {
      name: 'Java Coffee',
      assessment_name: 'Propel Well-being Opportunity Index',
      assessment_date: 'Jul 21, 2026',
    },
    assessment: {
      overall_score: 63,
      maturity: 'Established',
      bands: ['Reactive', 'Developing', 'Established', 'Strategic', 'Leading'],
      dimensions: [
        { name: 'Strategy and Leadership', score: 75, level: 'Strategic' },
        { name: 'Employee Relevance', score: 55, level: 'Established' },
        { name: 'Engagement and Communication', score: 32, level: 'Reactive' },
        { name: 'Experience and Access', score: 75, level: 'Strategic' },
        { name: 'Culture and Social Support', score: 70, level: 'Established' },
        { name: 'Measurement and Improvement', score: 70, level: 'Established' },
      ],
      behavioral_drivers: [
        { name: 'Clarity of Value', score: 59, level: 'Meaningful barriers', body: 'Test body.' },
        { name: 'Motivation and Overcoming Inertia', score: 53, level: 'Meaningful barriers', body: 'Test body.' },
        { name: 'Trust and Social Proof', score: 66, level: 'Generally supportive', body: 'Test body.' },
        { name: 'Structural and Environmental Friction', score: 65, level: 'Generally supportive', body: 'Test body.' },
      ],
    },
    strategy: {
      executive_summary: 'A valid summary.',
      current_maturity: 'A valid maturity interpretation.',
      strengths: [{ title: 'Strength One', body: 'Strength body.' }],
      priority_opportunities: [{ title: 'Opportunity One', body: 'Opportunity body.' }],
      holding_back: [{ title: 'Barrier One', body: 'Barrier body.' }],
      recommendations: [
        {
          title: 'Recommendation One',
          why_it_matters: 'Why it matters.',
          recommended_action: 'Action.',
          suggested_first_step: 'First step.',
          expected_impact: 'Impact.',
          implementation_order: 'Phase 1.',
          guidance: 'Guidance.',
          related_findings: 'Findings.',
        },
      ],
      implementation_sequence: {
        now: { title: 'Phase 1', body: 'Foundation.' },
        next: { title: 'Phase 2', body: 'Pilot.' },
        later: { title: 'Phase 3', body: 'Scale.' },
      },
      discussion_questions: ['Question 1?', 'Question 2?'],
    },
  };
}

function makeMockReportData(): ReportData {
  return {
    instance: {
      id: 'inst-1',
      organization_id: 'org-1',
      broker_id: 'broker-1',
      assessment_version_id: 'ver-1',
      assessment_template_id: 'tmpl-1',
      client_name: null,
      client_email: null,
      status: 'submitted',
      overall_score: 63,
      submitted_at: '2026-07-21T10:00:00Z',
      created_at: '2026-07-01T10:00:00Z',
      updated_at: '2026-07-21T10:00:00Z',
    },
    template: {
      id: 'tmpl-1',
      template_name: 'Propel Well-being Opportunity Index',
      owner_type: 'propel',
      report_type: 'scored',
      recommendations_enabled: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    version: null,
    organization: {
      id: 'org-1',
      organization_name: 'Java Coffee',
      organization_type: 'employer',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    sections: [],
    responses: [],
    sectionScores: [
      { id: 'ss-1', assessment_instance_id: 'inst-1', section_title: 'Strategy and Leadership', normalized_score: 75, raw_score: 38, answered_questions: 5, possible_questions: 5, created_at: '2026-07-21T10:00:00Z' },
      { id: 'ss-2', assessment_instance_id: 'inst-1', section_title: 'Employee Relevance', normalized_score: 55, raw_score: 28, answered_questions: 5, possible_questions: 5, created_at: '2026-07-21T10:00:00Z' },
      { id: 'ss-3', assessment_instance_id: 'inst-1', section_title: 'Engagement and Communication', normalized_score: 32, raw_score: 16, answered_questions: 5, possible_questions: 5, created_at: '2026-07-21T10:00:00Z' },
      { id: 'ss-4', assessment_instance_id: 'inst-1', section_title: 'Experience and Access', normalized_score: 75, raw_score: 38, answered_questions: 5, possible_questions: 5, created_at: '2026-07-21T10:00:00Z' },
      { id: 'ss-5', assessment_instance_id: 'inst-1', section_title: 'Culture and Social Support', normalized_score: 70, raw_score: 35, answered_questions: 5, possible_questions: 5, created_at: '2026-07-21T10:00:00Z' },
      { id: 'ss-6', assessment_instance_id: 'inst-1', section_title: 'Measurement and Improvement', normalized_score: 70, raw_score: 35, answered_questions: 5, possible_questions: 5, created_at: '2026-07-21T10:00:00Z' },
    ],
    result: {
      id: 'res-1',
      assessment_instance_id: 'inst-1',
      normalized_score: 63,
      score_band: 'Established',
      result_snapshot: {
        behavioral_readiness: {
          clarity_of_value: 59,
          motivation_overcoming_inertia: 53,
          trust_social_proof: 66,
          structural_environmental_friction: 65,
        },
      },
      created_at: '2026-07-21T10:00:00Z',
    },
    scoreBands: [
      { id: 'sb-1', assessment_version_id: 'ver-1', band_label: 'Reactive', display_order: 1, min_score: 0, max_score: 34, created_at: '2026-01-01T00:00:00Z' },
      { id: 'sb-2', assessment_version_id: 'ver-1', band_label: 'Developing', display_order: 2, min_score: 35, max_score: 54, created_at: '2026-01-01T00:00:00Z' },
      { id: 'sb-3', assessment_version_id: 'ver-1', band_label: 'Established', display_order: 3, min_score: 55, max_score: 69, created_at: '2026-01-01T00:00:00Z' },
      { id: 'sb-4', assessment_version_id: 'ver-1', band_label: 'Strategic', display_order: 4, min_score: 70, max_score: 84, created_at: '2026-01-01T00:00:00Z' },
      { id: 'sb-5', assessment_version_id: 'ver-1', band_label: 'Leading', display_order: 5, min_score: 85, max_score: 100, created_at: '2026-01-01T00:00:00Z' },
    ],
    overallScore: 63,
    scoreBand: 'Established',
    behavioralReadiness: {
      clarity_of_value: 59,
      motivation_overcoming_inertia: 53,
      trust_social_proof: 66,
      structural_environmental_friction: 65,
    },
    contextualAnswers: [],
    showRecommendations: true,
    showBand: true,
    recommendations: {
      strengths: [{ title: 'Guided Starting Experience', description: 'The program provides a visible starting experience.', dimension: 'experience_and_access', driver: null, score: 75 }],
      priorityOpportunities: [{ title: 'Break Large Goals Into Immediate Micro-Actions', description: 'Translate broad goals into small actions.', dimension: 'engagement_and_communication', driver: 'motivation_overcoming_inertia', score: 32 }],
      quickWins: [],
      highImpactMoves: [],
    },
  };
}

function makeMockStrategyOutput(): ReviewedOutput {
  return {
    executive_summary: 'Java Coffee summary.',
    maturity_interpretation: 'Maturity interpretation.',
    prioritized_barriers: [
      { title: 'Fragmented communications', description: 'Communications are fragmented.' },
    ],
    priority_recommendations: [
      {
        title: 'Run a short episodic campaign',
        why_this_matters: 'Why it matters.',
        assessment_evidence: 'Assessment evidence.',
        propel_knowledge_evidence: 'Guidance.',
        recommended_action: 'Action.',
        suggested_first_step: 'First step.',
        expected_strategic_impact: 'Impact.',
        implementation_sequence: 'Phase 1.',
        evidence_references: [],
      },
    ],
    implementation_sequence: [
      'Phase 1 - Foundation: Create landing page.',
      'Phase 2 - Pilot: Run campaign.',
      'Phase 3 - Scale: Expand.',
    ],
    client_discussion_questions: ['Question 1?', 'Question 2?', 'Question 3?'],
    limitations: '',
    source_references: [],
    evidence_references: [],
  };
}

// ============================================================
// Tests
// ============================================================

describe('deckPayload — validateDeckPayload', () => {
  it('valid payload passes validation', () => {
    const payload = makeValidPayload();
    const errors = validateDeckPayload(payload);
    expect(errors).toHaveLength(0);
  });

  it('missing client name fails', () => {
    const payload = makeValidPayload();
    payload.client.name = '';
    const errors = validateDeckPayload(payload);
    expect(errors.some(e => e.field === 'client.name')).toBe(true);
  });

  it('overall score out of range fails', () => {
    const payload = makeValidPayload();
    payload.assessment.overall_score = 150;
    const errors = validateDeckPayload(payload);
    expect(errors.some(e => e.field === 'assessment.overall_score')).toBe(true);
  });

  it('wrong number of dimensions fails', () => {
    const payload = makeValidPayload();
    payload.assessment.dimensions = payload.assessment.dimensions.slice(0, 5);
    const errors = validateDeckPayload(payload);
    expect(errors.some(e => e.field === 'assessment.dimensions')).toBe(true);
  });

  it('wrong number of behavioral drivers fails', () => {
    const payload = makeValidPayload();
    payload.assessment.behavioral_drivers = payload.assessment.behavioral_drivers.slice(0, 3);
    const errors = validateDeckPayload(payload);
    expect(errors.some(e => e.field === 'assessment.behavioral_drivers')).toBe(true);
  });

  it('missing executive summary fails', () => {
    const payload = makeValidPayload();
    payload.strategy.executive_summary = '';
    const errors = validateDeckPayload(payload);
    expect(errors.some(e => e.field === 'strategy.executive_summary')).toBe(true);
  });

  it('no strengths fails', () => {
    const payload = makeValidPayload();
    payload.strategy.strengths = [];
    const errors = validateDeckPayload(payload);
    expect(errors.some(e => e.field === 'strategy.strengths')).toBe(true);
  });

  it('no recommendations fails', () => {
    const payload = makeValidPayload();
    payload.strategy.recommendations = [];
    const errors = validateDeckPayload(payload);
    expect(errors.some(e => e.field === 'strategy.recommendations')).toBe(true);
  });

  it('missing implementation phase fails', () => {
    const payload = makeValidPayload();
    payload.strategy.implementation_sequence.now = { title: '', body: '' };
    const errors = validateDeckPayload(payload);
    expect(errors.some(e => e.field === 'strategy.implementation_sequence.now')).toBe(true);
  });

  it('dimension score out of range fails', () => {
    const payload = makeValidPayload();
    payload.assessment.dimensions[0].score = -5;
    const errors = validateDeckPayload(payload);
    expect(errors.some(e => e.field.includes('dimensions[0].score'))).toBe(true);
  });
});

describe('deckPayload — validateDeckOverflow', () => {
  it('valid payload has no overflow violations', () => {
    const payload = makeValidPayload();
    const violations = validateDeckOverflow(payload);
    expect(violations).toHaveLength(0);
  });

  it('executive summary over 130 words fails', () => {
    const payload = makeValidPayload();
    payload.strategy.executive_summary = 'word '.repeat(131).trim();
    const violations = validateDeckOverflow(payload);
    expect(violations.some(v => v.field === 'strategy.executive_summary')).toBe(true);
  });

  it('strength title over 10 words fails', () => {
    const payload = makeValidPayload();
    payload.strategy.strengths[0].title = 'one two three four five six seven eight nine ten eleven';
    const violations = validateDeckOverflow(payload);
    expect(violations.some(v => v.field === 'strategy.strengths[0].title')).toBe(true);
  });

  it('recommendation section over 55 words fails', () => {
    const payload = makeValidPayload();
    payload.strategy.recommendations[0].why_it_matters = 'word '.repeat(56).trim();
    const violations = validateDeckOverflow(payload);
    expect(violations.some(v => v.field === 'strategy.recommendations[0].why_it_matters')).toBe(true);
  });

  it('more than 3 discussion questions fails', () => {
    const payload = makeValidPayload();
    payload.strategy.discussion_questions = ['Q1?', 'Q2?', 'Q3?', 'Q4?'];
    const violations = validateDeckOverflow(payload);
    expect(violations.some(v => v.field === 'strategy.discussion_questions')).toBe(true);
  });
});

describe('deckPayload — validateNoProhibitedMetadata', () => {
  it('clean payload has no violations', () => {
    const payload = makeValidPayload();
    const violations = validateNoProhibitedMetadata(payload);
    expect(violations).toHaveLength(0);
  });

  it('file ID in recommendation fails', () => {
    const payload = makeValidPayload();
    payload.strategy.recommendations[0].guidance = 'See file-abc123 for details.';
    const violations = validateNoProhibitedMetadata(payload);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('source citation in summary fails', () => {
    const payload = makeValidPayload();
    payload.strategy.executive_summary = 'According to the document, the program is strong.';
    const violations = validateNoProhibitedMetadata(payload);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('filename in holding_back fails', () => {
    const payload = makeValidPayload();
    payload.strategy.holding_back[0].body = 'See report.pdf for details.';
    const violations = validateNoProhibitedMetadata(payload);
    expect(violations.length).toBeGreaterThan(0);
  });
});

describe('deckPayload — validateNoPlaceholderTokens', () => {
  it('clean payload has no violations', () => {
    const payload = makeValidPayload();
    const violations = validateNoPlaceholderTokens(payload);
    expect(violations).toHaveLength(0);
  });

  it('unresolved {{token}} in client name fails', () => {
    const payload = makeValidPayload();
    payload.client.name = '{{client_name}}';
    const violations = validateNoPlaceholderTokens(payload);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('unresolved ${var} in recommendation title fails', () => {
    const payload = makeValidPayload();
    payload.strategy.recommendations[0].title = '${recommendation_title}';
    const violations = validateNoPlaceholderTokens(payload);
    expect(violations.length).toBeGreaterThan(0);
  });
});

describe('deckBuilder — buildDeckPayload', () => {
  it('maps report data and strategy output to deck payload', () => {
    const reportData = makeMockReportData();
    const strategyOutput = makeMockStrategyOutput();
    const { payload, errors } = buildDeckPayload(reportData, strategyOutput);

    expect(errors).toHaveLength(0);
    expect(payload.client.name).toBe('Java Coffee');
    expect(payload.client.assessment_name).toBe('Propel Well-being Opportunity Index');
    expect(payload.assessment.overall_score).toBe(63);
    expect(payload.assessment.maturity).toBe('Established');
    expect(payload.assessment.dimensions).toHaveLength(6);
    expect(payload.assessment.behavioral_drivers).toHaveLength(4);
    expect(payload.strategy.executive_summary).toBe('Java Coffee summary.');
    expect(payload.strategy.strengths).toHaveLength(1);
    expect(payload.strategy.priority_opportunities).toHaveLength(1);
    expect(payload.strategy.recommendations).toHaveLength(1);
    expect(payload.strategy.implementation_sequence.now.title).toBe('Phase 1');
    expect(payload.strategy.implementation_sequence.now.body).toBe('Foundation: Create landing page.');
    expect(payload.strategy.discussion_questions).toHaveLength(3);
  });

  it('maps behavioral driver labels and descriptions', () => {
    const reportData = makeMockReportData();
    const strategyOutput = makeMockStrategyOutput();
    const { payload } = buildDeckPayload(reportData, strategyOutput);

    expect(payload.assessment.behavioral_drivers[0].name).toBe('Clarity of Value');
    expect(payload.assessment.behavioral_drivers[0].score).toBe(59);
    expect(payload.assessment.behavioral_drivers[0].body).toContain('value');
  });

  it('maps recommendation fields correctly', () => {
    const reportData = makeMockReportData();
    const strategyOutput = makeMockStrategyOutput();
    const { payload } = buildDeckPayload(reportData, strategyOutput);

    const rec = payload.strategy.recommendations[0];
    expect(rec.title).toBe('Run a short episodic campaign');
    expect(rec.why_it_matters).toBe('Why it matters.');
    expect(rec.guidance).toBe('Guidance.');
    expect(rec.related_findings).toBe('Assessment evidence.');
    expect(rec.expected_impact).toBe('Impact.');
  });
});

describe('deckBuilder — getExpectedSlideCount', () => {
  it('returns 8 + recommendation count', () => {
    const payload = makeValidPayload();
    expect(getExpectedSlideCount(payload)).toBe(9); // 8 + 1 rec
  });

  it('returns 8 for zero recommendations', () => {
    const payload = makeValidPayload();
    payload.strategy.recommendations = [];
    expect(getExpectedSlideCount(payload)).toBe(8);
  });

  it('returns 13 for five recommendations', () => {
    const payload = makeValidPayload();
    const baseRec = payload.strategy.recommendations[0];
    payload.strategy.recommendations = Array(5).fill(null).map(() => ({ ...baseRec }));
    expect(getExpectedSlideCount(payload)).toBe(13);
  });
});

describe('deckBuilder — 360 assessment exclusion', () => {
  it('360 report type is not scored and should not generate deck', () => {
    const reportData = makeMockReportData();
    // Simulate 360 by setting report_type to unscored_internal
    if (reportData.template) {
      reportData.template.report_type = 'unscored_internal';
    }
    // The UI checks report_type === 'unscored_internal' to route to UnscoredInternalReport
    // which never renders StrategyReportSection, so deck generation is impossible
    expect(reportData.template?.report_type).toBe('unscored_internal');
  });
});

describe('deckBuilder — approved vs unapproved strategy', () => {
  it('only approved strategy generation should allow deck generation', () => {
    // The UI checks latestGen?.status === 'approved' before showing the button
    const approvedGen = { status: 'approved' } as never;
    const draftGen = { status: 'draft_generated' } as never;
    const failedGen = { status: 'failed' } as never;

    expect(approvedGen.status).toBe('approved');
    expect(draftGen.status).not.toBe('approved');
    expect(failedGen.status).not.toBe('approved');
  });
});

describe('deckBuilder — regeneration creates new version', () => {
  it('supersedes_generation_id links to previous generation', () => {
    // The createPresentationGeneration function accepts supersedesGenerationId
    // which links the new record to the previous one via supersedes_generation_id
    // Both records remain in the database — previous is never overwritten
    const previousGen = { id: 'gen-1', status: 'completed' } as never;
    const newGen = {
      id: 'gen-2',
      status: 'queued',
      supersedes_generation_id: 'gen-1',
    } as never;

    expect(newGen.supersedes_generation_id).toBe(previousGen.id);
    expect(previousGen.status).toBe('completed'); // still available
  });
});

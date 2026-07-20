import { describe, it, expect } from 'vitest';
import {
  normalizeQuestionScore,
  calculateSectionScore,
  calculateOverallScore,
  getScoreBand,
  roundForDisplay,
  validateAssessment,
  validateScoreBands,
  canShowRecommendations,
  shouldShowScoreBand,
  DEFAULT_SCORE_BANDS,
  type ScoredSection,
  type ScoreBand,
} from '../assessmentScoring';
import type { AssessmentSectionWithQuestions, AssessmentScoreBandRow } from '../database.types';

// Standard 1-5 option range used by most tests
const SCALE_OPTIONS = [
  { id: 'opt1', scoreValue: 1, isNotApplicable: false },
  { id: 'opt2', scoreValue: 2, isNotApplicable: false },
  { id: 'opt3', scoreValue: 3, isNotApplicable: false },
  { id: 'opt4', scoreValue: 4, isNotApplicable: false },
  { id: 'opt5', scoreValue: 5, isNotApplicable: false },
];

function makeResponse(optionId: string, scoreValue: number) {
  return { selectedOptionId: optionId, scoreValue };
}

function makeResponsesMap(entries: [string, ReturnType<typeof makeResponse>][]): Map<string, ReturnType<typeof makeResponse>> {
  return new Map(entries);
}

function makeScoredSection(
  sectionId: string,
  questions: Array<{ questionId: string; weight: number; reverseScored: boolean; options: Array<{ id: string; scoreValue: number | null; isNotApplicable: boolean }> }>,
  sectionWeight = 1
): ScoredSection {
  return {
    sectionId,
    weight: sectionWeight,
    questions: questions.map((q) => ({
      questionId: q.questionId,
      weight: q.weight,
      reverseScored: q.reverseScored,
      options: q.options.map((o) => ({ id: o.id, scoreValue: o.scoreValue, isNotApplicable: o.isNotApplicable })),
    })),
  };
}

// Convenience: make a scored section with standard 1-5 scale questions
function makeScaleSection(
  sectionId: string,
  questionWeights: number[],
  sectionWeight = 1,
  reverseScored = false
): ScoredSection {
  return makeScoredSection(
    sectionId,
    questionWeights.map((w, i) => ({
      questionId: `q_${sectionId}_${i}`,
      weight: w,
      reverseScored,
      options: SCALE_OPTIONS,
    })),
    sectionWeight
  );
}

function makeSectionWithQuestions(
  sectionId: string,
  questions: Array<{
    id: string;
    question_text: string;
    is_scored: boolean;
    is_required: boolean;
    weight: number;
    options: Array<{ id: string; score_value: number | null; is_not_applicable: boolean }>;
  }>,
  weight = 1,
  isScored = true
): AssessmentSectionWithQuestions {
  return {
    id: sectionId,
    assessment_version_id: 'ver-1',
    title: `Section ${sectionId}`,
    description: null,
    display_order: 0,
    weight,
    is_scored: isScored,
    created_at: '',
    updated_at: '',
    questions: questions.map((q, i) => ({
      id: q.id,
      assessment_version_id: 'ver-1',
      assessment_section_id: sectionId,
      question_text: q.question_text,
      help_text: null,
      question_type: 'agreement5',
      display_order: i,
      is_required: q.is_required,
      is_scored: q.is_scored,
      weight: q.weight,
      reverse_scored: false,
      reporting_label: null,
      scoring_dimension: null,
      created_at: '',
      updated_at: '',
      options: q.options.map((o, j) => ({
        id: o.id,
        question_id: q.id,
        option_label: `Option ${j}`,
        option_value: `opt_${j}`,
        score_value: o.score_value,
        display_order: j,
        is_not_applicable: o.is_not_applicable,
        created_at: '',
      })),
    })),
  };
}

// ============================================================
// normalizeQuestionScore
// ============================================================
describe('normalizeQuestionScore', () => {
  it('normalizes a mid-range score to 50', () => {
    expect(normalizeQuestionScore(3, 1, 5, false)).toBe(50);
  });

  it('normalizes min score to 0', () => {
    expect(normalizeQuestionScore(1, 1, 5, false)).toBe(0);
  });

  it('normalizes max score to 100', () => {
    expect(normalizeQuestionScore(5, 1, 5, false)).toBe(100);
  });

  it('inverts for reverse-scored questions', () => {
    expect(normalizeQuestionScore(1, 1, 5, true)).toBe(100);
    expect(normalizeQuestionScore(5, 1, 5, true)).toBe(0);
    expect(normalizeQuestionScore(3, 1, 5, true)).toBe(50);
  });

  it('returns 0 when min equals max (no range)', () => {
    expect(normalizeQuestionScore(5, 5, 5, false)).toBe(0);
  });

  it('clamps out-of-range values to 0-100', () => {
    expect(normalizeQuestionScore(10, 1, 5, false)).toBe(100);
    expect(normalizeQuestionScore(-5, 1, 5, false)).toBe(0);
  });
});

// ============================================================
// calculateSectionScore
// ============================================================
describe('calculateSectionScore', () => {
  it('scores all questions answered at max', () => {
    const section = makeScaleSection('s1', [1, 1]);
    const responses = makeResponsesMap([
      ['q_s1_0', makeResponse('opt5', 5)],
      ['q_s1_1', makeResponse('opt5', 5)],
    ]);
    const result = calculateSectionScore(section, responses);
    expect(result.normalizedScore).toBe(100);
    expect(result.answeredQuestionCount).toBe(2);
    expect(result.possibleQuestionCount).toBe(2);
  });

  it('scores all questions answered at min', () => {
    const section = makeScaleSection('s1', [1, 1]);
    const responses = makeResponsesMap([
      ['q_s1_0', makeResponse('opt1', 1)],
      ['q_s1_1', makeResponse('opt1', 1)],
    ]);
    const result = calculateSectionScore(section, responses);
    expect(result.normalizedScore).toBe(0);
  });

  it('scores all questions answered at mid', () => {
    const section = makeScaleSection('s1', [1, 1]);
    const responses = makeResponsesMap([
      ['q_s1_0', makeResponse('opt3', 3)],
      ['q_s1_1', makeResponse('opt3', 3)],
    ]);
    const result = calculateSectionScore(section, responses);
    expect(result.normalizedScore).toBe(50);
  });

  it('excludes unanswered optional questions from denominator', () => {
    const section = makeScaleSection('s1', [1, 1]);
    const responses = makeResponsesMap([
      ['q_s1_0', makeResponse('opt5', 5)],
    ]);
    const result = calculateSectionScore(section, responses);
    expect(result.normalizedScore).toBe(100);
    expect(result.answeredQuestionCount).toBe(1);
    expect(result.possibleQuestionCount).toBe(2);
  });

  it('excludes unanswered required questions from denominator (preview behavior)', () => {
    // The client-side preview excludes all unanswered questions from the denominator.
    // The server-side finalize_assessment_submission RPC blocks submission if required
    // questions are unanswered, so by the time scores are computed server-side, all
    // required questions are answered. The preview just doesn't penalize for missing answers.
    const section = makeScaleSection('s1', [1, 1]);
    const responses = makeResponsesMap([
      ['q_s1_0', makeResponse('opt5', 5)],
    ]);
    const result = calculateSectionScore(section, responses);
    // Only q_s1_0 answered (norm=100), q_s1_1 excluded → 100/1 = 100
    expect(result.normalizedScore).toBe(100);
  });

  it('excludes N/A responses from denominator', () => {
    const section = makeScoredSection('s1', [
      { questionId: 'q1', weight: 1, reverseScored: false, options: [...SCALE_OPTIONS, { id: 'na', scoreValue: null, isNotApplicable: true }] },
      { questionId: 'q2', weight: 1, reverseScored: false, options: SCALE_OPTIONS },
    ]);
    const responses = makeResponsesMap([
      ['q1', makeResponse('na', 0)],
      ['q2', makeResponse('opt5', 5)],
    ]);
    const result = calculateSectionScore(section, responses);
    expect(result.normalizedScore).toBe(100);
    expect(result.answeredQuestionCount).toBe(1);
  });

  it('handles reverse scoring', () => {
    const section = makeScaleSection('s1', [1], 1, true);
    const responses = makeResponsesMap([
      ['q_s1_0', makeResponse('opt1', 1)],
    ]);
    const result = calculateSectionScore(section, responses);
    // score=1, min=1, max=5 → norm=0, reversed=100-0=100
    expect(result.normalizedScore).toBe(100);
  });

  it('handles unequal question weights', () => {
    const section = makeScaleSection('s1', [3, 1]);
    const responses = makeResponsesMap([
      ['q_s1_0', makeResponse('opt5', 5)], // norm=100
      ['q_s1_1', makeResponse('opt1', 1)], // norm=0
    ]);
    const result = calculateSectionScore(section, responses);
    // (100*3 + 0*1) / 4 = 75
    expect(result.normalizedScore).toBe(75);
  });

  it('handles section with no answered scored questions (division by zero)', () => {
    const section = makeScaleSection('s1', [1]);
    const responses = new Map();
    const result = calculateSectionScore(section, responses);
    expect(result.normalizedScore).toBe(0);
  });

  it('handles zero-weight question', () => {
    const section = makeScaleSection('s1', [0, 1]);
    const responses = makeResponsesMap([
      ['q_s1_0', makeResponse('opt5', 5)],
      ['q_s1_1', makeResponse('opt3', 3)], // norm=50
    ]);
    const result = calculateSectionScore(section, responses);
    // q0 weight=0 excluded, q1 norm=50 → 50*1/1 = 50
    expect(result.normalizedScore).toBe(50);
  });

  it('handles min equals max score (single option)', () => {
    const section = makeScoredSection('s1', [
      { questionId: 'q1', weight: 1, reverseScored: false, options: [{ id: 'o1', scoreValue: 3, isNotApplicable: false }] },
    ]);
    const responses = makeResponsesMap([
      ['q1', makeResponse('o1', 3)],
    ]);
    const result = calculateSectionScore(section, responses);
    // min==max=3 → norm=0
    expect(result.normalizedScore).toBe(0);
  });

  it('handles yes/no question', () => {
    const section = makeScoredSection('s1', [
      { questionId: 'q1', weight: 1, reverseScored: false, options: [
        { id: 'yes', scoreValue: 1, isNotApplicable: false },
        { id: 'no', scoreValue: 0, isNotApplicable: false },
      ] },
    ]);
    const responses = makeResponsesMap([
      ['q1', makeResponse('yes', 1)],
    ]);
    const result = calculateSectionScore(section, responses);
    // score=1, min=0, max=1 → norm=100
    expect(result.normalizedScore).toBe(100);
  });

  it('handles single select with custom scores', () => {
    const section = makeScoredSection('s1', [
      { questionId: 'q1', weight: 1, reverseScored: false, options: [
        { id: 'a', scoreValue: 0, isNotApplicable: false },
        { id: 'b', scoreValue: 5, isNotApplicable: false },
        { id: 'c', scoreValue: 10, isNotApplicable: false },
      ] },
    ]);
    const responses = makeResponsesMap([
      ['q1', makeResponse('b', 5)],
    ]);
    const result = calculateSectionScore(section, responses);
    // score=5, min=0, max=10 → norm=50
    expect(result.normalizedScore).toBe(50);
  });
});

// ============================================================
// calculateOverallScore
// ============================================================
describe('calculateOverallScore', () => {
  it('combines section scores with weights', () => {
    const sections: ScoredSection[] = [
      makeScaleSection('s1', [1], 2),
      makeScaleSection('s2', [1], 1),
    ];
    const responses = makeResponsesMap([
      ['q_s1_0', makeResponse('opt5', 5)], // s1 = 100
      ['q_s2_0', makeResponse('opt1', 1)], // s2 = 0
    ]);
    const result = calculateOverallScore(sections, responses);
    // (100*2 + 0*1) / 3 = 66.67
    expect(result.normalizedScore).toBeCloseTo(66.67, 1);
    expect(result.sectionScores).toHaveLength(2);
  });

  it('handles unequal section weights', () => {
    const sections: ScoredSection[] = [
      makeScaleSection('s1', [1], 3),
      makeScaleSection('s2', [1], 1),
    ];
    const responses = makeResponsesMap([
      ['q_s1_0', makeResponse('opt5', 5)], // s1 = 100
      ['q_s2_0', makeResponse('opt1', 1)], // s2 = 0
    ]);
    const result = calculateOverallScore(sections, responses);
    // (100*3 + 0*1) / 4 = 75
    expect(result.normalizedScore).toBe(75);
  });

  it('handles zero-weight section', () => {
    const sections: ScoredSection[] = [
      makeScaleSection('s1', [1], 0),
      makeScaleSection('s2', [1], 1),
    ];
    const responses = makeResponsesMap([
      ['q_s1_0', makeResponse('opt5', 5)],
      ['q_s2_0', makeResponse('opt3', 3)], // norm=50
    ]);
    const result = calculateOverallScore(sections, responses);
    // s1 weight=0 excluded, s2 = 50 → 50*1/1 = 50
    expect(result.normalizedScore).toBe(50);
  });

  it('handles assessment with no scored questions', () => {
    const sections: ScoredSection[] = [];
    const result = calculateOverallScore(sections, new Map());
    expect(result.normalizedScore).toBe(0);
    expect(result.scoreBand).toBe('Reactive');
  });

  it('uses custom score bands when provided', () => {
    const sections: ScoredSection[] = [
      makeScaleSection('s1', [1], 1),
    ];
    const responses = makeResponsesMap([
      ['q_s1_0', makeResponse('opt5', 5)], // score=100
    ]);
    const customBands: AssessmentScoreBandRow[] = [
      { id: 'b1', assessment_version_id: 'v1', band_name: 'Beginner', min_threshold: 0, max_threshold: 50, display_order: 1, created_at: '' },
      { id: 'b2', assessment_version_id: 'v1', band_name: 'Expert', min_threshold: 51, max_threshold: 100, display_order: 2, created_at: '' },
    ];
    const result = calculateOverallScore(sections, responses, customBands);
    expect(result.normalizedScore).toBe(100);
    expect(result.scoreBand).toBe('Expert');
  });

  it('uses default bands when no custom bands', () => {
    const sections: ScoredSection[] = [
      makeScaleSection('s1', [1], 1),
    ];
    const responses = makeResponsesMap([
      ['q_s1_0', makeResponse('opt5', 5)], // score=100
    ]);
    const result = calculateOverallScore(sections, responses);
    expect(result.scoreBand).toBe('Leading');
  });

  it('informational section excluded from scoring', () => {
    // Informational sections have is_scored=false, so they won't appear in ScoredSection[]
    // This test confirms that an empty ScoredSection array produces score 0
    const result = calculateOverallScore([], new Map());
    expect(result.normalizedScore).toBe(0);
  });
});

// ============================================================
// getScoreBand
// ============================================================
describe('getScoreBand', () => {
  it('returns correct default band for boundary values', () => {
    expect(getScoreBand(0)).toBe('Reactive');
    expect(getScoreBand(39)).toBe('Reactive');
    expect(getScoreBand(40)).toBe('Developing');
    expect(getScoreBand(59)).toBe('Developing');
    expect(getScoreBand(60)).toBe('Established');
    expect(getScoreBand(74)).toBe('Established');
    expect(getScoreBand(75)).toBe('Strategic');
    expect(getScoreBand(89)).toBe('Strategic');
    expect(getScoreBand(90)).toBe('Leading');
    expect(getScoreBand(100)).toBe('Leading');
  });

  it('handles exact band boundaries', () => {
    expect(getScoreBand(39)).toBe('Reactive');
    expect(getScoreBand(40)).toBe('Developing');
    expect(getScoreBand(59)).toBe('Developing');
    expect(getScoreBand(60)).toBe('Established');
  });

  it('returns Unknown for gaps in custom bands', () => {
    const bands: ScoreBand[] = [
      { band_name: 'Low', min_threshold: 0, max_threshold: 30, display_order: 1 },
      { band_name: 'High', min_threshold: 50, max_threshold: 100, display_order: 2 },
    ];
    expect(getScoreBand(40, bands as unknown as AssessmentScoreBandRow[])).toBe('Unknown');
  });
});

// ============================================================
// roundForDisplay
// ============================================================
describe('roundForDisplay', () => {
  it('rounds to whole numbers', () => {
    expect(roundForDisplay(66.67)).toBe(67);
    expect(roundForDisplay(66.5)).toBe(67);
    expect(roundForDisplay(66.4)).toBe(66);
    expect(roundForDisplay(0)).toBe(0);
    expect(roundForDisplay(100)).toBe(100);
  });
});

// ============================================================
// validateAssessment
// ============================================================
describe('validateAssessment', () => {
  it('warns on empty sections', () => {
    const sections = [makeSectionWithQuestions('s1', [])];
    const warnings = validateAssessment(sections);
    expect(warnings.some((w) => w.message.includes('no questions'))).toBe(true);
    expect(warnings[0].level).toBe('warning');
  });

  it('errors on scored questions without score values', () => {
    const sections = [makeSectionWithQuestions('s1', [
      { id: 'q1', question_text: 'Test', is_scored: true, is_required: true, weight: 1, options: [{ id: 'o1', score_value: null, is_not_applicable: false }] },
    ])];
    const warnings = validateAssessment(sections);
    expect(warnings.some((w) => w.level === 'error' && w.message.includes('no score values'))).toBe(true);
  });

  it('warns on identical min and max scores', () => {
    const sections = [makeSectionWithQuestions('s1', [
      { id: 'q1', question_text: 'Test', is_scored: true, is_required: true, weight: 1, options: [
        { id: 'o1', score_value: 3, is_not_applicable: false },
        { id: 'o2', score_value: 3, is_not_applicable: false },
      ] },
    ])];
    const warnings = validateAssessment(sections);
    expect(warnings.some((w) => w.level === 'warning' && w.message.includes('identical minimum and maximum'))).toBe(true);
  });

  it('errors on required questions with no options', () => {
    const sections = [makeSectionWithQuestions('s1', [
      { id: 'q1', question_text: 'Test', is_scored: false, is_required: true, weight: 1, options: [] },
    ])];
    const warnings = validateAssessment(sections);
    expect(warnings.some((w) => w.level === 'error' && w.message.includes('no selectable'))).toBe(true);
  });

  it('warns on section weights not totaling 100', () => {
    const sections = [
      makeSectionWithQuestions('s1', [{ id: 'q1', question_text: 'Q1', is_scored: true, is_required: true, weight: 1, options: [{ id: 'o1', score_value: 5, is_not_applicable: false }] }], 30, true),
      makeSectionWithQuestions('s2', [{ id: 'q2', question_text: 'Q2', is_scored: true, is_required: true, weight: 1, options: [{ id: 'o2', score_value: 5, is_not_applicable: false }] }], 50, true),
    ];
    const warnings = validateAssessment(sections);
    expect(warnings.some((w) => w.level === 'warning' && w.message.includes('weights total'))).toBe(true);
  });
});

// ============================================================
// validateScoreBands
// ============================================================
describe('validateScoreBands', () => {
  it('detects overlapping bands', () => {
    const bands: ScoreBand[] = [
      { band_name: 'Low', min_threshold: 0, max_threshold: 50, display_order: 1 },
      { band_name: 'High', min_threshold: 40, max_threshold: 100, display_order: 2 },
    ];
    const warnings = validateScoreBands(bands);
    expect(warnings.some((w) => w.level === 'error' && w.message.includes('overlap'))).toBe(true);
  });

  it('detects gaps between bands', () => {
    const bands: ScoreBand[] = [
      { band_name: 'Low', min_threshold: 0, max_threshold: 30, display_order: 1 },
      { band_name: 'High', min_threshold: 50, max_threshold: 100, display_order: 2 },
    ];
    const warnings = validateScoreBands(bands);
    expect(warnings.some((w) => w.level === 'warning' && w.message.includes('Gap'))).toBe(true);
  });

  it('passes for valid contiguous bands', () => {
    const bands: ScoreBand[] = [
      { band_name: 'Low', min_threshold: 0, max_threshold: 49, display_order: 1 },
      { band_name: 'High', min_threshold: 50, max_threshold: 100, display_order: 2 },
    ];
    const warnings = validateScoreBands(bands);
    expect(warnings).toHaveLength(0);
  });

  it('returns no warnings for empty bands', () => {
    expect(validateScoreBands([])).toHaveLength(0);
  });
});

// ============================================================
// canShowRecommendations
// ============================================================
describe('canShowRecommendations', () => {
  it('returns true for Propel with recommendations enabled', () => {
    expect(canShowRecommendations('propel', true)).toBe(true);
  });

  it('returns false for Propel with recommendations disabled', () => {
    expect(canShowRecommendations('propel', false)).toBe(false);
  });

  it('returns false for broker regardless of recommendations flag', () => {
    expect(canShowRecommendations('broker', true)).toBe(false);
    expect(canShowRecommendations('broker', false)).toBe(false);
  });
});

// ============================================================
// shouldShowScoreBand
// ============================================================
describe('shouldShowScoreBand', () => {
  it('always shows bands for Propel assessments', () => {
    expect(shouldShowScoreBand('propel', false)).toBe(true);
    expect(shouldShowScoreBand('propel', true)).toBe(true);
  });

  it('shows bands for broker only when custom bands are configured', () => {
    expect(shouldShowScoreBand('broker', false)).toBe(false);
    expect(shouldShowScoreBand('broker', true)).toBe(true);
  });
});

// ============================================================
// DEFAULT_SCORE_BANDS
// ============================================================
describe('DEFAULT_SCORE_BANDS', () => {
  it('has 5 bands covering 0-100', () => {
    expect(DEFAULT_SCORE_BANDS).toHaveLength(5);
    expect(DEFAULT_SCORE_BANDS[0].min_threshold).toBe(0);
    expect(DEFAULT_SCORE_BANDS[4].max_threshold).toBe(100);
  });

  it('has bands in ascending order without gaps', () => {
    for (let i = 1; i < DEFAULT_SCORE_BANDS.length; i++) {
      expect(DEFAULT_SCORE_BANDS[i].min_threshold).toBeGreaterThan(DEFAULT_SCORE_BANDS[i - 1].max_threshold);
    }
  });
});

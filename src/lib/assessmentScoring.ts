import type {
  AssessmentSectionWithQuestions,
  AssessmentScoreBandRow,
} from '../lib/database.types';

// ============================================================
// Default score bands
// ============================================================

export type ScoreBand = {
  band_name: string;
  min_threshold: number;
  max_threshold: number;
  display_order: number;
};

export const DEFAULT_SCORE_BANDS: ScoreBand[] = [
  { band_name: 'Reactive', min_threshold: 0, max_threshold: 39, display_order: 1 },
  { band_name: 'Developing', min_threshold: 40, max_threshold: 59, display_order: 2 },
  { band_name: 'Established', min_threshold: 60, max_threshold: 74, display_order: 3 },
  { band_name: 'Strategic', min_threshold: 75, max_threshold: 89, display_order: 4 },
  { band_name: 'Leading', min_threshold: 90, max_threshold: 100, display_order: 5 },
];

// ============================================================
// Question type metadata
// ============================================================

export type QuestionTypeMeta = {
  value: string;
  label: string;
  category: 'scored' | 'unscored';
  hasOptions: boolean;
  defaultScored: boolean;
  description: string;
};

export const QUESTION_TYPES: QuestionTypeMeta[] = [
  { value: 'agreement5', label: '5-Point Agreement Scale', category: 'scored', hasOptions: true, defaultScored: true, description: 'Strongly Disagree → Strongly Agree' },
  { value: 'frequency5', label: '5-Point Frequency Scale', category: 'scored', hasOptions: true, defaultScored: true, description: 'Never → Always' },
  { value: 'maturity5', label: '5-Point Maturity Scale', category: 'scored', hasOptions: true, defaultScored: true, description: 'Initial → Optimized' },
  { value: 'numeric_rating', label: 'Numeric Rating Scale', category: 'scored', hasOptions: false, defaultScored: true, description: 'Numeric value within a range' },
  { value: 'yes_no', label: 'Yes / No', category: 'scored', hasOptions: true, defaultScored: true, description: 'Binary yes/no with optional scoring' },
  { value: 'single_select', label: 'Single Select', category: 'scored', hasOptions: true, defaultScored: true, description: 'Choose one from a list' },
  { value: 'multi_select', label: 'Multi-Select', category: 'scored', hasOptions: true, defaultScored: true, description: 'Choose multiple with configurable scoring' },
  { value: 'custom_scored', label: 'Custom Scored Options', category: 'scored', hasOptions: true, defaultScored: true, description: 'Custom options with assigned scores' },
  { value: 'short_text', label: 'Short Text', category: 'unscored', hasOptions: false, defaultScored: false, description: 'Single-line text input' },
  { value: 'long_text', label: 'Long Text', category: 'unscored', hasOptions: false, defaultScored: false, description: 'Multi-line text input' },
  { value: 'numeric_input', label: 'Numeric Input', category: 'unscored', hasOptions: false, defaultScored: false, description: 'Numeric value (not scored)' },
  { value: 'date', label: 'Date', category: 'unscored', hasOptions: false, defaultScored: false, description: 'Date picker' },
  { value: 'information', label: 'Informational Block', category: 'unscored', hasOptions: false, defaultScored: false, description: 'Display text without a response field' },
];

export function getQuestionTypeMeta(type: string): QuestionTypeMeta | undefined {
  return QUESTION_TYPES.find((t) => t.value === type);
}

export const SCORED_QUESTION_TYPES = QUESTION_TYPES.filter((t) => t.category === 'scored');
export const UNSCORED_QUESTION_TYPES = QUESTION_TYPES.filter((t) => t.category === 'unscored');

// ============================================================
// Default option sets for standard scales
// ============================================================

export type DefaultOption = {
  option_label: string;
  option_value: string;
  score_value: number;
  display_order: number;
};

export const AGREEMENT5_OPTIONS: DefaultOption[] = [
  { option_label: 'Strongly Disagree', option_value: 'strongly_disagree', score_value: 1, display_order: 0 },
  { option_label: 'Disagree', option_value: 'disagree', score_value: 2, display_order: 1 },
  { option_label: 'Neutral', option_value: 'neutral', score_value: 3, display_order: 2 },
  { option_label: 'Agree', option_value: 'agree', score_value: 4, display_order: 3 },
  { option_label: 'Strongly Agree', option_value: 'strongly_agree', score_value: 5, display_order: 4 },
];

export const FREQUENCY5_OPTIONS: DefaultOption[] = [
  { option_label: 'Never', option_value: 'never', score_value: 1, display_order: 0 },
  { option_label: 'Rarely', option_value: 'rarely', score_value: 2, display_order: 1 },
  { option_label: 'Sometimes', option_value: 'sometimes', score_value: 3, display_order: 2 },
  { option_label: 'Often', option_value: 'often', score_value: 4, display_order: 3 },
  { option_label: 'Always', option_value: 'always', score_value: 5, display_order: 4 },
];

export const MATURITY5_OPTIONS: DefaultOption[] = [
  { option_label: 'Initial', option_value: 'initial', score_value: 1, display_order: 0 },
  { option_label: 'Developing', option_value: 'developing', score_value: 2, display_order: 1 },
  { option_label: 'Defined', option_value: 'defined', score_value: 3, display_order: 2 },
  { option_label: 'Managed', option_value: 'managed', score_value: 4, display_order: 3 },
  { option_label: 'Optimized', option_value: 'optimized', score_value: 5, display_order: 4 },
];

export const YES_NO_OPTIONS: DefaultOption[] = [
  { option_label: 'Yes', option_value: 'yes', score_value: 1, display_order: 0 },
  { option_label: 'No', option_value: 'no', score_value: 0, display_order: 1 },
];

export function getDefaultOptionsForType(type: string): DefaultOption[] {
  switch (type) {
    case 'agreement5': return AGREEMENT5_OPTIONS;
    case 'frequency5': return FREQUENCY5_OPTIONS;
    case 'maturity5': return MATURITY5_OPTIONS;
    case 'yes_no': return YES_NO_OPTIONS;
    default: return [];
  }
}

// ============================================================
// Scoring engine (client-side preview)
// Server-side scoring is the source of truth via calculate_assessment_scores RPC.
// This client-side implementation mirrors the server logic for live preview.
// ============================================================

export type ScoredQuestion = {
  questionId: string;
  weight: number;
  reverseScored: boolean;
  options: Array<{ id: string; scoreValue: number | null; isNotApplicable: boolean }>;
};

export type ScoredSection = {
  sectionId: string;
  weight: number;
  questions: ScoredQuestion[];
};

export type QuestionScoreResult = {
  normalizedScore: number;
  rawScore: number;
  weight: number;
  answered: boolean;
  isNa: boolean;
};

export type SectionScoreResult = {
  sectionId: string;
  normalizedScore: number;
  rawScore: number;
  weight: number;
  answeredQuestionCount: number;
  possibleQuestionCount: number;
  questionScores: QuestionScoreResult[];
};

export type OverallScoreResult = {
  normalizedScore: number;
  scoreBand: string;
  sectionScores: SectionScoreResult[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value);
}

export function normalizeQuestionScore(
  rawScore: number,
  minPossible: number,
  maxPossible: number,
  reverseScored: boolean
): number {
  if (maxPossible === minPossible) return 0;
  let normalized = ((rawScore - minPossible) / (maxPossible - minPossible)) * 100;
  if (reverseScored) {
    normalized = 100 - normalized;
  }
  return clamp(normalized, 0, 100);
}

export function calculateSectionScore(
  section: ScoredSection,
  responses: Map<string, { selectedOptionId?: string | null; numericValue?: number | null; scoreValue?: number | null }>
): SectionScoreResult {
  let weightedSum = 0;
  let weightSum = 0;
  let answeredCount = 0;
  let possibleCount = 0;
  const questionScores: QuestionScoreResult[] = [];

  for (const q of section.questions) {
    possibleCount++;
    const response = responses.get(q.questionId);

    if (!response) {
      questionScores.push({
        normalizedScore: 0,
        rawScore: 0,
        weight: q.weight,
        answered: false,
        isNa: false,
      });
      continue;
    }

    // Check for N/A
    const selectedOption = q.options.find((o) => o.id === response.selectedOptionId);
    if (selectedOption?.isNotApplicable) {
      questionScores.push({
        normalizedScore: 0,
        rawScore: 0,
        weight: q.weight,
        answered: false,
        isNa: true,
      });
      continue;
    }

    answeredCount++;

    const rawScore = response.scoreValue ?? selectedOption?.scoreValue ?? 0;
    const minScore = Math.min(...q.options.filter((o) => !o.isNotApplicable).map((o) => o.scoreValue ?? 0));
    const maxScore = Math.max(...q.options.filter((o) => !o.isNotApplicable).map((o) => o.scoreValue ?? 0));

    const normalized = normalizeQuestionScore(rawScore, minScore, maxScore, q.reverseScored);

    weightedSum += normalized * q.weight;
    weightSum += q.weight;

    questionScores.push({
      normalizedScore: normalized,
      rawScore,
      weight: q.weight,
      answered: true,
      isNa: false,
    });
  }

  const sectionNorm = weightSum > 0 ? weightedSum / weightSum : 0;

  return {
    sectionId: section.sectionId,
    normalizedScore: clamp(sectionNorm, 0, 100),
    rawScore: clamp(sectionNorm, 0, 100),
    weight: section.weight,
    answeredQuestionCount: answeredCount,
    possibleQuestionCount: possibleCount,
    questionScores,
  };
}

export function calculateOverallScore(
  sections: ScoredSection[],
  responses: Map<string, { selectedOptionId?: string | null; numericValue?: number | null; scoreValue?: number | null }>,
  customBands?: AssessmentScoreBandRow[]
): OverallScoreResult {
  const sectionResults: SectionScoreResult[] = [];
  let overallWeightedSum = 0;
  let overallWeightSum = 0;

  for (const section of sections) {
    const result = calculateSectionScore(section, responses);
    sectionResults.push(result);
    overallWeightedSum += result.normalizedScore * section.weight;
    overallWeightSum += section.weight;
  }

  const overallNorm = overallWeightSum > 0 ? overallWeightedSum / overallWeightSum : 0;
  const clampedNorm = clamp(overallNorm, 0, 100);
  const scoreBand = getScoreBand(clampedNorm, customBands);

  return {
    normalizedScore: clampedNorm,
    scoreBand,
    sectionScores: sectionResults,
  };
}

export function getScoreBand(score: number, customBands?: AssessmentScoreBandRow[]): string {
  const bands = customBands && customBands.length > 0
    ? customBands.map((b) => ({ band_name: b.band_name, min_threshold: Number(b.min_threshold), max_threshold: Number(b.max_threshold), display_order: b.display_order }))
    : DEFAULT_SCORE_BANDS;

  for (const band of bands) {
    if (score >= band.min_threshold && score <= band.max_threshold) {
      return band.band_name;
    }
  }
  return 'Unknown';
}

export function roundForDisplay(score: number): number {
  return round(score);
}

// ============================================================
// Validation
// ============================================================

export type ValidationWarning = {
  level: 'error' | 'warning';
  message: string;
  sectionId?: string;
  questionId?: string;
};

export function validateAssessment(sections: AssessmentSectionWithQuestions[]): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Empty sections
  for (const section of sections) {
    if (section.questions.length === 0) {
      warnings.push({
        level: 'warning',
        message: `Section "${section.title}" has no questions.`,
        sectionId: section.id,
      });
    }
  }

  // Scored questions without score values
  for (const section of sections) {
    for (const question of section.questions) {
      if (question.is_scored && question.options.length > 0) {
        const hasScoreValues = question.options.some((o) => o.score_value !== null);
        if (!hasScoreValues) {
          warnings.push({
            level: 'error',
            message: `Scored question "${question.question_text}" has no score values assigned to options.`,
            questionId: question.id,
          });
        }
      }

      // Questions with identical min and max score
      if (question.is_scored && question.options.length > 1) {
        const scores = question.options.filter((o) => !o.is_not_applicable && o.score_value !== null).map((o) => o.score_value as number);
        if (scores.length > 1) {
          const min = Math.min(...scores);
          const max = Math.max(...scores);
          if (min === max) {
            warnings.push({
              level: 'warning',
              message: `Question "${question.question_text}" has identical minimum and maximum scores — no scoring range.`,
              questionId: question.id,
            });
          }
        }
      }

      // Required questions with no options for option-based types
      const meta = getQuestionTypeMeta(question.question_type);
      if (meta?.hasOptions && question.is_required && question.options.length === 0) {
        warnings.push({
          level: 'error',
          message: `Required question "${question.question_text}" has no selectable options.`,
          questionId: question.id,
        });
      }
    }
  }

  // Section weights don't total 100
  const scoredSections = sections.filter((s) => s.is_scored);
  if (scoredSections.length > 0) {
    const totalWeight = scoredSections.reduce((sum, s) => sum + s.weight, 0);
    if (totalWeight !== 100) {
      warnings.push({
        level: 'warning',
        message: `Section weights total ${totalWeight}, not 100. Use "Normalize weights" to auto-balance.`,
      });
    }
  }

  return warnings;
}

export function validateScoreBands(bands: ScoreBand[]): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  if (bands.length === 0) return warnings;

  // Check for overlapping bands
  const sorted = [...bands].sort((a, b) => a.min_threshold - b.min_threshold);
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].max_threshold >= sorted[i + 1].min_threshold) {
      warnings.push({
        level: 'error',
        message: `Score bands "${sorted[i].band_name}" and "${sorted[i + 1].band_name}" overlap.`,
      });
    }
    // Check for gaps
    if (sorted[i].max_threshold + 1 < sorted[i + 1].min_threshold) {
      warnings.push({
        level: 'warning',
        message: `Gap between "${sorted[i].band_name}" (max ${sorted[i].max_threshold}) and "${sorted[i + 1].band_name}" (min ${sorted[i + 1].min_threshold}).`,
      });
    }
  }

  return warnings;
}

// ============================================================
// Recommendation eligibility
// ============================================================

export function canShowRecommendations(
  ownerType: 'propel' | 'broker',
  recommendationsEnabled: boolean
): boolean {
  return ownerType === 'propel' && recommendationsEnabled;
}

export const CUSTOM_ASSESSMENT_DISCLAIMER =
  'Custom assessment reporting summarizes responses and scores. Automated Propel recommendations are not included.';

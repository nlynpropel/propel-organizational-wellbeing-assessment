import type {
  AssessmentQuestionType,
  SavedResponse,
} from '../../lib/database.types';

export type QuestionOption = {
  id: string;
  option_label: string;
  option_value: string;
  display_order: number;
  is_not_applicable: boolean;
};

export type NumericRatingConfig = {
  min_value: number;
  max_value: number;
  step_value: number;
  min_label: string | null;
  max_label: string | null;
};

export type QuestionData = {
  id: string;
  question_text: string;
  help_text: string | null;
  question_type: AssessmentQuestionType;
  is_required: boolean;
  options: QuestionOption[];
  numeric_rating?: NumericRatingConfig;
};

export type ResponseUpdate = {
  question_id: string;
  selected_option_id: string | null;
  text_value: string | null;
  numeric_value: number | null;
  boolean_value: boolean | null;
};

export function getSavedResponse(
  responses: SavedResponse[],
  questionId: string
): SavedResponse | undefined {
  return responses.find((r) => r.question_id === questionId);
}

export function isAnswered(question: QuestionData, response: SavedResponse | undefined): boolean {
  if (question.question_type === 'information') return true;
  if (!response) return false;
  if (response.selected_option_id) return true;
  if (response.text_value !== null && response.text_value.trim() !== '') return true;
  if (response.numeric_value !== null) return true;
  if (response.boolean_value !== null) return true;
  return false;
}

export const DEFAULT_NUMERIC_RATING: NumericRatingConfig = {
  min_value: 1,
  max_value: 10,
  step_value: 1,
  min_label: null,
  max_label: null,
};

export function getNumericRatingConfig(question: QuestionData): NumericRatingConfig {
  return question.numeric_rating ?? DEFAULT_NUMERIC_RATING;
}

export function getNumericRatingSteps(config: NumericRatingConfig): number[] {
  const steps: number[] = [];
  for (let v = config.min_value; v <= config.max_value; v += config.step_value) {
    steps.push(Math.round(v * 100) / 100);
  }
  return steps;
}

export function validateNumericRatingConfig(config: NumericRatingConfig): string[] {
  const errors: string[] = [];
  if (!(config.max_value > config.min_value)) {
    errors.push('Maximum value must be greater than minimum value.');
  }
  if (!(config.step_value > 0)) {
    errors.push('Step value must be greater than 0.');
  }
  return errors;
}

export function validateNumericRatingValue(config: NumericRatingConfig, value: number): string | null {
  if (value < config.min_value || value > config.max_value) {
    return `Value must be between ${config.min_value} and ${config.max_value}.`;
  }
  const offset = value - config.min_value;
  if (config.step_value > 0 && Math.abs((offset / config.step_value) - Math.round(offset / config.step_value)) > 1e-9) {
    return `Value must align to step interval of ${config.step_value}.`;
  }
  return null;
}

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

export type QuestionData = {
  id: string;
  question_text: string;
  help_text: string | null;
  question_type: AssessmentQuestionType;
  is_required: boolean;
  options: QuestionOption[];
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

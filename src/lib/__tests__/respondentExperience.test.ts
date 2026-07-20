import { describe, it, expect } from 'vitest';
import {
  getSavedResponse,
  isAnswered,
  type QuestionData,
} from '../../components/respondent/questionTypes';
import type { SavedResponse } from '../database.types';

const makeQuestion = (overrides: Partial<QuestionData> = {}): QuestionData => ({
  id: 'q1',
  question_text: 'Test question',
  help_text: null,
  question_type: 'agreement5',
  is_required: true,
  options: [
    { id: 'o1', option_label: 'Strongly Disagree', option_value: '1', display_order: 1, is_not_applicable: false },
    { id: 'o2', option_label: 'Strongly Agree', option_value: '5', display_order: 5, is_not_applicable: false },
  ],
  ...overrides,
});

describe('getSavedResponse', () => {
  it('finds a response by question_id', () => {
    const responses: SavedResponse[] = [
      { question_id: 'q1', selected_option_id: 'o1', text_value: null, numeric_value: null, boolean_value: null },
    ];
    expect(getSavedResponse(responses, 'q1')).toBeDefined();
    expect(getSavedResponse(responses, 'q1')?.selected_option_id).toBe('o1');
  });

  it('returns undefined when no response exists', () => {
    expect(getSavedResponse([], 'q1')).toBeUndefined();
    expect(getSavedResponse(
      [{ question_id: 'q2', selected_option_id: null, text_value: null, numeric_value: null, boolean_value: null }],
      'q1'
    )).toBeUndefined();
  });
});

describe('isAnswered', () => {
  it('returns false when no response exists', () => {
    expect(isAnswered(makeQuestion(), undefined)).toBe(false);
  });

  it('returns true for information questions regardless of response', () => {
    expect(isAnswered(makeQuestion({ question_type: 'information', is_required: false }), undefined)).toBe(true);
  });

  it('returns true when selected_option_id is set', () => {
    const response: SavedResponse = { question_id: 'q1', selected_option_id: 'o1', text_value: null, numeric_value: null, boolean_value: null };
    expect(isAnswered(makeQuestion(), response)).toBe(true);
  });

  it('returns true when text_value is non-empty', () => {
    const response: SavedResponse = { question_id: 'q1', selected_option_id: null, text_value: 'hello', numeric_value: null, boolean_value: null };
    expect(isAnswered(makeQuestion({ question_type: 'short_text' }), response)).toBe(true);
  });

  it('returns false when text_value is empty string', () => {
    const response: SavedResponse = { question_id: 'q1', selected_option_id: null, text_value: '', numeric_value: null, boolean_value: null };
    expect(isAnswered(makeQuestion({ question_type: 'short_text' }), response)).toBe(false);
  });

  it('returns false when text_value is whitespace only', () => {
    const response: SavedResponse = { question_id: 'q1', selected_option_id: null, text_value: '   ', numeric_value: null, boolean_value: null };
    expect(isAnswered(makeQuestion({ question_type: 'short_text' }), response)).toBe(false);
  });

  it('returns true when numeric_value is set', () => {
    const response: SavedResponse = { question_id: 'q1', selected_option_id: null, text_value: null, numeric_value: 7, boolean_value: null };
    expect(isAnswered(makeQuestion({ question_type: 'numeric_rating' }), response)).toBe(true);
  });

  it('returns true when boolean_value is set to true', () => {
    const response: SavedResponse = { question_id: 'q1', selected_option_id: null, text_value: null, numeric_value: null, boolean_value: true };
    expect(isAnswered(makeQuestion({ question_type: 'yes_no' }), response)).toBe(true);
  });

  it('returns true when boolean_value is set to false', () => {
    const response: SavedResponse = { question_id: 'q1', selected_option_id: null, text_value: null, numeric_value: null, boolean_value: false };
    expect(isAnswered(makeQuestion({ question_type: 'yes_no' }), response)).toBe(true);
  });

  it('returns false when all response fields are null', () => {
    const response: SavedResponse = { question_id: 'q1', selected_option_id: null, text_value: null, numeric_value: null, boolean_value: null };
    expect(isAnswered(makeQuestion(), response)).toBe(false);
  });
});

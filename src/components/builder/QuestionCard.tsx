import { ChevronUp, ChevronDown, Trash2, Copy } from 'lucide-react';
import QuestionTypeSelector from './QuestionTypeSelector';
import AnswerOptionEditor, { type DraftOption } from './AnswerOptionEditor';
import ScoringToggle from './ScoringToggle';
import WeightInput from './WeightInput';
import ReverseScoringToggle from './ReverseScoringToggle';
import NotApplicableToggle from './NotApplicableToggle';
import NumericRatingConfigEditor from './NumericRatingConfigEditor';
import type { AssessmentQuestionType } from '../../lib/database.types';
import { getDefaultOptionsForType } from '../../lib/assessmentScoring';

export type DraftQuestion = {
  id?: string;
  question_text: string;
  help_text: string;
  question_type: AssessmentQuestionType;
  display_order: number;
  is_required: boolean;
  is_scored: boolean;
  weight: number;
  reverse_scored: boolean;
  reporting_label: string;
  scoring_dimension: string;
  allow_not_applicable: boolean;
  options: DraftOption[];
  sectionId?: string;
  numeric_rating_min_value: number;
  numeric_rating_max_value: number;
  numeric_rating_step_value: number;
  numeric_rating_min_label: string;
  numeric_rating_max_label: string;
};

export default function QuestionCard({
  question,
  sectionTitle,
  onChange,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  disabled,
}: {
  question: DraftQuestion;
  sectionTitle: string;
  onChange: (q: DraftQuestion) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  disabled?: boolean;
}) {
  const update = (updates: Partial<DraftQuestion>) => {
    onChange({ ...question, ...updates });
  };

  const handleTypeChange = (type: AssessmentQuestionType) => {
    const defaults = getDefaultOptionsForType(type);
    const meta = getDefaultOptionsForType(type);
    update({
      question_type: type,
      is_scored: ['agreement5', 'frequency5', 'maturity5', 'numeric_rating', 'yes_no', 'single_select', 'multi_select', 'custom_scored'].includes(type),
      options: defaults.length > 0 ? defaults.map((d) => ({
        option_label: d.option_label,
        option_value: d.option_value,
        score_value: d.score_value,
        display_order: d.display_order,
        is_not_applicable: false,
      })) : [],
    });
    void meta;
  };

  const hasOptions = ['agreement5', 'frequency5', 'maturity5', 'yes_no', 'single_select', 'multi_select', 'custom_scored'].includes(question.question_type);

  return (
    <div className="rounded-md border border-neutral-border bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-muted uppercase tracking-wide">{sectionTitle}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={disabled || !canMoveUp}
            className="p-1 text-neutral-muted hover:text-navy disabled:opacity-30"
            aria-label="Move question up"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={disabled || !canMoveDown}
            className="p-1 text-neutral-muted hover:text-navy disabled:opacity-30"
            aria-label="Move question down"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            disabled={disabled}
            className="p-1 text-neutral-muted hover:text-navy disabled:opacity-30"
            aria-label="Duplicate question"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            className="p-1 text-neutral-muted hover:text-red disabled:opacity-30"
            aria-label="Delete question"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-navy mb-1.5">Question text</label>
        <textarea
          value={question.question_text}
          onChange={(e) => update({ question_text: e.target.value })}
          placeholder="Enter your question"
          disabled={disabled}
          rows={2}
          className="w-full px-3 py-2 rounded-sm border border-neutral-border bg-white text-navy focus:outline-none focus:border-green focus:ring-1 focus:ring-green/20"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-navy mb-1.5">Help text (optional)</label>
        <input
          type="text"
          value={question.help_text}
          onChange={(e) => update({ help_text: e.target.value })}
          placeholder="Additional guidance for the respondent"
          disabled={disabled}
          className="w-full px-3 py-2 rounded-sm border border-neutral-border bg-white text-navy text-sm focus:outline-none focus:border-green focus:ring-1 focus:ring-green/20"
        />
      </div>

      <QuestionTypeSelector
        value={question.question_type}
        onChange={handleTypeChange}
        disabled={disabled}
      />

      {hasOptions && (
        <AnswerOptionEditor
          options={question.options}
          onChange={(options) => update({ options })}
          isScored={question.is_scored}
          disabled={disabled}
        />
      )}

      {question.question_type === 'numeric_rating' && (
        <NumericRatingConfigEditor
          minValue={question.numeric_rating_min_value}
          maxValue={question.numeric_rating_max_value}
          stepValue={question.numeric_rating_step_value}
          minLabel={question.numeric_rating_min_label}
          maxLabel={question.numeric_rating_max_label}
          onChange={(cfg) => update(cfg)}
          disabled={disabled}
        />
      )}

      <div className="flex flex-wrap items-end gap-4 pt-2 border-t border-neutral-border-soft">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={question.is_required}
            onChange={(e) => update({ is_required: e.target.checked })}
            disabled={disabled}
            className="rounded"
          />
          <span className="text-sm text-navy">Required</span>
        </label>

        <ScoringToggle
          checked={question.is_scored}
          onChange={(v) => update({ is_scored: v })}
          disabled={disabled}
        />

        <WeightInput
          value={question.weight}
          onChange={(v) => update({ weight: v })}
          disabled={disabled || !question.is_scored}
        />

        {question.is_scored && (
          <ReverseScoringToggle
            checked={question.reverse_scored}
            onChange={(v) => update({ reverse_scored: v })}
            disabled={disabled}
          />
        )}

        {hasOptions && (
          <NotApplicableToggle
            checked={question.allow_not_applicable}
            onChange={(v) => update({ allow_not_applicable: v })}
            disabled={disabled}
          />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-muted mb-1">Reporting label (optional)</label>
          <input
            type="text"
            value={question.reporting_label}
            onChange={(e) => update({ reporting_label: e.target.value })}
            placeholder="e.g. Leadership Score"
            disabled={disabled}
            className="w-full px-3 py-1.5 rounded-sm border border-neutral-border bg-white text-navy text-sm focus:outline-none focus:border-green focus:ring-1 focus:ring-green/20"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-muted mb-1">Scoring dimension (optional)</label>
          <input
            type="text"
            value={question.scoring_dimension}
            onChange={(e) => update({ scoring_dimension: e.target.value })}
            placeholder="e.g. culture"
            disabled={disabled}
            className="w-full px-3 py-1.5 rounded-sm border border-neutral-border bg-white text-navy text-sm focus:outline-none focus:border-green focus:ring-1 focus:ring-green/20"
          />
        </div>
      </div>
    </div>
  );
}

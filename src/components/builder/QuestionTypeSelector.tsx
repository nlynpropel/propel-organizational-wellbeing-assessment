import type { AssessmentQuestionType } from '../../lib/database.types';
import { QUESTION_TYPES, SCORED_QUESTION_TYPES, UNSCORED_QUESTION_TYPES } from '../../lib/assessmentScoring';

export default function QuestionTypeSelector({
  value,
  onChange,
  disabled,
}: {
  value: AssessmentQuestionType;
  onChange: (type: AssessmentQuestionType) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-navy mb-1.5">Question type</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as AssessmentQuestionType)}
        disabled={disabled}
        className="w-full px-3 py-2 rounded-sm border border-neutral-border bg-white text-navy focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20 transition text-sm disabled:opacity-60"
      >
        <optgroup label="Scored">
          {SCORED_QUESTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </optgroup>
        <optgroup label="Unscored">
          {UNSCORED_QUESTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </optgroup>
      </select>
      {QUESTION_TYPES.find((t) => t.value === value) && (
        <p className="text-xs text-neutral-muted mt-1">
          {QUESTION_TYPES.find((t) => t.value === value)?.description}
        </p>
      )}
    </div>
  );
}

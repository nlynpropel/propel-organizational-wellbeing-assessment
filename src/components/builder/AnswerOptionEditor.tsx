import { Plus, Trash2, GripVertical } from 'lucide-react';
import type { AssessmentQuestionOptionRow } from '../../lib/database.types';

export type DraftOption = {
  id?: string;
  option_label: string;
  option_value: string;
  score_value: number | null;
  display_order: number;
  is_not_applicable: boolean;
};

export default function AnswerOptionEditor({
  options,
  onChange,
  isScored,
  disabled,
}: {
  options: DraftOption[];
  onChange: (options: DraftOption[]) => void;
  isScored: boolean;
  disabled?: boolean;
}) {
  const addOption = () => {
    const nextOrder = options.length > 0 ? Math.max(...options.map((o) => o.display_order)) + 1 : 0;
    onChange([...options, {
      option_label: '',
      option_value: '',
      score_value: isScored ? 0 : null,
      display_order: nextOrder,
      is_not_applicable: false,
    }]);
  };

  const updateOption = (index: number, updates: Partial<DraftOption>) => {
    onChange(options.map((o, i) => i === index ? { ...o, ...updates } : o));
  };

  const removeOption = (index: number) => {
    onChange(options.filter((_, i) => i !== index));
  };

  const moveOption = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= options.length) return;
    const reordered = [...options];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    onChange(reordered.map((o, i) => ({ ...o, display_order: i })));
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-navy">Answer options</label>
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => moveOption(i, -1)}
              disabled={disabled || i === 0}
              className="text-neutral-muted hover:text-navy disabled:opacity-30"
              aria-label="Move up"
            >
              <GripVertical className="w-4 h-4 rotate-180" />
            </button>
            <button
              type="button"
              onClick={() => moveOption(i, 1)}
              disabled={disabled || i === options.length - 1}
              className="text-neutral-muted hover:text-navy disabled:opacity-30"
              aria-label="Move down"
            >
              <GripVertical className="w-4 h-4" />
            </button>
          </div>
          <input
            type="text"
            value={opt.option_label}
            onChange={(e) => updateOption(i, { option_label: e.target.value, option_value: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
            placeholder="Option label"
            disabled={disabled}
            className="flex-1 px-3 py-1.5 rounded-sm border border-neutral-border bg-white text-navy text-sm focus:outline-none focus:border-green focus:ring-1 focus:ring-green/20"
          />
          {isScored && (
            <input
              type="number"
              value={opt.score_value ?? ''}
              onChange={(e) => updateOption(i, { score_value: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="Score"
              disabled={disabled}
              className="w-20 px-2 py-1.5 rounded-sm border border-neutral-border bg-white text-navy text-sm focus:outline-none focus:border-green focus:ring-1 focus:ring-green/20"
              aria-label="Score value"
            />
          )}
          <label className="flex items-center gap-1 text-xs text-neutral-muted whitespace-nowrap" title="Mark as Not Applicable">
            <input
              type="checkbox"
              checked={opt.is_not_applicable}
              onChange={(e) => updateOption(i, { is_not_applicable: e.target.checked })}
              disabled={disabled}
              className="rounded"
            />
            N/A
          </label>
          <button
            type="button"
            onClick={() => removeOption(i)}
            disabled={disabled}
            className="p-1 text-neutral-muted hover:text-red disabled:opacity-30"
            aria-label="Remove option"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addOption}
        disabled={disabled}
        className="flex items-center gap-1.5 text-sm text-green-dark hover:text-green font-medium disabled:opacity-60"
      >
        <Plus className="w-4 h-4" />
        Add option
      </button>
    </div>
  );
}

export type { AssessmentQuestionOptionRow };

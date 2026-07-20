import type { NumericRatingConfig } from '../../components/respondent/questionTypes';
import { validateNumericRatingConfig } from '../../components/respondent/questionTypes';

export default function NumericRatingConfigEditor({
  minValue,
  maxValue,
  stepValue,
  minLabel,
  maxLabel,
  onChange,
  disabled,
}: {
  minValue: number;
  maxValue: number;
  stepValue: number;
  minLabel: string;
  maxLabel: string;
  onChange: (cfg: Partial<NumericRatingConfig>) => void;
  disabled?: boolean;
}) {
  const config: NumericRatingConfig = {
    min_value: minValue,
    max_value: maxValue,
    step_value: stepValue,
    min_label: minLabel || null,
    max_label: maxLabel || null,
  };
  const errors = validateNumericRatingConfig(config);

  return (
    <div className="rounded-md border border-neutral-border bg-neutral-bg/30 p-4 space-y-3">
      <p className="text-xs font-medium text-neutral-muted uppercase tracking-wide">
        Numeric Rating Range
      </p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Min value</label>
          <input
            type="number"
            value={minValue}
            disabled={disabled}
            onChange={(e) => onChange({ min_value: Number(e.target.value) })}
            className="w-full px-2 py-1.5 rounded-sm border border-neutral-border bg-white text-sm text-navy focus:outline-none focus:border-green focus:ring-1 focus:ring-green/20 disabled:opacity-60"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Max value</label>
          <input
            type="number"
            value={maxValue}
            disabled={disabled}
            onChange={(e) => onChange({ max_value: Number(e.target.value) })}
            className="w-full px-2 py-1.5 rounded-sm border border-neutral-border bg-white text-sm text-navy focus:outline-none focus:border-green focus:ring-1 focus:ring-green/20 disabled:opacity-60"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Step</label>
          <input
            type="number"
            value={stepValue}
            disabled={disabled}
            step="0.5"
            onChange={(e) => onChange({ step_value: Number(e.target.value) })}
            className="w-full px-2 py-1.5 rounded-sm border border-neutral-border bg-white text-sm text-navy focus:outline-none focus:border-green focus:ring-1 focus:ring-green/20 disabled:opacity-60"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Min label (optional)</label>
          <input
            type="text"
            value={minLabel}
            disabled={disabled}
            placeholder="e.g. Low"
            onChange={(e) => onChange({ min_label: e.target.value || null })}
            className="w-full px-2 py-1.5 rounded-sm border border-neutral-border bg-white text-sm text-navy placeholder:text-neutral-muted focus:outline-none focus:border-green focus:ring-1 focus:ring-green/20 disabled:opacity-60"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Max label (optional)</label>
          <input
            type="text"
            value={maxLabel}
            disabled={disabled}
            placeholder="e.g. High"
            onChange={(e) => onChange({ max_label: e.target.value || null })}
            className="w-full px-2 py-1.5 rounded-sm border border-neutral-border bg-white text-sm text-navy placeholder:text-neutral-muted focus:outline-none focus:border-green focus:ring-1 focus:ring-green/20 disabled:opacity-60"
          />
        </div>
      </div>
      {errors.length > 0 && (
        <div className="space-y-1">
          {errors.map((err, i) => (
            <p key={i} className="text-xs text-red">{err}</p>
          ))}
        </div>
      )}
    </div>
  );
}

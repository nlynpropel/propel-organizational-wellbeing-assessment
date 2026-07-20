import { CheckCircle2, Circle, AlertTriangle } from 'lucide-react';
import type { ValidationWarning } from '../../lib/assessmentScoring';

export type ReadinessItem = {
  label: string;
  done: boolean;
};

export default function AssessmentReadinessChecklist({
  items,
  warnings,
}: {
  items: ReadinessItem[];
  warnings: ValidationWarning[];
}) {
  const errors = warnings.filter((w) => w.level === 'error');
  const allDone = items.every((i) => i.done) && errors.length === 0;

  return (
    <div className="space-y-4">
      <div className={`rounded-md border p-4 ${allDone ? 'border-green/30 bg-green-tint' : 'border-neutral-border bg-neutral-bg/30'}`}>
        <div className="flex items-center gap-2 mb-3">
          {allDone ? (
            <CheckCircle2 className="w-5 h-5 text-green-dark" />
          ) : (
            <Circle className="w-5 h-5 text-neutral-muted" />
          )}
          <h4 className="font-display text-sm font-semibold text-navy">
            {allDone ? 'Ready to publish' : 'Assessment not ready'}
          </h4>
        </div>
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              {item.done ? (
                <CheckCircle2 className="w-4 h-4 text-green-dark shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-neutral-muted shrink-0" />
              )}
              <span className={item.done ? 'text-navy' : 'text-neutral-muted'}>{item.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {warnings.length > 0 && (
        <div className="space-y-2">
          {errors.map((w, i) => (
            <div key={`err-${i}`} className="flex items-start gap-2 rounded-md border border-red/20 bg-red-tint px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-red shrink-0 mt-0.5" />
              <p className="text-sm text-red">{w.message}</p>
            </div>
          ))}
          {warnings.filter((w) => w.level === 'warning').map((w, i) => (
            <div key={`warn-${i}`} className="flex items-start gap-2 rounded-md border border-orange/20 bg-orange-tint px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-orange shrink-0 mt-0.5" />
              <p className="text-sm text-orange">{w.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

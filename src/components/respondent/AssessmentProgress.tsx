export default function AssessmentProgress({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label?: string;
}) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-neutral-muted uppercase tracking-wide">
          {label || `Section ${current} of ${total}`}
        </span>
        <span className="text-xs font-medium text-neutral-secondary">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-neutral-border overflow-hidden">
        <div
          className="h-full bg-green transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

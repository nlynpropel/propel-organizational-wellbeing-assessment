import { scoreColor, scorePositionPercent } from '../../lib/scores';

export default function ScoreBar({
  score,
  max = 100,
  label,
  showValue = true,
  size = 'md',
  className = '',
}: {
  score: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const pct = scorePositionPercent((score / max) * 100);
  const color = scoreColor((score / max) * 100);
  const barHeight = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2';

  return (
    <div className={className}>
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm text-neutral-secondary">{label}</span>
          {showValue && (
            <span className="font-mono text-sm font-bold text-navy tabular-nums">
              {Math.round(score)}
              <span className="text-neutral-muted font-normal text-xs">/{max}</span>
            </span>
          )}
        </div>
      )}
      <div className={`w-full bg-neutral-bg rounded-full overflow-hidden ${barHeight}`}>
        <div
          className={`h-full rounded-full transition-all duration-500`}
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      {!label && showValue && (
        <div className="font-mono text-sm font-bold text-navy tabular-nums mt-1">
          {Math.round(score)}
          <span className="text-neutral-muted font-normal text-xs">/{max}</span>
        </div>
      )}
    </div>
  );
}

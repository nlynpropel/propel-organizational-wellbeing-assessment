import { maturityClass, maturityBadgeVariant, MATURITY_BANDS } from '../../lib/scores';
import Badge from './Badge';

export default function OpportunitySpectrum({ score }: { score: number }) {
  const cls = maturityClass(score);
  const variant = maturityBadgeVariant(cls);

  // Band boundaries for markers (as percentages)
  const bands = MATURITY_BANDS;
  const markerPct = Math.max(0, Math.min(100, score));

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <span className="eyebrow block mb-1">Overall Opportunity Index</span>
          <div className="flex items-baseline gap-3">
            <span className="font-mono font-bold text-5xl text-navy tabular-nums">{score}</span>
            <span className="text-neutral-muted text-sm font-medium">/ 100</span>
          </div>
        </div>
        <Badge variant={variant} className="text-sm px-3 py-1">
          {cls}
        </Badge>
      </div>

      <div className="relative h-3 rounded-full overflow-hidden bg-neutral-bg mt-4">
        <div
          className="absolute inset-0 flex"
          style={{
            background:
              'linear-gradient(90deg, #c23b2f 0%, #c23b2f 39%, #a9cd76 40%, #8bc64e 75%, #6ea83c 100%)',
          }}
        />
        {/* Band dividers */}
        {bands.slice(0, -1).map((b) => (
          <div
            key={b.label}
            className="absolute top-0 bottom-0 w-px bg-white/70"
            style={{ left: `${b.max}%` }}
          />
        ))}
        {/* Score marker */}
        <div
          className="absolute -top-1 -bottom-1 w-1 bg-navy-deep rounded-full shadow-md ring-2 ring-white"
          style={{ left: `calc(${markerPct}% - 2px)` }}
        />
      </div>

      <div className="flex justify-between mt-2 text-[10px] font-semibold text-neutral-muted">
        {bands.map((b) => (
          <span key={b.label}>{b.label}</span>
        ))}
      </div>
    </div>
  );
}

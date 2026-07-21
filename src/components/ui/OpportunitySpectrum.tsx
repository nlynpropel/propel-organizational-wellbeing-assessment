import { MATURITY_BANDS, maturityColor } from '../../lib/scores';
import type { AssessmentScoreBandRow } from '../../lib/database.types';

type Props = {
  score: number;
  scoreBandLabel: string;
  bands: AssessmentScoreBandRow[];
};

export default function OpportunitySpectrum({ score, scoreBandLabel, bands }: Props) {
  const zoneColors = MATURITY_BANDS.map((b) => maturityColor(b.label));
  const markerPct = Math.max(0, Math.min(100, score));

  const bandLabels = bands.length > 0
    ? bands.map((b) => b.band_name)
    : MATURITY_BANDS.map((b) => b.label);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm font-medium text-white/80">Overall Opportunity Index</span>
        <Badge variant="custom" className="text-sm px-3 py-1 bg-white/10 text-white border-white/20">
          {scoreBandLabel}
        </Badge>
      </div>
      <div className="flex items-baseline gap-2 mb-4">
        <span className="font-display font-bold text-5xl text-white tabular-nums">{Math.round(score)}</span>
        <span className="text-white/50 text-sm font-medium">/ 100</span>
      </div>

      <div className="relative h-3 rounded-full overflow-hidden mt-4">
        <div className="absolute inset-0 flex">
          {zoneColors.map((color, i) => (
            <div
              key={i}
              className="flex-1"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <div
          className="absolute -top-1 -bottom-1 w-1 bg-white rounded-full shadow-md ring-2 ring-navy-deep"
          style={{ left: `calc(${markerPct}% - 2px)` }}
        />
      </div>

      <div className="flex justify-between mt-2 text-[10px] font-semibold text-white/60">
        {bandLabels.map((label, i) => (
          <span key={i} className="text-center flex-1">{label}</span>
        ))}
      </div>
    </div>
  );
}

function Badge({ children, className = '' }: { children: React.ReactNode; variant?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold tracking-wide ${className}`}>
      {children}
    </span>
  );
}

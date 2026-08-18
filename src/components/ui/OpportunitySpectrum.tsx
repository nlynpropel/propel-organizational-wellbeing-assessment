import { MATURITY_BANDS, maturityColor } from '../../lib/scores';
import type { AssessmentScoreBandRow } from '../../lib/database.types';

type Props = {
  score: number;
  scoreBandLabel: string;
  bands: AssessmentScoreBandRow[];
};

type DisplayBand = {
  label: string;
  min: number;
  max: number;
  width: number;
};

function buildDisplayBands(bands: AssessmentScoreBandRow[]): DisplayBand[] {
  if (bands.length > 0) {
    const sorted = [...bands].sort(
      (a, b) => Number(a.min_threshold) - Number(b.min_threshold),
    );

    return sorted.map((band, index) => {
      const min = Math.max(0, Math.min(100, Number(band.min_threshold)));
      const nextMin = index < sorted.length - 1
        ? Math.max(0, Math.min(100, Number(sorted[index + 1].min_threshold)))
        : 100;
      const width = Math.max(0, nextMin - min);

      return {
        label: band.band_name,
        min,
        max: Number(band.max_threshold),
        width,
      };
    });
  }

  return MATURITY_BANDS.map((band, index) => {
    const nextMin = index < MATURITY_BANDS.length - 1
      ? MATURITY_BANDS[index + 1].min
      : 100;

    return {
      label: band.label,
      min: band.min,
      max: band.max,
      width: Math.max(0, nextMin - band.min),
    };
  });
}

export default function OpportunitySpectrum({ score, scoreBandLabel, bands }: Props) {
  const markerPct = Math.max(0, Math.min(100, score));
  const displayBands = buildDisplayBands(bands);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm font-medium text-white/80">Overall Opportunity Index</span>
        <Badge variant="custom" className="text-sm px-3 py-1 bg-white/10 text-white border-white/20">
          {scoreBandLabel}
        </Badge>
      </div>
      <div className="flex items-baseline gap-2 mb-4">
        <span className="font-mono font-semibold text-5xl text-white tabular-nums">{Math.round(score)}</span>
        <span className="text-white/50 text-sm font-medium">/ 100</span>
      </div>

      <div className="relative h-3 rounded-full overflow-hidden mt-4">
        <div className="absolute inset-0 flex">
          {displayBands.map((band) => (
            <div
              key={band.label}
              style={{
                backgroundColor: maturityColor(band.label),
                width: `${band.width}%`,
              }}
            />
          ))}
        </div>
        <div
          className="absolute -top-1 -bottom-1 w-1 bg-white rounded-full shadow-md ring-2 ring-navy-deep"
          style={{ left: `calc(${markerPct}% - 2px)` }}
        />
      </div>

      <div className="flex mt-2 text-[10px] font-semibold text-white/60">
        {displayBands.map((band) => (
          <span
            key={band.label}
            className="text-center"
            style={{ width: `${band.width}%` }}
          >
            {band.label}
          </span>
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

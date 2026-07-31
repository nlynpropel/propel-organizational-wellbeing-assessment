import { Star, Target } from 'lucide-react';
import { roundForDisplay, getScoreBand } from '../../lib/assessmentScoring';
import { maturityColor, behavioralColor } from '../../lib/scores';
import {
  getBehavioralInterpretation,
  DRIVER_LABELS,
  DRIVER_DESCRIPTIONS,
  type BehavioralReadiness,
} from '../../services/reportData';
import type { SelectedRecommendation } from '../../services/recommendations';
import type { AssessmentScoreBandRow, AssessmentSectionWithQuestions, AssessmentSectionScoreRow } from '../../lib/database.types';

export type StrategyDimension = {
  id: string;
  title: string;
  normalizedScore: number | null;
  bandLabel: string | null;
};

export type ReportSectionsData = {
  strengths: SelectedRecommendation[];
  priorityOpportunities: SelectedRecommendation[];
  strategyDimensions: StrategyDimension[];
  behavioralReadiness: BehavioralReadiness | null;
  scoreBands: AssessmentScoreBandRow[];
};

export function deriveStrategyDimensions(
  sections: AssessmentSectionWithQuestions[],
  sectionScores: AssessmentSectionScoreRow[],
  scoreBands: AssessmentScoreBandRow[],
): StrategyDimension[] {
  const sectionScoreMap = new Map(sectionScores.map((s) => [s.section_id, s]));
  return sections
    .filter((s) => s.is_scored)
    .map((section) => {
      const score = sectionScoreMap.get(section.id);
      const normScore = score ? Number(score.normalized_score) : null;
      const bandLabel = normScore !== null ? getScoreBand(normScore, scoreBands) : null;
      return { id: section.id, title: section.title, normalizedScore: normScore, bandLabel };
    });
}

export function StrengthsSection({ recommendations }: { recommendations: SelectedRecommendation[] }) {
  return (
    <section className="print-break-avoid">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-green-tint flex items-center justify-center">
          <Star className="w-4 h-4 text-green-dark" />
        </div>
        <h2 className="text-lg font-semibold text-navy">Strengths</h2>
      </div>
      <div className="space-y-3">
        {recommendations.map((rec) => (
          <div key={rec.id} className="border-l-4 border-l-green pl-4 print-break-avoid">
            <h4 className="text-sm font-semibold text-navy mb-1">{rec.strength_title ?? rec.title}</h4>
            <p className="text-sm text-neutral-secondary leading-relaxed">{rec.strength_description ?? rec.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function PriorityOpportunitiesSection({ recommendations }: { recommendations: SelectedRecommendation[] }) {
  return (
    <section className="print-break-avoid">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-orange-tint flex items-center justify-center">
          <Target className="w-4 h-4 text-orange" />
        </div>
        <h2 className="text-lg font-semibold text-navy">Priority Opportunities</h2>
      </div>
      <div className="space-y-3">
        {recommendations.map((rec) => (
          <div key={rec.id} className="border-l-4 border-l-orange pl-4 print-break-avoid">
            <h4 className="text-sm font-semibold text-navy mb-1">{rec.title}</h4>
            <p className="text-sm text-neutral-secondary leading-relaxed">{rec.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function StrategyDimensionsSection({ dimensions }: { dimensions: StrategyDimension[] }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-navy mb-4 print-break-after-avoid">Strategy Dimensions</h2>
      <div className="grid gap-x-8 gap-y-5 md:grid-cols-2 print-block">
        {dimensions.map((dim) => (
          <ScoreRow
            key={dim.id}
            label={dim.title}
            score={dim.normalizedScore}
            interpretation={dim.bandLabel}
          />
        ))}
      </div>
    </section>
  );
}

export function BehavioralReadinessSection({ readiness }: { readiness: BehavioralReadiness }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-navy mb-1 print-break-after-avoid">Behavioral Readiness</h2>
      <p className="text-xs text-neutral-muted mb-4">Higher scores indicate stronger behavioral support for well-being participation.</p>
      <div className="grid gap-x-8 gap-y-5 md:grid-cols-2 print-block">
        {(Object.keys(DRIVER_LABELS) as Array<keyof BehavioralReadiness>).map((key) => (
          <BehavioralReadinessRow key={key} driverKey={key} score={readiness[key]} />
        ))}
      </div>
    </section>
  );
}

function ScoreRow({
  label,
  score,
  interpretation,
}: {
  label: string;
  score: number | null;
  interpretation: string | null;
}) {
  if (score === null) {
    return (
      <div className="print-break-avoid">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-navy">{label}</span>
          <span className="text-sm text-neutral-muted">Not scored</span>
        </div>
      </div>
    );
  }

  const color = maturityColor(interpretation ?? score);
  const pct = Math.max(0, Math.min(100, score));

  return (
    <div className="print-break-avoid">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-navy">{label}</span>
        <span className="font-mono text-sm font-semibold text-navy tabular-nums">{roundForDisplay(score)} <span className="text-neutral-muted font-normal text-xs">/ 100</span></span>
      </div>
      <div className="w-full bg-neutral-bg rounded-full overflow-hidden h-2">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      {interpretation && (
        <p className="text-xs text-neutral-muted mt-1.5">{interpretation}</p>
      )}
    </div>
  );
}

function BehavioralReadinessRow({
  driverKey,
  score,
}: {
  driverKey: keyof BehavioralReadiness;
  score: number | null;
}) {
  if (score === null) {
    return (
      <div className="print-break-avoid">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-navy">{DRIVER_LABELS[driverKey]}</span>
          <span className="text-sm text-neutral-muted">Not scored</span>
        </div>
      </div>
    );
  }

  const color = behavioralColor(score);
  const pct = Math.max(0, Math.min(100, score));
  const interpretation = getBehavioralInterpretation(score);

  return (
    <div className="print-break-avoid">
      <div className="flex items-baseline justify-between gap-2 mb-0.5">
        <span className="text-sm font-medium text-navy">{DRIVER_LABELS[driverKey]}</span>
        <span className="font-mono text-sm font-semibold text-navy tabular-nums">{roundForDisplay(score)} <span className="text-neutral-muted font-normal text-xs">/ 100</span></span>
      </div>
      <p className="text-xs text-neutral-muted mb-1.5 leading-relaxed">{DRIVER_DESCRIPTIONS[driverKey]}</p>
      <div className="w-full bg-neutral-bg rounded-full overflow-hidden h-2">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <p className="text-xs text-neutral-muted mt-1.5">{interpretation}</p>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2 } from 'lucide-react';
import OpportunitySpectrum from '../ui/OpportunitySpectrum';
import LoadingState from '../ui/LoadingState';
import {
  StrategyDimensionsSection,
  BehavioralReadinessSection,
  type StrategyDimension,
} from '../report/ReportSections';
import { getScoreBand } from '../../lib/assessmentScoring';
import type { AssessmentScoreBandRow } from '../../lib/database.types';
import {
  fetchIntakeOpportunityIndexSummary,
  type IntakeOpportunityIndexSummary,
} from '../../services/intakeOpportunityIndexSummary';

export const PROPEL_RESULTS_REVIEW_URL = 'https://outlook.office.com/book/Propel1@propelwellness.com/s/bvm2IO9QmE6nwShU51E3xg2?ismsaljsauthenabled';

const CTA_INTRO = "If you want to understand your program's specific strengths and priority opportunities, schedule a 15 minute session with Propel to review your results.";

const CTA_BENEFITS = [
  'Program maturity analysis',
  'Key barriers holding back success',
  'Actionable program recommendations',
  'PDF of your results and a powerpoint presentation you can share with your internal stakeholders.',
];

const DIMENSION_MEANINGS: Record<string, { high: string; low: string }> = {
  'Strategy and Leadership': {
    high: 'your well-being strategy is clearly defined, supported by leadership, and connected to organizational priorities',
    low: 'your well-being strategy may need clearer leadership support, ownership, or connection to organizational priorities',
  },
  'Employee Relevance': {
    high: 'your program is well aligned with the needs, interests, and realities of your employee population',
    low: 'your program may not yet be consistently aligned with the needs, interests, and realities of your employee population',
  },
  'Engagement and Communication': {
    high: 'your communication and engagement approach is well positioned to build awareness and prompt employee action',
    low: 'your communication and engagement approach may not consistently translate awareness into employee action',
  },
  'Experience and Access': {
    high: 'employees are likely to find the program easy to access, understand, and use across different work environments',
    low: 'friction in access, usability, or the employee experience may make participation more difficult',
  },
  'Culture and Social Support': {
    high: 'workplace culture, managers, and peers are likely reinforcing participation and healthy behaviors',
    low: 'employees may have limited cultural, manager, or peer reinforcement for participation and healthy behaviors',
  },
  'Measurement and Improvement': {
    high: 'your organization is effectively using program data and results to guide ongoing improvement',
    low: 'program data and results may not yet be used consistently to guide decisions and ongoing improvement',
  },
};

function getDimensionMeaning(title: string, level: 'high' | 'low'): string {
  return DIMENSION_MEANINGS[title]?.[level]
    ?? (level === 'high'
      ? 'this is a comparatively strong area of your current well-being strategy'
      : 'this area may present more opportunity for strengthening your current well-being strategy');
}

function buildExecutiveSummary(summary: IntakeOpportunityIndexSummary): string {
  const overall = Math.round(summary.overall_score);
  const scoredDimensions = summary.strategy_dimensions
    .filter((dimension) => dimension.normalized_score !== null && Number.isFinite(dimension.normalized_score))
    .map((dimension) => ({
      ...dimension,
      normalized_score: dimension.normalized_score as number,
    }));
  const readinessScores = summary.behavioral_readiness
    ? Object.values(summary.behavioral_readiness).filter((score) => Number.isFinite(score))
    : [];

  const parts = [
    `Your overall Well-being Scorecard score is ${overall}/100${summary.score_band ? `, placing your program in the ${summary.score_band} range` : ''}.`,
  ];

  if (scoredDimensions.length > 0) {
    const topDimension = scoredDimensions.reduce((top, current) => (
      current.normalized_score > top.normalized_score ? current : top
    ));
    const lowestDimension = scoredDimensions.reduce((lowest, current) => (
      current.normalized_score < lowest.normalized_score ? current : lowest
    ));

    parts.push(
      `Your top strategic score was in the category of ${topDimension.title}, meaning ${getDimensionMeaning(topDimension.title, 'high')}.`,
    );
    parts.push(
      `Your lowest strategic score was in the category of ${lowestDimension.title}, meaning ${getDimensionMeaning(lowestDimension.title, 'low')}.`,
    );
  }

  if (readinessScores.length > 0) {
    const average = Math.round(readinessScores.reduce((sum, score) => sum + score, 0) / readinessScores.length);
    const interpretation = average >= 80
      ? 'strong behavioral support for employee action'
      : average >= 65
        ? 'generally supportive conditions for employee action'
        : average >= 50
          ? 'meaningful behavioral barriers that may affect participation'
          : 'significant behavioral barriers that may affect participation';
    parts.push(`In the behavioral readiness section, your average score was ${average}/100, indicating ${interpretation}.`);
  }

  return parts.join(' ');
}

export default function IntakeOpportunityIndexResults({ secureToken }: { secureToken: string }) {
  const [summary, setSummary] = useState<IntakeOpportunityIndexSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchIntakeOpportunityIndexSummary(secureToken)
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Results are not available yet.');
      });
    return () => { cancelled = true; };
  }, [secureToken]);

  const scoreBands = useMemo(() => (
    (summary?.score_bands ?? []) as unknown as AssessmentScoreBandRow[]
  ), [summary]);

  const dimensions = useMemo<StrategyDimension[]>(() => {
    if (!summary) return [];
    return summary.strategy_dimensions.map((dimension) => ({
      id: dimension.id,
      title: dimension.title,
      normalizedScore: dimension.normalized_score,
      bandLabel: dimension.normalized_score === null
        ? null
        : getScoreBand(dimension.normalized_score, scoreBands),
    }));
  }, [summary, scoreBands]);

  if (!summary && !error) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-neutral-border p-8 max-w-5xl mx-auto">
        <LoadingState label="Preparing your results…" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-neutral-border p-8 max-w-2xl mx-auto text-center">
        <div className="w-14 h-14 rounded-full bg-green-tint flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-7 h-7 text-green-dark" />
        </div>
        <h1 className="text-2xl font-bold text-navy mb-2">Assessment Submitted</h1>
        <p className="text-sm text-neutral-secondary">
          Thank you. Your assessment was submitted successfully. Your detailed results are being prepared.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow-md border border-neutral-border p-6 md:p-8">
        <div className="flex items-start gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-green-tint flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-green-dark" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-green-dark">Assessment complete</p>
            <h1 className="font-display text-2xl font-bold text-navy mt-1">Your Well-being Scorecard Results</h1>
            {summary.organization_name && (
              <p className="text-sm text-neutral-secondary mt-1">{summary.organization_name}</p>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-navy-deep shadow-md p-6">
          <OpportunitySpectrum
            score={summary.overall_score}
            scoreBandLabel={summary.score_band ?? 'Results'}
            bands={scoreBands}
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-neutral-border p-6 md:p-8">
        <h2 className="text-lg font-semibold text-navy mb-3">Executive Summary</h2>
        <p className="text-sm text-neutral-secondary leading-relaxed">
          {buildExecutiveSummary(summary)}
        </p>
      </div>

      {dimensions.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-neutral-border p-6 md:p-8">
          <StrategyDimensionsSection dimensions={dimensions} />
        </div>
      )}

      {summary.behavioral_readiness && (
        <div className="bg-white rounded-lg shadow-sm border border-neutral-border p-6 md:p-8">
          <BehavioralReadinessSection readiness={summary.behavioral_readiness} />
        </div>
      )}

      <div className="rounded-lg bg-navy-deep shadow-md p-6 md:p-8 text-white">
        <h2 className="text-xl font-semibold mb-3 text-[#ffffff]">Turn your results into an action plan</h2>
        <p className="text-sm text-white/80 leading-relaxed max-w-3xl">
          {CTA_INTRO}
        </p>
        <h3 className="text-lg font-semibold mt-6 mb-2 text-[#ffffff]">What You'll Get</h3>
        <ul className="list-disc pl-5 space-y-1 text-sm text-white/80 leading-relaxed max-w-3xl">
          {CTA_BENEFITS.map((benefit) => (
            <li key={benefit}>{benefit}</li>
          ))}
        </ul>
        <div className="mt-5">
          {PROPEL_RESULTS_REVIEW_URL ? (
            <a
              href={PROPEL_RESULTS_REVIEW_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-sm bg-green px-4 py-2.5 text-sm font-semibold text-navy hover:opacity-90 transition"
            >
              <Calendar className="w-4 h-4" />
              Schedule a 15-minute session
            </a>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-sm border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-medium text-white/70">
              <Calendar className="w-4 h-4" />
              Scheduling link coming soon
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

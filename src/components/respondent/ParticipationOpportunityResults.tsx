import { useState, useEffect } from 'react';
import { Target, TrendingUp, ArrowRight } from 'lucide-react';
import { fetchParticipationOpportunityResult, type ParticipationOpportunityResult } from '../../services/participationOpportunityResult';
import LoadingState from '../ui/LoadingState';
import ErrorState from '../ui/ErrorState';

export default function ParticipationOpportunityResults({ token }: { token: string }) {
  const [result, setResult] = useState<ParticipationOpportunityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    setResult(null);
    fetchParticipationOpportunityResult(token)
      .then(setResult)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load your result'));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-neutral-border p-8">
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-neutral-border p-8">
        <LoadingState label="Preparing your personalized results…" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md border border-neutral-border p-8">
      <h1 className="font-display text-2xl font-semibold text-navy text-center">{result.header}</h1>

      {/* Primary opportunity */}
      <div className="mt-8 rounded-md border border-orange/20 bg-orange-tint p-6">
        <div className="flex items-center gap-2 text-orange-dark">
          <Target className="w-5 h-5" />
          <p className="text-xs font-semibold uppercase tracking-wide">Your Primary Opportunity</p>
        </div>
        <h2 className="font-display text-xl font-semibold text-navy mt-2">{result.primary.title}</h2>
        <p className="text-sm text-neutral-text leading-relaxed mt-3">{result.primary.explanation}</p>

        {result.primary.likely_cause && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-neutral-muted uppercase tracking-wide">Likely Cause</p>
            <p className="text-sm text-neutral-secondary mt-1">{result.primary.likely_cause}</p>
          </div>
        )}

        {result.primary.thirty_day_action && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-neutral-muted uppercase tracking-wide">Your First 30-Day Action</p>
            <p className="text-sm text-neutral-secondary mt-1">{result.primary.thirty_day_action}</p>
          </div>
        )}

        {result.primary.measure && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-neutral-muted uppercase tracking-wide">What to Measure</p>
            <p className="text-sm text-neutral-secondary mt-1">{result.primary.measure}</p>
          </div>
        )}

        {result.primary.how_connect_can_help && (
          <div className="mt-5 pt-4 border-t border-orange/20">
            <p className="text-sm text-navy">
              <strong>How Propel Connect can help:</strong> {result.primary.how_connect_can_help}
            </p>
          </div>
        )}
      </div>

      {/* Secondary opportunity */}
      {result.secondary && (
        <div className="mt-5 rounded-md border border-green/20 bg-green-tint p-6">
          <div className="flex items-center gap-2 text-green-dark">
            <TrendingUp className="w-5 h-5" />
            <p className="text-xs font-semibold uppercase tracking-wide">A Secondary Opportunity</p>
          </div>
          <h3 className="font-display text-lg font-semibold text-navy mt-2">{result.secondary.title}</h3>
          <p className="text-sm text-neutral-text leading-relaxed mt-2">{result.secondary.description}</p>
          {result.secondary.connect_capability && (
            <p className="text-sm text-neutral-secondary mt-3">{result.secondary.connect_capability}</p>
          )}
        </div>
      )}

      {/* Closing + CTA */}
      <p className="text-sm text-neutral-secondary leading-relaxed mt-8 text-center max-w-lg mx-auto">
        {result.closing}
      </p>

      <a href="https://propelwellbeing.com/connect"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 rounded-md bg-navy p-5 text-center flex items-center justify-center gap-2 hover:bg-navy/90 transition-colors"
      >
        <span className="text-white text-sm font-medium">{result.cta}</span>
        <ArrowRight className="w-4 h-4 text-white" />
      </a>

      <p className="text-xs text-neutral-muted mt-6 text-center">
        You may close this page. Your results have been saved.
      </p>
    </div>
  );
}
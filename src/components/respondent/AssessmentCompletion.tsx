import { CheckCircle, Sparkles } from 'lucide-react';
import type { ResolvedAssessment } from '../../lib/database.types';
import type { AssessmentResultRow } from '../../lib/database.types';

export default function AssessmentCompletion({
  assessment,
  result,
}: {
  assessment: ResolvedAssessment;
  result: AssessmentResultRow | null;
}) {
  const { version, template } = assessment;
  const showResults = version.respondent_results_enabled && result;

  return (
    <div className="bg-white rounded-lg shadow-md border border-neutral-border p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-green-tint flex items-center justify-center mx-auto">
        <CheckCircle className="w-8 h-8 text-green-dark" />
      </div>
      <h1 className="font-display text-2xl font-semibold text-navy mt-5">Assessment complete</h1>
      <p className="text-sm text-neutral-secondary mt-3 leading-relaxed max-w-md mx-auto">
        {version.completion_message ||
          `Thank you for completing the ${template.name}. Your responses have been securely submitted and your broker will follow up with a personalized report.`}
      </p>

      {showResults && (
        <div className="mt-6 rounded-md border border-neutral-border bg-neutral-bg/50 p-5">
          {version.respondent_score_enabled && result?.normalized_score !== null && (
            <div className="mb-4">
              <p className="text-xs font-medium text-neutral-muted uppercase tracking-wide">
                Your Score
              </p>
              <p className="font-display text-3xl font-semibold text-navy mt-1">
                {Math.round(result.normalized_score)}
                <span className="text-lg text-neutral-muted">/100</span>
              </p>
              {result.score_band && (
                <p className="text-sm text-green-dark font-medium mt-1">{result.score_band}</p>
              )}
            </div>
          )}
          {version.respondent_recommendations_enabled && (
            <div className="text-sm text-neutral-text leading-relaxed">
              <p className="flex items-center justify-center gap-1.5 text-green-dark font-medium">
                <Sparkles className="w-4 h-4" />
                Recommendations included in your report
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 rounded-md bg-blue-tint border border-blue/20 p-4">
        <p className="text-sm text-blue">
          <strong>What happens next?</strong> {assessment.instance.broker_name || 'Your broker'} will
          review your responses and prepare a personalized report.
        </p>
      </div>

      <p className="text-xs text-neutral-muted mt-6">
        You may close this page. Your responses have been saved.
      </p>
    </div>
  );
}

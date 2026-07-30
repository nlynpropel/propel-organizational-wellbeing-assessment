import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  FileText,
  RefreshCw,
  CheckCircle2,
  Printer,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import Button from './ui/Button';
import Card from './ui/Card';
import Badge from './ui/Badge';
import LoadingState from './ui/LoadingState';
import { useAuth } from '../context/AuthContext';
import {
  fetchGenerationsForAssessmentInstance,
  generateStrategyReport,
  canReviewGeneration,
  canApproveGeneration,
  canEditGeneration,
  getDisplayOutput,
  GENERATION_STATUS_LABELS,
  GENERATION_STATUS_VARIANTS,
} from '../services/aiGenerations';
import type { AnalysisGenerationRow } from '../lib/database.types';

type Props = {
  assessmentInstanceId: string;
};

type GenerationOutput = {
  executive_summary: string;
  maturity_interpretation: string;
  prioritized_barriers: Array<{ title: string; description: string }>;
  priority_recommendations: Array<{
    title: string;
    why_this_matters: string;
    recommended_action: string;
    suggested_first_step: string;
    expected_strategic_impact: string;
    implementation_sequence: string;
    propel_knowledge_evidence: string;
    assessment_evidence: string;
  }>;
  implementation_sequence: string[];
  client_discussion_questions: string[];
  limitations: string;
};

export default function StrategyReportSection({ assessmentInstanceId }: Props) {
  const { profile, capabilities } = useAuth();
  const [generations, setGenerations] = useState<AnalysisGenerationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);

  const load = useCallback(async () => {
    if (!assessmentInstanceId) return;
    setLoading(true);
    setError(null);
    try {
      const gens = await fetchGenerationsForAssessmentInstance(assessmentInstanceId);
      setGenerations(gens);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load strategy report.');
    } finally {
      setLoading(false);
    }
  }, [assessmentInstanceId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleGenerate = async () => {
    if (!profile) return;
    setGenerating(true);
    setError(null);
    try {
      await generateStrategyReport(assessmentInstanceId, profile.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate strategy report.');
    } finally {
      setGenerating(false);
    }
  };

  const latestGen = generations[0] ?? null;
  const canReview = canReviewGeneration(capabilities);
  const canApproveGen = canApproveGeneration(capabilities);
  const canEditGen = canEditGeneration(capabilities);

  if (loading) {
    return (
      <Card className="mt-6">
        <LoadingState label="Loading strategy report…" />
      </Card>
    );
  }

  // Not generated yet
  if (!latestGen) {
    return (
      <Card className="mt-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-navy/60" />
          <span className="eyebrow">Strategy Report</span>
        </div>
        <p className="text-sm text-neutral-secondary leading-relaxed mb-4">
          Generate a knowledge-informed strategy report that combines this assessment's results
          with approved Propel research and strategy knowledge.
        </p>
        {error && (
          <p className="text-sm text-red flex items-center gap-1.5 mb-3">
            <AlertCircle className="w-4 h-4" /> {error}
          </p>
        )}
        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generating ? 'Generating…' : 'Generate Strategy Report'}
        </Button>
      </Card>
    );
  }

  // Generating in progress
  if (latestGen.status === 'queued' || latestGen.status === 'generating') {
    return (
      <Card className="mt-6">
        <div className="flex items-center gap-2 mb-3">
          <Loader2 className="w-5 h-5 text-navy animate-spin" />
          <span className="eyebrow">Strategy Report</span>
          <Badge variant={GENERATION_STATUS_VARIANTS[latestGen.status]} dot>
            {GENERATION_STATUS_LABELS[latestGen.status]}
          </Badge>
        </div>
        <p className="text-sm text-neutral-secondary">
          Your strategy report is being generated. This typically takes 30–60 seconds.
        </p>
      </Card>
    );
  }

  // Generation failed
  if (latestGen.status === 'failed') {
    return (
      <Card className="mt-6">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className="w-5 h-5 text-red" />
          <span className="eyebrow">Strategy Report</span>
          <Badge variant="danger" dot>Generation failed</Badge>
        </div>
        {latestGen.error_message && (
          <p className="text-sm text-red mb-3">{latestGen.error_message}</p>
        )}
        {error && (
          <p className="text-sm text-red flex items-center gap-1.5 mb-3">
            <AlertCircle className="w-4 h-4" /> {error}
          </p>
        )}
        <Button variant="outline" onClick={handleGenerate} disabled={generating}>
          <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
          {generating ? 'Retrying…' : 'Try again'}
        </Button>
      </Card>
    );
  }

  // Draft or approved — show summary + actions
  const output = getDisplayOutput(latestGen) as unknown as GenerationOutput | null;

  return (
    <Card className="mt-6 print-area">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Sparkles className="w-5 h-5 text-navy/60" />
          <span className="eyebrow">Strategy Report</span>
          <Badge variant={GENERATION_STATUS_VARIANTS[latestGen.status]} dot>
            {GENERATION_STATUS_LABELS[latestGen.status]}
          </Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap print:hidden">
          {latestGen.status === 'draft_generated' && canReview && !showReview && (
            <Button size="sm" onClick={() => setShowReview(true)}>
              <FileText className="w-4 h-4" /> Review Strategy Report
            </Button>
          )}
          {latestGen.status === 'draft_generated' && canEditGen && (
            <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generating}>
              <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
              {generating ? 'Generating…' : 'Regenerate'}
            </Button>
          )}
          {latestGen.status === 'draft_generated' && canApproveGen && (
            <Button size="sm" variant="primary">
              <CheckCircle2 className="w-4 h-4" /> Approve
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4" /> Print
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red flex items-center gap-1.5 mb-3 print:hidden">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}

      {/* Print header — only visible when printing */}
      <div className="hidden print:block mb-6 pb-3 border-b-2 border-navy">
        <img src="/Propel_Logo_2020_v4-3.png" alt="Propel" className="h-10 mb-2" />
        <h2 className="text-lg font-bold text-navy">Strategy Report</h2>
      </div>

      {showReview && output ? (
        <ReportContent output={output} />
      ) : output ? (
        <div className="space-y-3">
          <p className="text-sm text-neutral-secondary leading-relaxed">
            {output.executive_summary?.slice(0, 200)}
            {output.executive_summary && output.executive_summary.length > 200 ? '…' : ''}
          </p>
          <Button size="sm" variant="ghost" onClick={() => setShowReview(true)}>
            <FileText className="w-4 h-4" /> View full report
          </Button>
        </div>
      ) : (
        <p className="text-sm text-neutral-muted">Report output is being processed…</p>
      )}
    </Card>
  );
}

// ============================================================
// Report content — broker-facing, no technical metadata or sources
// ============================================================

function ReportContent({ output }: { output: GenerationOutput }) {
  return (
    <div className="space-y-5">
      {/* A. Executive Summary */}
      <div>
        <h3 className="text-sm font-semibold text-navy mb-1.5">Executive Summary</h3>
        <p className="text-sm text-neutral-secondary leading-relaxed">{output.executive_summary}</p>
      </div>

      {/* B. Current Maturity */}
      <div>
        <h3 className="text-sm font-semibold text-navy mb-1.5">Current Maturity</h3>
        <p className="text-sm text-neutral-secondary leading-relaxed">{output.maturity_interpretation}</p>
      </div>

      {/* C. What Is Holding Impact Back */}
      {output.prioritized_barriers?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-navy mb-2">What Is Holding Impact Back</h3>
          <div className="space-y-2">
            {output.prioritized_barriers.map((barrier, idx) => (
              <div key={idx} className="rounded-md border border-neutral-border-soft p-3">
                <p className="text-sm font-semibold text-navy">{barrier.title}</p>
                <p className="text-sm text-neutral-secondary mt-1 leading-relaxed">{barrier.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* D. Priority Recommendations */}
      {output.priority_recommendations?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-navy mb-2">Priority Recommendations</h3>
          <div className="space-y-3">
            {output.priority_recommendations.map((rec, idx) => (
              <div key={idx} className="rounded-md border border-neutral-border-soft p-3">
                <div className="flex items-start gap-2">
                  <span className="text-xs font-bold text-neutral-muted mt-0.5">#{idx + 1}</span>
                  <div className="flex-1 min-w-0 space-y-2">
                    <p className="text-sm font-semibold text-navy">{rec.title}</p>
                    {rec.why_this_matters && (
                      <Field label="Why This Matters" value={rec.why_this_matters} />
                    )}
                    {rec.recommended_action && (
                      <Field label="Recommended Action" value={rec.recommended_action} />
                    )}
                    {rec.suggested_first_step && (
                      <Field label="Suggested First Step" value={rec.suggested_first_step} />
                    )}
                    {rec.expected_strategic_impact && (
                      <Field label="Expected Strategic Impact" value={rec.expected_strategic_impact} />
                    )}
                    {rec.implementation_sequence && (
                      <Field label="Implementation Order" value={rec.implementation_sequence} />
                    )}
                    {rec.propel_knowledge_evidence && (
                      <Field label="Integrated Strategy Guidance" value={rec.propel_knowledge_evidence} />
                    )}
                    {rec.assessment_evidence && (
                      <Field label="Related Assessment Findings" value={rec.assessment_evidence} />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* E. Recommended Implementation Sequence */}
      {output.implementation_sequence?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-navy mb-2">Recommended Implementation Sequence</h3>
          <div className="space-y-1.5">
            {output.implementation_sequence.map((phase, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm">
                <span className="text-xs font-bold text-neutral-muted mt-0.5">{idx + 1}.</span>
                <p className="text-neutral-secondary flex-1">{phase}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* F. Client Discussion Questions */}
      {output.client_discussion_questions?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-navy mb-2">Client Discussion Questions</h3>
          <div className="space-y-2">
            {output.client_discussion_questions.map((q, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-xs font-bold text-neutral-muted mt-0.5">Q{idx + 1}</span>
                <p className="text-sm text-neutral-secondary flex-1">{q}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* G. Limitations and Missing Information */}
      {output.limitations && (
        <div>
          <h3 className="text-sm font-semibold text-navy mb-1.5">Limitations and Missing Information</h3>
          <p className="text-sm text-neutral-secondary leading-relaxed">{output.limitations}</p>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-medium text-neutral-muted uppercase tracking-wide">{label}</span>
      <p className="text-sm text-neutral-secondary mt-0.5 leading-relaxed">{value}</p>
    </div>
  );
}

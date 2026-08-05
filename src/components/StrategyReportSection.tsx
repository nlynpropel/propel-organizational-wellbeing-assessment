import { useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  Sparkles,
  FileText,
  RefreshCw,
  CheckCircle2,
  Printer,
  AlertCircle,
  Loader2,
  Lock,
} from 'lucide-react';

const LOGO_SRC = '/Propel_Logo_2020_Main.png';
import Button from './ui/Button';
import Card from './ui/Card';
import Badge from './ui/Badge';
import LoadingState from './ui/LoadingState';
import { useAuth } from '../context/AuthContext';
import {
  fetchGenerationsForAssessmentInstance,
  fetchGenerationById,
  generateStrategyReport,
  approveGeneration,
  canReviewGeneration,
  canApproveGeneration,
  canEditGeneration,
  isGenerationReadOnly,
  getDisplayOutput,
  GENERATION_STATUS_LABELS,
  GENERATION_STATUS_VARIANTS,
} from '../services/aiGenerations';
import type { AnalysisGenerationRow } from '../lib/database.types';
import { shouldShowPrintButton, canTriggerPrint, type PrintDataContext } from '../lib/printHelpers';
import {
  StrengthsSection,
  PriorityOpportunitiesSection,
  StrategyDimensionsSection,
  BehavioralReadinessSection,
  type ReportSectionsData,
} from './report/ReportSections';

type Props = {
  assessmentInstanceId: string;
  printContext?: PrintDataContext | null;
  printableGraph?: ReactNode | null;
  reportSectionsData?: ReportSectionsData | null;
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

const POLL_INTERVAL_MS = 4000;
const TERMINAL_STATUSES = new Set(['draft_generated', 'approved', 'failed', 'rejected']);

export default function StrategyReportSection({ assessmentInstanceId, printContext, printableGraph, reportSectionsData }: Props) {
  const { profile, capabilities } = useAuth();
  const [generations, setGenerations] = useState<AnalysisGenerationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const printingRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingGenIdRef = useRef<string | null>(null);

  const clearPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    pollingGenIdRef.current = null;
  }, []);

  const startPolling = useCallback((generationId: string) => {
    if (pollingGenIdRef.current === generationId && pollRef.current) return;
    clearPolling();
    pollingGenIdRef.current = generationId;

    pollRef.current = setInterval(async () => {
      try {
        const gen = await fetchGenerationById(generationId);
        if (!gen) {
          clearPolling();
          setGenerating(false);
          setError('Generation not found. Please try again.');
          return;
        }
        setGenerations(prev => {
          const idx = prev.findIndex(g => g.id === generationId);
          if (idx === -1) return [gen, ...prev];
          const next = [...prev];
          next[idx] = gen;
          return next;
        });
        if (TERMINAL_STATUSES.has(gen.status)) {
          clearPolling();
          setGenerating(false);
        }
      } catch {
        // Network error during poll — keep polling, don't disrupt UI
      }
    }, POLL_INTERVAL_MS);
  }, [clearPolling]);

  const load = useCallback(async () => {
    if (!assessmentInstanceId) return;
    setLoading(true);
    setError(null);
    try {
      const gens = await fetchGenerationsForAssessmentInstance(assessmentInstanceId);
      setGenerations(gens);
      const latest = gens[0];
      if (latest && (latest.status === 'queued' || latest.status === 'generating')) {
        setGenerating(true);
        startPolling(latest.id);
      } else {
        setGenerating(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load strategy report.');
    } finally {
      setLoading(false);
    }
  }, [assessmentInstanceId, startPolling]);

  useEffect(() => {
    load();
    return clearPolling;
  }, [load, clearPolling]);

  const handleGenerate = async () => {
    if (!profile || generating) return;
    setGenerating(true);
    setError(null);
    setSuccessMsg(null);
    setShowReview(false);
    try {
      const result = await generateStrategyReport(assessmentInstanceId, profile.id);
      // The Edge Function may time out while the backend keeps processing.
      // Always check the database for the true status before showing failure.
      const gen = await fetchGenerationById(result.id);
      if (gen) {
        setGenerations(prev => {
          const idx = prev.findIndex(g => g.id === gen.id);
          if (idx === -1) return [gen, ...prev];
          const next = [...prev];
          next[idx] = gen;
          return next;
        });
        if (TERMINAL_STATUSES.has(gen.status)) {
          setGenerating(false);
        } else {
          startPolling(gen.id);
        }
      } else {
        startPolling(result.id);
      }
    } catch (err) {
      // The HTTP request failed (timeout, network error, etc.).
      // Query the database before showing a failure — the backend may have succeeded.
      try {
        const gens = await fetchGenerationsForAssessmentInstance(assessmentInstanceId);
        const latest = gens[0];
        if (latest && !TERMINAL_STATUSES.has(latest.status)) {
          setGenerations(gens);
          startPolling(latest.id);
        } else if (latest && latest.status === 'draft_generated') {
          setGenerations(gens);
          setGenerating(false);
        } else if (latest && latest.status === 'failed') {
          setGenerations(gens);
          setGenerating(false);
          setError(latest.error_message ?? 'Generation failed.');
        } else {
          setGenerating(false);
          setError(err instanceof Error ? err.message : 'Failed to generate strategy report.');
        }
      } catch {
        setGenerating(false);
        setError(err instanceof Error ? err.message : 'Failed to generate strategy report.');
      }
    }
  };

  const handleApprove = async () => {
    const gen = generations[0];
    if (!gen || approving) return;
    setApproving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await approveGeneration(gen.id, profile?.id ?? '');
      setSuccessMsg('Strategy report approved. The report is now read-only.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve strategy report.');
    } finally {
      setApproving(false);
    }
  };

  const latestGen = generations[0] ?? null;
  const output = getDisplayOutput(latestGen) as unknown as GenerationOutput | null;
  const canReview = canReviewGeneration(capabilities);
  const canApproveGen = canApproveGeneration(capabilities);
  const canEditGen = canEditGeneration(capabilities);
  const readOnly = latestGen ? isGenerationReadOnly(latestGen.status) : false;

  const handlePrint = useCallback(() => {
    if (!canTriggerPrint(printingRef.current, showReview, !!printRef.current, !!output)) return;
    printingRef.current = true;
    // Wait for the footer logo to load before triggering print
    const img = printRef.current?.querySelector<HTMLImageElement>('.print-footer img');
    const trigger = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.print();
          printingRef.current = false;
        });
      });
    };
    if (!img || img.complete) {
      trigger();
    } else {
      img.addEventListener('load', trigger, { once: true });
      img.addEventListener('error', trigger, { once: true });
    }
  }, [showReview, output]);

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

  // Draft, approved, or rejected — show summary + actions
  const showPrint = shouldShowPrintButton(showReview, !!output);

  return (
    <div className="mt-6">
      {/* Application controls — never appear in the printed document */}
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3 print:hidden">
        <div className="flex items-center gap-2 flex-wrap">
          <Sparkles className="w-5 h-5 text-navy/60" />
          <span className="eyebrow">Strategy Report</span>
          <Badge variant={GENERATION_STATUS_VARIANTS[latestGen.status]} dot>
            {GENERATION_STATUS_LABELS[latestGen.status]}
          </Badge>
          {readOnly && (
            <span className="inline-flex items-center gap-1 text-xs text-neutral-muted">
              <Lock className="w-3.5 h-3.5" /> Read-only
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {latestGen.status === 'draft_generated' && canReview && !showReview && (
            <Button size="sm" onClick={() => setShowReview(true)}>
              <FileText className="w-4 h-4" /> Review Strategy Report
            </Button>
          )}
          {latestGen.status === 'draft_generated' && canEditGen && !readOnly && (
            <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generating}>
              <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
              {generating ? 'Generating…' : 'Regenerate'}
            </Button>
          )}
          {latestGen.status === 'draft_generated' && canApproveGen && (
            <Button size="sm" variant="primary" onClick={handleApprove} disabled={approving || generating}>
              {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {approving ? 'Approving…' : 'Approve'}
            </Button>
          )}
          {showPrint && (
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrint}
              disabled={printingRef.current}
              aria-label="Print Strategy Report"
            >
              <Printer className="w-4 h-4" /> Print Strategy Report
            </Button>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="rounded-md border border-green/30 bg-green/5 p-3 mb-3 print:hidden">
          <p className="text-sm text-green flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> {successMsg}
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-red flex items-center gap-1.5 mb-3 print:hidden">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}

      {/* Printable document — no border, no card chrome */}
      <div ref={printRef} className="print-area">
        {showReview && output ? (
          <div className="space-y-6">
            {/* Print-only client context — begins with org, assessment, date */}
            {printContext && (
              <div className="hidden print:block space-y-0.5 mb-6">
                {printContext.clientOrganization && (
                  <p className="text-base font-semibold text-navy">{printContext.clientOrganization}</p>
                )}
                {printContext.assessmentName && (
                  <p className="text-sm text-neutral-secondary">{printContext.assessmentName}</p>
                )}
                {printContext.completionDate && (
                  <p className="text-sm text-neutral-secondary">{printContext.completionDate}</p>
                )}
              </div>
            )}

            {/* Print-only Opportunity Index graph + score + maturity */}
            {printContext && printableGraph && (
              <div className="hidden print:block mb-6 print-break-avoid">
                <div className="print-graph-container rounded-lg bg-navy-deep p-5">
                  {printableGraph}
                </div>
                {printContext.opportunityIndexScore !== null && (
                  <p className="text-sm text-navy mt-2">
                    <span className="font-semibold">Opportunity Index Score: </span>
                    {Math.round(printContext.opportunityIndexScore)} / 100
                  </p>
                )}
                {printContext.maturityLevel && (
                  <p className="text-sm text-navy">
                    <span className="font-semibold">Maturity Level: </span>
                    {printContext.maturityLevel}
                  </p>
                )}
              </div>
            )}

            {/* Deterministic sections — reused from assessment report */}
            {reportSectionsData && reportSectionsData.strengths.length > 0 && (
              <StrengthsSection recommendations={reportSectionsData.strengths} />
            )}
            {reportSectionsData && reportSectionsData.priorityOpportunities.length > 0 && (
              <PriorityOpportunitiesSection recommendations={reportSectionsData.priorityOpportunities} />
            )}
            {reportSectionsData && reportSectionsData.strategyDimensions.length > 0 && (
              <StrategyDimensionsSection dimensions={reportSectionsData.strategyDimensions} />
            )}
            {reportSectionsData && reportSectionsData.behavioralReadiness && (
              <BehavioralReadinessSection readiness={reportSectionsData.behavioralReadiness} />
            )}

            {/* AI-generated sections */}
            <ReportContent output={output} />

            {/* Print-only footer — Powered by Propel */}
            <div className="hidden print:block print-footer">
              <span className="print-footer-text">Powered by</span>
              <img
                src={LOGO_SRC}
                alt="Propel"
                className="print-footer-logo"
                loading="eager"
              />
            </div>
          </div>
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
      </div>
    </div>
  );
}

// ============================================================
// Report content — broker-facing, no technical metadata or sources
// ============================================================

function ReportContent({ output }: { output: GenerationOutput }) {
  return (
    <div className="space-y-8">
      {/* A. Executive Summary */}
      <section className="print-break-avoid">
        <h3 className="text-lg font-semibold text-navy mb-1.5 print-break-after-avoid">Executive Summary</h3>
        <p className="text-sm text-neutral-secondary leading-relaxed">{output.executive_summary}</p>
      </section>

      {/* B. Current Maturity */}
      <section className="print-break-avoid">
        <h3 className="text-lg font-semibold text-navy mb-1.5 print-break-after-avoid">Current Maturity</h3>
        <p className="text-sm text-neutral-secondary leading-relaxed">{output.maturity_interpretation}</p>
      </section>

      {/* C. What Is Holding Impact Back */}
      {output.prioritized_barriers?.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-navy mb-2 print-break-after-avoid">What Is Holding Impact Back</h3>
          <div className="space-y-3">
            {output.prioritized_barriers.map((barrier, idx) => (
              <div key={idx} className="print-break-avoid">
                <p className="text-sm font-semibold text-navy">{barrier.title}</p>
                <p className="text-sm text-neutral-secondary mt-1 leading-relaxed">{barrier.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* D. Priority Recommendations */}
      {output.priority_recommendations?.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-navy mb-2 print-break-after-avoid">Priority Recommendations</h3>
          <div className="space-y-4">
            {output.priority_recommendations.map((rec, idx) => (
              <div key={idx} className="print-break-avoid">
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
        </section>
      )}

      {/* E. Recommended Implementation Sequence */}
      {output.implementation_sequence?.length > 0 && (
        <section className="print-break-avoid">
          <h3 className="text-lg font-semibold text-navy mb-2 print-break-after-avoid">Recommended Implementation Sequence</h3>
          <div className="space-y-1.5">
            {output.implementation_sequence.map((phase, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm print-break-avoid">
                <span className="text-xs font-bold text-neutral-muted mt-0.5">{idx + 1}.</span>
                <p className="text-neutral-secondary flex-1">{phase}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* F. Client Discussion Questions — screen only, excluded from print */}
      {output.client_discussion_questions?.length > 0 && (
        <section className="print:hidden">
          <h3 className="text-lg font-semibold text-navy mb-2 print-break-after-avoid">Client Discussion Questions</h3>
          <div className="space-y-2">
            {output.client_discussion_questions.map((q, idx) => (
              <div key={idx} className="flex items-start gap-2 print-break-avoid">
                <span className="text-xs font-bold text-neutral-muted mt-0.5">Q{idx + 1}</span>
                <p className="text-sm text-neutral-secondary flex-1">{q}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* G. Limitations — screen only, excluded from print */}
      {output.limitations && (
        <section className="print-break-avoid print:hidden">
          <h3 className="text-lg font-semibold text-navy mb-1.5 print-break-after-avoid">Limitations</h3>
          <p className="text-sm text-neutral-secondary leading-relaxed">{output.limitations}</p>
        </section>
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

import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Save,
  Lock,
  AlertCircle,
  Clock,
  User,
  Hash,
  FileText,
  RefreshCw,
  ChevronRight,
  Link2,
} from 'lucide-react';
import Button from './ui/Button';
import Card from './ui/Card';
import Badge from './ui/Badge';
import LoadingState from './ui/LoadingState';
import ErrorState from './ui/ErrorState';
import ConfirmationModal from './ui/ConfirmationModal';
import { useAuth } from '../context/AuthContext';
import {
  fetchGenerationsForWorkspace,
  fetchGenerationById,
  approveGeneration,
  rejectGeneration,
  saveReviewEdits,
  createGeneration,
  canRegenerate,
  canReviewGeneration,
  canApproveGeneration,
  canEditGeneration,
  isGenerationReadOnly,
  normalizeEvidencePath,
  getDisplayOutput,
  GENERATION_STATUS_LABELS,
  GENERATION_STATUS_VARIANTS,
} from '../services/aiGenerations';
import { fetchSnapshotsForWorkspace } from '../services/analysisWorkspace';
import type {
  AnalysisGenerationRow,
  AnalysisInputSnapshotRow,
  OrganizationCapability,
} from '../lib/database.types';

type Props = {
  workspaceId: string;
  onRefresh?: () => void;
};

export default function GenerationReviewPanel({ workspaceId, onRefresh }: Props) {
  const { profile, capabilities } = useAuth();
  const [generations, setGenerations] = useState<AnalysisGenerationRow[]>([]);
  const [snapshots, setSnapshots] = useState<AnalysisInputSnapshotRow[]>([]);
  const [selectedGen, setSelectedGen] = useState<AnalysisGenerationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [gens, snaps] = await Promise.all([
        fetchGenerationsForWorkspace(workspaceId),
        fetchSnapshotsForWorkspace(workspaceId),
      ]);
      setGenerations(gens);
      setSnapshots(snaps);
      if (gens.length > 0 && !selectedGen) {
        setSelectedGen(gens[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load generations.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, selectedGen]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSelectGeneration = async (genId: string) => {
    try {
      const gen = await fetchGenerationById(genId);
      setSelectedGen(gen);
    } catch {
      setError('Failed to load generation.');
    }
  };

  const handleRefresh = async () => {
    await load();
    onRefresh?.();
  };

  const canReview = canReviewGeneration(capabilities);
  const canGen = canRegenerate(capabilities, generations);

  if (loading) return <LoadingState label="Loading AI generations…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  if (generations.length === 0) {
    return (
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-navy/60" />
          <span className="eyebrow">AI Generation History</span>
        </div>
        <p className="text-sm text-neutral-muted py-4">
          No AI generations yet. Create a snapshot and generate a strategy proof-of-concept to begin.
        </p>
        {canGen && snapshots.length > 0 && (
          <GenerateButton
            workspaceId={workspaceId}
            snapshotId={snapshots[0].id}
            createdBy={profile?.id ?? ''}
            onCreated={handleRefresh}
          />
        )}
      </Card>
    );
  }

  if (showReview && selectedGen) {
    return (
      <DraftReviewScreen
        generation={selectedGen}
        capabilities={capabilities}
        userId={profile?.id ?? ''}
        onBack={() => { setShowReview(false); handleRefresh(); }}
        onApprove={handleRefresh}
        onReject={handleRefresh}
        onSaveEdits={handleRefresh}
      />
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-navy/60" />
          <span className="eyebrow">AI Generation History</span>
        </div>
        {canGen && snapshots.length > 0 && (
          <GenerateButton
            workspaceId={workspaceId}
            snapshotId={snapshots[0].id}
            createdBy={profile?.id ?? ''}
            onCreated={handleRefresh}
          />
        )}
      </div>

      <div className="space-y-2">
        {generations.map((gen) => (
          <button
            key={gen.id}
            onClick={() => handleSelectGeneration(gen.id)}
            className={`w-full text-left rounded-md border p-3 transition ${
              selectedGen?.id === gen.id
                ? 'border-navy bg-navy/5'
                : 'border-neutral-border-soft hover:border-navy/30'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-navy">
                  {gen.generation_type === 'strategy_poc' ? 'Strategy POC' : gen.generation_type}
                </span>
                <Badge variant={GENERATION_STATUS_VARIANTS[gen.status]} dot>
                  {GENERATION_STATUS_LABELS[gen.status] ?? gen.status}
                </Badge>
                {isGenerationReadOnly(gen.status) && (
                  <span className="inline-flex items-center gap-1 text-xs text-neutral-muted">
                    <Lock className="w-3 h-3" /> Read-only
                  </span>
                )}
              </div>
              {canReview && gen.status === 'draft_generated' && (
                <ChevronRight className="w-4 h-4 text-neutral-muted" />
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-muted mt-2">
              <span className="inline-flex items-center gap-1">
                <Hash className="w-3 h-3" /> {gen.model_name}
              </span>
              <span>Prompt {gen.prompt_version}</span>
              <span>Snapshot v{gen.input_snapshot_version}</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" /> {new Date(gen.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </span>
              {gen.total_tokens != null && (
                <span>{gen.total_tokens} tokens</span>
              )}
            </div>
            {gen.reviewed_at && (
              <div className="flex items-center gap-1 text-xs text-neutral-muted mt-1">
                <User className="w-3 h-3" />
                Reviewed {new Date(gen.reviewed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                {gen.rejection_reason && (
                  <span className="text-red"> — {gen.rejection_reason}</span>
                )}
              </div>
            )}
            {gen.error_message && (
              <p className="text-xs text-red mt-1">{gen.error_message}</p>
            )}
          </button>
        ))}
      </div>

      {canReview && selectedGen && selectedGen.status === 'draft_generated' && (
        <div className="mt-4 pt-4 border-t border-neutral-border-soft">
          <Button size="sm" onClick={() => setShowReview(true)}>
            <FileText className="w-4 h-4" /> Review draft
          </Button>
        </div>
      )}
    </Card>
  );
}

// ============================================================
// Generate Button
// ============================================================

function GenerateButton({
  workspaceId,
  snapshotId,
  createdBy,
  onCreated,
}: {
  workspaceId: string;
  snapshotId: string;
  createdBy: string;
  onCreated: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setCreating(true);
    setError(null);
    try {
      await createGeneration({
        workspace_id: workspaceId,
        snapshot_id: snapshotId,
        created_by: createdBy,
        model_name: 'gpt-4o',
        prompt_version: 'strategy-poc-v2',
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create generation.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      {error && (
        <p className="text-xs text-red flex items-center gap-1.5 mb-2">
          <AlertCircle className="w-3.5 h-3.5" /> {error}
        </p>
      )}
      <Button size="sm" variant="outline" onClick={handleGenerate} disabled={creating}>
        <RefreshCw className={`w-4 h-4 ${creating ? 'animate-spin' : ''}`} />
        {creating ? 'Creating…' : 'New generation'}
      </Button>
    </div>
  );
}

// ============================================================
// Draft Review Screen
// ============================================================

type PrioritizedBarrier = {
  title: string;
  description: string;
};

type PriorityRecommendation = {
  title: string;
  why_this_matters: string;
  assessment_evidence: string;
  propel_knowledge_evidence: string;
  recommended_action: string;
  suggested_first_step: string;
  expected_strategic_impact: string;
  implementation_sequence: string;
  evidence_references: Array<{ path: string; label: string }>;
};

type SourceReference = {
  source_title: string;
  source_type: 'propel_knowledge';
  file_id: string | null;
};

type GenerationOutput = {
  executive_summary: string;
  maturity_interpretation: string;
  prioritized_barriers: PrioritizedBarrier[];
  priority_recommendations: PriorityRecommendation[];
  implementation_sequence: string[];
  client_discussion_questions: string[];
  limitations: string;
  source_references: SourceReference[];
  evidence_references: Array<{ path: string; label: string }>;
};

function parseOutput(gen: AnalysisGenerationRow): GenerationOutput | null {
  const raw = getDisplayOutput(gen);
  if (!raw) return null;
  return raw as unknown as GenerationOutput;
}

function DraftReviewScreen({
  generation,
  capabilities,
  userId,
  onBack,
  onApprove,
  onReject,
  onSaveEdits,
}: {
  generation: AnalysisGenerationRow;
  capabilities: Set<OrganizationCapability>;
  userId: string;
  onBack: () => void;
  onApprove: () => void;
  onReject: () => void;
  onSaveEdits: () => void;
}) {
  const output = parseOutput(generation);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Editable fields
  const [execSummary, setExecSummary] = useState(output?.executive_summary ?? '');
  const [maturityInterp, setMaturityInterp] = useState(output?.maturity_interpretation ?? '');
  const [barriers, setBarriers] = useState<PrioritizedBarrier[]>(output?.prioritized_barriers ?? []);
  const [recommendations, setRecommendations] = useState<PriorityRecommendation[]>(output?.priority_recommendations ?? []);
  const [implSequence, setImplSequence] = useState<string[]>(output?.implementation_sequence ?? []);
  const [questions, setQuestions] = useState<string[]>(output?.client_discussion_questions ?? []);
  const [limitations, setLimitations] = useState(output?.limitations ?? '');

  const readOnly = isGenerationReadOnly(generation.status);
  const canApproveGen = canApproveGeneration(capabilities);
  const canEditGen = canEditGeneration(capabilities);

  const handleSaveEdits = async () => {
    setSaving(true);
    setError(null);
    try {
      const reviewedOutput: GenerationOutput = {
        executive_summary: execSummary,
        maturity_interpretation: maturityInterp,
        prioritized_barriers: barriers,
        priority_recommendations: recommendations,
        implementation_sequence: implSequence,
        client_discussion_questions: questions,
        limitations,
        source_references: output?.source_references ?? [],
        evidence_references: output?.evidence_references ?? [],
      };
      await saveReviewEdits(generation.id, reviewedOutput);
      setEditMode(false);
      onSaveEdits();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save edits.');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    setError(null);
    try {
      const reviewedOutput: GenerationOutput = {
        executive_summary: execSummary,
        maturity_interpretation: maturityInterp,
        prioritized_barriers: barriers,
        priority_recommendations: recommendations,
        implementation_sequence: implSequence,
        client_discussion_questions: questions,
        limitations,
        source_references: output?.source_references ?? [],
        evidence_references: output?.evidence_references ?? [],
      };
      await approveGeneration(generation.id, userId, reviewedOutput);
      onApprove();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve.');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setError('A rejection reason is required.');
      return;
    }
    setRejecting(true);
    setError(null);
    try {
      await rejectGeneration(generation.id, userId, rejectReason);
      setRejectOpen(false);
      onReject();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject.');
    } finally {
      setRejecting(false);
    }
  };

  if (!output) {
    return (
      <Card>
        <p className="text-sm text-neutral-muted py-4">No output available for this generation.</p>
        <Button size="sm" variant="ghost" onClick={onBack}>Back</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={onBack} className="text-sm text-neutral-muted hover:text-navy">
              ← Back
            </button>
            <h3 className="text-base font-semibold text-navy">Draft Review</h3>
            <Badge variant={GENERATION_STATUS_VARIANTS[generation.status]} dot>
              {GENERATION_STATUS_LABELS[generation.status]}
            </Badge>
            {readOnly && (
              <span className="inline-flex items-center gap-1 text-xs text-neutral-muted">
                <Lock className="w-3.5 h-3.5" /> Read-only
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!readOnly && !editMode && canEditGen && (
              <Button size="sm" variant="ghost" onClick={() => setEditMode(true)}>
                <FileText className="w-4 h-4" /> Edit
              </Button>
            )}
            {!readOnly && editMode && (
              <Button size="sm" variant="ghost" onClick={handleSaveEdits} disabled={saving}>
                <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save edits'}
              </Button>
            )}
            {!readOnly && canApproveGen && (
              <>
                <Button size="sm" onClick={handleApprove} disabled={approving || saving}>
                  <CheckCircle2 className="w-4 h-4" /> {approving ? 'Approving…' : 'Approve'}
                </Button>
                <Button size="sm" variant="danger" onClick={() => setRejectOpen(true)}>
                  <XCircle className="w-4 h-4" /> Reject
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-neutral-border-soft flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-muted">
          <span className="inline-flex items-center gap-1"><Hash className="w-3 h-3" /> {generation.model_name}</span>
          <span>Prompt {generation.prompt_version}</span>
          <span>Snapshot v{generation.input_snapshot_version}</span>
          {generation.total_tokens != null && (
            <span>{generation.input_tokens ?? '—'} in / {generation.output_tokens ?? '—'} out / {generation.total_tokens} total tokens</span>
          )}
          {generation.reviewed_at && (
            <span className="inline-flex items-center gap-1">
              <User className="w-3 h-3" /> Reviewed {new Date(generation.reviewed_at).toLocaleString()}
            </span>
          )}
        </div>
      </Card>

      {error && (
        <div className="rounded-md border border-red/30 bg-red/5 p-3">
          <p className="text-sm text-red flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" /> {error}
          </p>
        </div>
      )}

      {/* Executive Summary */}
      <Card>
        <span className="eyebrow">Executive Summary</span>
        {editMode ? (
          <textarea
            value={execSummary}
            onChange={(e) => setExecSummary(e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-sm border border-neutral-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green/40"
          />
        ) : (
          <p className="mt-2 text-sm text-neutral-secondary leading-relaxed">{execSummary}</p>
        )}
      </Card>

      {/* Priority Recommendations */}
      <Card>
        <span className="eyebrow">Priority Recommendations ({recommendations.length})</span>
        <div className="mt-3 space-y-4">
          {recommendations.map((rec, idx) => (
            <div key={idx} className="rounded-md border border-neutral-border-soft p-3">
              <div className="flex items-start gap-2">
                <span className="text-xs font-bold text-neutral-muted mt-0.5">#{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  {editMode ? (
                    <input
                      type="text"
                      value={rec.title}
                      onChange={(e) => {
                        const next = [...recommendations];
                        next[idx] = { ...rec, title: e.target.value };
                        setRecommendations(next);
                      }}
                      className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm font-semibold text-navy focus:outline-none focus:ring-2 focus:ring-green/40"
                    />
                  ) : (
                    <p className="text-sm font-semibold text-navy">{rec.title}</p>
                  )}

                  <div className="mt-2">
                    <span className="text-xs font-medium text-neutral-muted uppercase tracking-wide">Rationale</span>
                    {editMode ? (
                      <textarea
                        value={rec.rationale}
                        onChange={(e) => {
                          const next = [...recommendations];
                          next[idx] = { ...rec, rationale: e.target.value };
                          setRecommendations(next);
                        }}
                        rows={2}
                        className="mt-1 w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40"
                      />
                    ) : (
                      <p className="text-sm text-neutral-secondary mt-0.5">{rec.rationale}</p>
                    )}
                  </div>

                  <div className="mt-2">
                    <span className="text-xs font-medium text-neutral-muted uppercase tracking-wide">Recommended Action</span>
                    {editMode ? (
                      <textarea
                        value={rec.recommended_action}
                        onChange={(e) => {
                          const next = [...recommendations];
                          next[idx] = { ...rec, recommended_action: e.target.value };
                          setRecommendations(next);
                        }}
                        rows={2}
                        className="mt-1 w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40"
                      />
                    ) : (
                      <p className="text-sm text-neutral-secondary mt-0.5">{rec.recommended_action}</p>
                    )}
                  </div>

                  {/* Evidence references (read-only) */}
                  {rec.evidence_references && rec.evidence_references.length > 0 && (
                    <div className="mt-2">
                      <span className="text-xs font-medium text-neutral-muted uppercase tracking-wide">Evidence</span>
                      <div className="mt-1 space-y-1">
                        {rec.evidence_references.map((ref, rIdx) => {
                          const canonical = normalizeEvidencePath(ref.path);
                          return (
                            <div key={rIdx} className="flex items-start gap-1.5 text-xs">
                              <Link2 className="w-3 h-3 text-green mt-0.5 shrink-0" />
                              <span className="text-neutral-secondary">{ref.label}</span>
                              <code className="text-neutral-muted font-mono text-[11px]">{canonical}</code>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Implementation Sequence */}
      {implSequence.length > 0 && (
        <Card>
          <span className="eyebrow">Implementation Sequence</span>
          <div className="mt-3 space-y-1.5">
            {implSequence.map((phase, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm">
                <span className="text-xs font-bold text-neutral-muted mt-0.5">{idx + 1}.</span>
                {editMode ? (
                  <input
                    type="text"
                    value={phase}
                    onChange={(e) => {
                      const next = [...implSequence];
                      next[idx] = e.target.value;
                      setImplSequence(next);
                    }}
                    className="flex-1 rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40"
                  />
                ) : (
                  <p className="text-neutral-secondary flex-1">{phase}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Client Discussion Questions */}
      <Card>
        <span className="eyebrow">Client Discussion Questions ({questions.length})</span>
        <div className="mt-3 space-y-2">
          {questions.map((q, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="text-xs font-bold text-neutral-muted mt-0.5">Q{idx + 1}</span>
              {editMode ? (
                <input
                  type="text"
                  value={q}
                  onChange={(e) => {
                    const next = [...questions];
                    next[idx] = e.target.value;
                    setQuestions(next);
                  }}
                  className="flex-1 rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40"
                />
              ) : (
                <p className="text-sm text-neutral-secondary flex-1">{q}</p>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Limitations */}
      <Card>
        <span className="eyebrow">Limitations</span>
        {editMode ? (
          <textarea
            value={limitations}
            onChange={(e) => setLimitations(e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-sm border border-neutral-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green/40"
          />
        ) : (
          <p className="mt-2 text-sm text-neutral-secondary leading-relaxed">{limitations}</p>
        )}
      </Card>

      {/* Source References (Propel Knowledge) */}
      {output.source_references && output.source_references.length > 0 && (
        <Card>
          <span className="eyebrow">Source References (Propel Knowledge)</span>
          <div className="mt-3 space-y-1.5">
            {output.source_references.map((ref, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm">
                <FileText className="w-4 h-4 text-green mt-0.5 shrink-0" />
                <div>
                  <span className="text-navy font-medium">{ref.source_title}</span>
                  <span className="text-xs text-neutral-muted ml-2">{ref.source_type}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Top-level Evidence References */}
      <Card>
        <span className="eyebrow">Evidence References</span>
        <div className="mt-3 space-y-1.5">
          {output.evidence_references?.map((ref, idx) => {
            const canonical = normalizeEvidencePath(ref.path);
            return (
              <div key={idx} className="flex items-start gap-2 text-sm">
                <Link2 className="w-4 h-4 text-green mt-0.5 shrink-0" />
                <div>
                  <span className="text-navy font-medium">{ref.label}</span>
                  <code className="block text-xs text-neutral-muted font-mono mt-0.5">{canonical}</code>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Rejection reason modal */}
      <ConfirmationModal
        open={rejectOpen}
        title="Reject this generation?"
        message={
          <div className="space-y-3">
            <p>Rejection is permanent. The generation will become read-only.</p>
            <div>
              <label className="block text-sm font-medium text-navy mb-1">
                Rejection reason <span className="text-red">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="Explain why this generation is being rejected…"
                className="w-full rounded-sm border border-neutral-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green/40"
              />
            </div>
          </div>
        }
        confirmLabel={rejecting ? 'Rejecting…' : 'Reject'}
        variant="danger"
        onCancel={() => { setRejectOpen(false); setRejectReason(''); }}
        onConfirm={handleReject}
      />
    </div>
  );
}

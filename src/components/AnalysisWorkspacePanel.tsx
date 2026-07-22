import { useState, useEffect, useCallback } from 'react';
import {
  Target,
  TrendingUp,
  FileText,
  Plus,
  Trash2,
  CheckCircle2,
  Lock,
  UserCog,
  ClipboardCheck,
  AlertCircle,
  Package,
  Activity,
  AlertTriangle,
  BookOpen,
} from 'lucide-react';
import Button from './ui/Button';
import Card from './ui/Card';
import Badge from './ui/Badge';
import EmptyState from './ui/EmptyState';
import LoadingState from './ui/LoadingState';
import ErrorState from './ui/ErrorState';
import ConfirmationModal from './ui/ConfirmationModal';
import { useAuth } from '../context/AuthContext';
import {
  fetchWorkspacesForClient,
  fetchWorkspaceById,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  approveWorkspace,
  finalizeWorkspace,
  createGoal,
  updateGoal,
  deleteGoal,
  createMetric,
  updateMetric,
  deleteMetric,
  createAnalysisNote,
  updateAnalysisNote,
  deleteAnalysisNote,
  canEditWorkspace,
  canApproveWorkspace,
  WORKSPACE_STATUS_LABELS,
  DATA_QUALITY_LABELS,
  NOTE_TYPE_LABELS,
  NOTE_VISIBILITY_LABELS,
  NOTE_IMPORTANCE_LABELS,
  PRIORITY_LABELS,
  SOURCE_TYPE_LABELS,
  GOAL_PRIORITIES,
  GOAL_SOURCE_TYPES,
  DATA_QUALITY_LEVELS,
  NOTE_TYPES,
  NOTE_VISIBILITIES,
  NOTE_IMPORTANCES,
  validateGoalInput,
  validateMetricInput,
  validateNoteInput,
  validateWorkspaceInput,
  fetchProgramsForClient,
  createProgram,
  updateProgram,
  deleteProgram,
  createUtilizationRecord,
  updateUtilizationRecord,
  deleteUtilizationRecord,
  createResourceGap,
  updateResourceGap,
  deleteResourceGap,
  createEvidenceSource,
  updateEvidenceSource,
  deleteEvidenceSource,
  validateProgramInput,
  validateUtilizationInput,
  validateGapInput,
  validateEvidenceInput,
  PROGRAM_STATUSES,
  PROGRAM_SOURCE_TYPES,
  PROGRAM_STATUS_LABELS,
  PROGRAM_SOURCE_TYPE_LABELS,
  UTILIZATION_STATUSES,
  UTILIZATION_STATUS_LABELS,
  GAP_CATEGORIES,
  GAP_EVIDENCE_SOURCES,
  GAP_SEVERITIES,
  GAP_CONFIDENCES,
  GAP_STATUSES,
  GAP_CATEGORY_LABELS,
  GAP_EVIDENCE_SOURCE_LABELS,
  GAP_SEVERITY_LABELS,
  GAP_CONFIDENCE_LABELS,
  GAP_STATUS_LABELS,
  EVIDENCE_SOURCE_TYPES,
  VERIFICATION_STATUSES,
  EVIDENCE_SOURCE_TYPE_LABELS,
  VERIFICATION_STATUS_LABELS,
} from '../services/analysisWorkspace';
import type {
  WorkspaceWithDetails,
  AnalysisWorkspaceRow,
  AnalysisOutcomeGoalRow,
  AnalysisOutcomeMetricRow,
  AnalysisNoteRow,
  WorkspaceStatus,
  OutcomeGoalPriority,
  OutcomeGoalSourceType,
  DataQualityLevel,
  AnalysisNoteType,
  AnalysisNoteVisibility,
  AnalysisNoteImportance,
  OrganizationCapability,
  ClientProgramRow,
  ProgramStatus,
  ProgramSourceType,
  ProgramUtilizationRecordRow,
  UtilizationStatus,
  AnalysisResourceGapRow,
  GapCategory,
  GapEvidenceSource,
  GapSeverity,
  GapConfidence,
  GapStatus,
  AnalysisEvidenceSourceRow,
  EvidenceSourceType,
  VerificationStatus,
} from '../lib/database.types';
import type { InstanceWithTemplate } from '../services/organizations';

type Props = {
  clientOrgId: string;
  instances: InstanceWithTemplate[];
};

export default function AnalysisWorkspacePanel({ clientOrgId, instances }: Props) {
  const { profile, capabilities } = useAuth();
  const [workspaces, setWorkspaces] = useState<AnalysisWorkspaceRow[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const ws = await fetchWorkspacesForClient(clientOrgId);
      setWorkspaces(ws);
      if (ws.length > 0 && !activeWorkspace) {
        const details = await fetchWorkspaceById(ws[0].id);
        setActiveWorkspace(details);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspaces.');
    } finally {
      setLoading(false);
    }
  }, [profile, clientOrgId, activeWorkspace]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSelectWorkspace = async (wsId: string) => {
    try {
      const details = await fetchWorkspaceById(wsId);
      setActiveWorkspace(details);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspace.');
    }
  };

  const handleCreate = async (title: string, assessmentInstanceId: string) => {
    if (!profile) return;
    try {
      await createWorkspace({
        client_organization_id: clientOrgId,
        assessment_instance_id: assessmentInstanceId,
        title,
        created_by: profile.id,
      });
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace.');
    }
  };

  const handleDelete = async (wsId: string) => {
    try {
      await deleteWorkspace(wsId);
      setActiveWorkspace(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete workspace.');
    }
  };

  const handleRefresh = async () => {
    if (activeWorkspace) {
      const details = await fetchWorkspaceById(activeWorkspace.id);
      setActiveWorkspace(details);
    }
    await load();
  };

  if (loading) {
    return <LoadingState label="Loading analysis workspaces…" />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  const finalizedInstances = instances.filter(
    (i) => i.status === 'submitted' || i.status === 'report_ready'
  );

  if (workspaces.length === 0 && !showCreate) {
    return (
      <EmptyState
        icon={Target}
        title="No Strategy Analysis workspaces"
        description="Create a workspace linked to a completed assessment to begin defining outcomes, metrics, and context."
        action={
          finalizedInstances.length > 0 ? (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" /> Create workspace
            </Button>
          ) : (
            <p className="text-xs text-neutral-muted max-w-sm">
              A completed assessment is required before creating a workspace.
            </p>
          )
        }
      />
    );
  }

  if (showCreate) {
    return (
      <CreateWorkspaceForm
        instances={finalizedInstances}
        onCreate={handleCreate}
        onCancel={() => setShowCreate(false)}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => handleSelectWorkspace(ws.id)}
              className={`px-3 py-1.5 rounded-sm text-sm font-medium border transition ${
                activeWorkspace?.id === ws.id
                  ? 'bg-navy text-white border-navy'
                  : 'bg-white text-navy border-neutral-border hover:border-navy/30'
              }`}
            >
              {ws.title}
            </button>
          ))}
        </div>
        {finalizedInstances.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> New workspace
          </Button>
        )}
      </div>

      {activeWorkspace && (
        <WorkspaceDetail
          workspace={activeWorkspace}
          capabilities={capabilities}
          userId={profile?.id ?? ''}
          onRefresh={handleRefresh}
          onDelete={() => handleDelete(activeWorkspace.id)}
        />
      )}
    </div>
  );
}

// ============================================================
// Create Workspace Form
// ============================================================

function CreateWorkspaceForm({
  instances,
  onCreate,
  onCancel,
}: {
  instances: InstanceWithTemplate[];
  onCreate: (title: string, assessmentInstanceId: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [instanceId, setInstanceId] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateWorkspaceInput({ title, assessment_instance_id: instanceId });
    if (err) {
      setValidationError(err);
      return;
    }
    onCreate(title, instanceId);
  };

  return (
    <Card>
      <span className="eyebrow">Create Strategy Analysis Workspace</span>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-navy mb-1">Workspace title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Q3 2026 Strategy Analysis"
            className="w-full rounded-sm border border-neutral-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green/40"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-navy mb-1">Assessment instance</label>
          <select
            value={instanceId}
            onChange={(e) => setInstanceId(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green/40"
          >
            <option value="">Select a completed assessment…</option>
            {instances.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.template?.name ?? 'Assessment'} — {inst.status} —{' '}
                {inst.submitted_at ? new Date(inst.submitted_at).toLocaleDateString() : 'N/A'}
              </option>
            ))}
          </select>
        </div>
        {validationError && (
          <p className="text-sm text-red flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" /> {validationError}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" size="sm">Create workspace</Button>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}

// ============================================================
// Workspace Detail
// ============================================================

function WorkspaceDetail({
  workspace,
  capabilities,
  userId,
  onRefresh,
  onDelete,
}: {
  workspace: WorkspaceWithDetails;
  capabilities: Set<OrganizationCapability>;
  userId: string;
  onRefresh: () => void;
  onDelete: () => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [programs, setPrograms] = useState<ClientProgramRow[]>([]);
  const editable = canEditWorkspace(capabilities, workspace.status);
  const canApprove = canApproveWorkspace(capabilities);
  const isFinalized = workspace.status === 'finalized';

  useEffect(() => {
    fetchProgramsForClient(workspace.client_organization_id)
      .then(setPrograms)
      .catch(() => { /* error handled by parent */ });
  }, [workspace.client_organization_id]);

  const statusVariant = (status: WorkspaceStatus) => {
    const map: Record<WorkspaceStatus, 'neutral' | 'info' | 'progress' | 'success' | 'warning' | 'danger'> = {
      draft: 'neutral',
      inputs_in_progress: 'info',
      ready_for_analysis: 'progress',
      analysis_generated: 'progress',
      under_review: 'warning',
      approved: 'success',
      finalized: 'success',
    };
    return map[status];
  };

  return (
    <div className="space-y-5">
      {/* Status bar */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-base font-semibold text-navy">{workspace.title}</h3>
            <Badge variant={statusVariant(workspace.status)} dot>
              {WORKSPACE_STATUS_LABELS[workspace.status]}
            </Badge>
            {isFinalized && (
              <span className="inline-flex items-center gap-1 text-xs text-neutral-muted">
                <Lock className="w-3.5 h-3.5" /> Read-only
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {editable && (
              <select
                value={workspace.status}
                onChange={async (e) => {
                  try {
                    await updateWorkspace(workspace.id, { status: e.target.value as WorkspaceStatus });
                    onRefresh();
                  } catch {
                    /* error handled by parent refresh */
                  }
                }}
                className="rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40"
              >
                {(Object.keys(WORKSPACE_STATUS_LABELS) as WorkspaceStatus[])
                  .filter((s) => s !== 'analysis_generated')
                  .map((s) => (
                  <option key={s} value={s}>{WORKSPACE_STATUS_LABELS[s]}</option>
                ))}
              </select>
            )}
            {canApprove && (workspace.status === 'under_review' || workspace.status === 'analysis_generated') && (
              <Button size="sm" variant="outline" onClick={async () => {
                try { await approveWorkspace(workspace.id); onRefresh(); } catch { /* */ }
              }}>
                <CheckCircle2 className="w-4 h-4" /> Approve
              </Button>
            )}
            {canApprove && (workspace.status === 'approved' || workspace.status === 'under_review') && (
              <Button size="sm" variant="secondary" onClick={async () => {
                try { await finalizeWorkspace(workspace.id); onRefresh(); } catch { /* */ }
              }}>
                <Lock className="w-4 h-4" /> Finalize
              </Button>
            )}
            {!isFinalized && (
              <Button size="sm" variant="ghost" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-neutral-border-soft flex items-center gap-2 text-sm text-neutral-muted">
          <UserCog className="w-4 h-4" />
          <span>Assignee: {workspace.assigned_to ?? 'Unassigned'}</span>
          <span className="text-neutral-border">|</span>
          <span>Created {new Date(workspace.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>
      </Card>

      {/* Assessment Summary (read-only) */}
      <Card>
        <span className="eyebrow">Assessment Summary</span>
        <div className="mt-3 grid sm:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-xs text-neutral-muted uppercase tracking-wide">Overall Score</span>
            <p className="font-mono text-lg font-bold text-navy tabular-nums">
              {workspace.assessment_instance?.overall_score != null
                ? `${Math.round(workspace.assessment_instance.overall_score)}/100`
                : '—'}
            </p>
          </div>
          <div>
            <span className="text-xs text-neutral-muted uppercase tracking-wide">Classification</span>
            <p className="text-navy font-medium">{workspace.assessment_instance?.primary_opportunity ?? '—'}</p>
          </div>
          <div>
            <span className="text-xs text-neutral-muted uppercase tracking-wide">Assessment Status</span>
            <p className="text-navy font-medium">{workspace.assessment_instance?.status ?? '—'}</p>
          </div>
        </div>
      </Card>

      {/* Desired Outcomes */}
      <DesiredOutcomesSection
        workspaceId={workspace.id}
        goals={workspace.goals}
        editable={editable}
        userId={userId}
        onRefresh={onRefresh}
      />

      {/* Outcome Metrics */}
      <OutcomeMetricsSection
        workspaceId={workspace.id}
        metrics={workspace.metrics}
        goals={workspace.goals}
        editable={editable}
        onRefresh={onRefresh}
      />

      {/* Programs and Resources */}
      <ProgramsSection
        clientOrgId={workspace.client_organization_id}
        programs={programs}
        editable={editable}
        onRefresh={onRefresh}
      />

      {/* Program Utilization */}
      <UtilizationSection
        workspaceId={workspace.id}
        utilizationRecords={workspace.utilizationRecords}
        programs={programs}
        editable={editable}
        onRefresh={onRefresh}
      />

      {/* Resource Gaps */}
      <ResourceGapsSection
        workspaceId={workspace.id}
        gaps={workspace.resourceGaps}
        editable={editable}
        userId={userId}
        onRefresh={onRefresh}
      />

      {/* Evidence Sources */}
      <EvidenceSourcesSection
        workspaceId={workspace.id}
        evidenceSources={workspace.evidenceSources}
        editable={editable}
        userId={userId}
        onRefresh={onRefresh}
      />

      {/* Context and Considerations */}
      <ContextNotesSection
        workspaceId={workspace.id}
        notes={workspace.notes}
        editable={editable}
        userId={userId}
        onRefresh={onRefresh}
      />

      <ConfirmationModal
        open={deleteOpen}
        title="Delete this workspace?"
        message={<>This will permanently delete <strong>{workspace.title}</strong> and all its inputs. This cannot be undone.</>}
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => { setDeleteOpen(false); onDelete(); }}
      />
    </div>
  );
}

// ============================================================
// Desired Outcomes Section
// ============================================================

function DesiredOutcomesSection({
  workspaceId,
  goals,
  editable,
  userId,
  onRefresh,
}: {
  workspaceId: string;
  goals: AnalysisOutcomeGoalRow[];
  editable: boolean;
  userId: string;
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleDelete = async (goalId: string) => {
    try {
      await deleteGoal(goalId);
      onRefresh();
    } catch { /* */ }
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-navy/60" />
          <span className="eyebrow">Desired Outcomes</span>
        </div>
        {editable && !showForm && (
          <Button size="sm" variant="ghost" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" /> Add outcome
          </Button>
        )}
      </div>

      {showForm && (
        <GoalForm
          workspaceId={workspaceId}
          userId={userId}
          onSaved={() => { setShowForm(false); onRefresh(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {editingId && (
        <GoalForm
          workspaceId={workspaceId}
          userId={userId}
          existingGoal={goals.find((g) => g.id === editingId)}
          onSaved={() => { setEditingId(null); onRefresh(); }}
          onCancel={() => setEditingId(null)}
        />
      )}

      {goals.length === 0 && !showForm && !editingId ? (
        <p className="text-sm text-neutral-muted py-4">No outcomes defined yet.</p>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => (
            <div key={goal.id} className="rounded-md border border-neutral-border-soft p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-navy">{goal.title}</span>
                    <Badge variant="neutral">{goal.outcome_category}</Badge>
                    <Badge variant={goal.priority === 'critical' ? 'danger' : goal.priority === 'high' ? 'warning' : 'neutral'}>
                      {PRIORITY_LABELS[goal.priority]}
                    </Badge>
                    <Badge variant="info">{SOURCE_TYPE_LABELS[goal.source_type]}</Badge>
                  </div>
                  {goal.description && <p className="text-sm text-neutral-secondary mt-1">{goal.description}</p>}
                  <div className="flex gap-4 mt-2 text-xs text-neutral-muted">
                    {goal.target_population && <span>Population: {goal.target_population}</span>}
                    {goal.desired_timeframe && <span>Timeframe: {goal.desired_timeframe}</span>}
                  </div>
                </div>
                {editable && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setEditingId(goal.id)} className="text-neutral-muted hover:text-navy p-1">
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(goal.id)} className="text-neutral-muted hover:text-red p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function GoalForm({
  workspaceId,
  userId,
  existingGoal,
  onSaved,
  onCancel,
}: {
  workspaceId: string;
  userId: string;
  existingGoal?: AnalysisOutcomeGoalRow;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [outcomeCategory, setOutcomeCategory] = useState(existingGoal?.outcome_category ?? '');
  const [title, setTitle] = useState(existingGoal?.title ?? '');
  const [description, setDescription] = useState(existingGoal?.description ?? '');
  const [priority, setPriority] = useState<OutcomeGoalPriority>(existingGoal?.priority ?? 'medium');
  const [targetPopulation, setTargetPopulation] = useState(existingGoal?.target_population ?? '');
  const [desiredTimeframe, setDesiredTimeframe] = useState(existingGoal?.desired_timeframe ?? '');
  const [sourceType, setSourceType] = useState<OutcomeGoalSourceType>(existingGoal?.source_type ?? 'analyst');
  const [sourceNote, setSourceNote] = useState(existingGoal?.source_note ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateGoalInput({ outcome_category: outcomeCategory, title, priority, source_type: sourceType });
    if (err) { setValidationError(err); return; }

    try {
      if (existingGoal) {
        await updateGoal(existingGoal.id, {
          outcome_category: outcomeCategory,
          title,
          description: description || null,
          priority,
          target_population: targetPopulation || null,
          desired_timeframe: desiredTimeframe || null,
          source_type: sourceType,
          source_note: sourceNote || null,
        });
      } else {
        await createGoal({
          workspace_id: workspaceId,
          outcome_category: outcomeCategory,
          title,
          description: description || undefined,
          priority,
          target_population: targetPopulation || undefined,
          desired_timeframe: desiredTimeframe || undefined,
          source_type: sourceType,
          source_note: sourceNote || undefined,
          created_by: userId,
        });
      }
      onSaved();
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Failed to save outcome.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-green/20 bg-green-tint/30 p-4 mb-3 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Outcome Category *</label>
          <input type="text" value={outcomeCategory} onChange={(e) => setOutcomeCategory(e.target.value)}
            placeholder="e.g. Employee Health, Cost Containment"
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Title *</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-navy mb-1">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
          className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Priority</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value as OutcomeGoalPriority)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40">
            {GOAL_PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Source Type</label>
          <select value={sourceType} onChange={(e) => setSourceType(e.target.value as OutcomeGoalSourceType)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40">
            {GOAL_SOURCE_TYPES.map((s) => <option key={s} value={s}>{SOURCE_TYPE_LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Desired Timeframe</label>
          <input type="text" value={desiredTimeframe} onChange={(e) => setDesiredTimeframe(e.target.value)}
            placeholder="e.g. Q4 2026"
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Target Population</label>
          <input type="text" value={targetPopulation} onChange={(e) => setTargetPopulation(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Source Note</label>
          <input type="text" value={sourceNote} onChange={(e) => setSourceNote(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
      </div>
      {validationError && (
        <p className="text-sm text-red flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {validationError}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm">{existingGoal ? 'Update' : 'Add'} outcome</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

// ============================================================
// Outcome Metrics Section
// ============================================================

function OutcomeMetricsSection({
  workspaceId,
  metrics,
  goals,
  editable,
  onRefresh,
}: {
  workspaceId: string;
  metrics: AnalysisOutcomeMetricRow[];
  goals: AnalysisOutcomeGoalRow[];
  editable: boolean;
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleDelete = async (metricId: string) => {
    try { await deleteMetric(metricId); onRefresh(); } catch { /* */ }
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-navy/60" />
          <span className="eyebrow">Outcome Metrics</span>
        </div>
        {editable && !showForm && (
          <Button size="sm" variant="ghost" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" /> Add metric
          </Button>
        )}
      </div>

      {showForm && (
        <MetricForm
          workspaceId={workspaceId}
          goals={goals}
          onSaved={() => { setShowForm(false); onRefresh(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {editingId && (
        <MetricForm
          workspaceId={workspaceId}
          goals={goals}
          existingMetric={metrics.find((m) => m.id === editingId)}
          onSaved={() => { setEditingId(null); onRefresh(); }}
          onCancel={() => setEditingId(null)}
        />
      )}

      {metrics.length === 0 && !showForm && !editingId ? (
        <p className="text-sm text-neutral-muted py-4">No metrics defined yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-border-soft text-left">
                <th className="py-2 pr-4 font-medium text-neutral-muted">Metric</th>
                <th className="py-2 pr-4 font-medium text-neutral-muted">Current</th>
                <th className="py-2 pr-4 font-medium text-neutral-muted">Target</th>
                <th className="py-2 pr-4 font-medium text-neutral-muted">Data Quality</th>
                <th className="py-2 pr-4 font-medium text-neutral-muted">Goal</th>
                {editable && <th className="py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.id} className="border-b border-neutral-border-soft">
                  <td className="py-2 pr-4">
                    <span className="font-medium text-navy">{m.metric_name}</span>
                    {m.metric_category && <span className="text-xs text-neutral-muted block">{m.metric_category}</span>}
                  </td>
                  <td className="py-2 pr-4 text-navy">{m.current_value ?? '—'}{m.unit ? ` ${m.unit}` : ''}</td>
                  <td className="py-2 pr-4 text-navy">{m.target_value ?? '—'}{m.unit ? ` ${m.unit}` : ''}</td>
                  <td className="py-2 pr-4">
                    <Badge variant={m.data_quality === 'verified' ? 'success' : m.data_quality === 'incomplete' ? 'warning' : 'neutral'}>
                      {DATA_QUALITY_LABELS[m.data_quality]}
                    </Badge>
                  </td>
                  <td className="py-2 pr-4 text-neutral-secondary">
                    {m.outcome_goal_id ? goals.find((g) => g.id === m.outcome_goal_id)?.title ?? '—' : '—'}
                  </td>
                  {editable && (
                    <td className="py-2">
                      <div className="flex gap-1">
                        <button onClick={() => setEditingId(m.id)} className="text-neutral-muted hover:text-navy p-1">
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(m.id)} className="text-neutral-muted hover:text-red p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function MetricForm({
  workspaceId,
  goals,
  existingMetric,
  onSaved,
  onCancel,
}: {
  workspaceId: string;
  goals: AnalysisOutcomeGoalRow[];
  existingMetric?: AnalysisOutcomeMetricRow;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [metricName, setMetricName] = useState(existingMetric?.metric_name ?? '');
  const [metricCategory, setMetricCategory] = useState(existingMetric?.metric_category ?? '');
  const [currentValue, setCurrentValue] = useState(existingMetric?.current_value ?? '');
  const [targetValue, setTargetValue] = useState(existingMetric?.target_value ?? '');
  const [unit, setUnit] = useState(existingMetric?.unit ?? '');
  const [measurementPeriod, setMeasurementPeriod] = useState(existingMetric?.measurement_period ?? '');
  const [populationDescription, setPopulationDescription] = useState(existingMetric?.population_description ?? '');
  const [dataSource, setDataSource] = useState(existingMetric?.data_source ?? '');
  const [dataQuality, setDataQuality] = useState<DataQualityLevel>(existingMetric?.data_quality ?? 'unknown');
  const [outcomeGoalId, setOutcomeGoalId] = useState(existingMetric?.outcome_goal_id ?? '');
  const [notes, setNotes] = useState(existingMetric?.notes ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateMetricInput({ metric_name: metricName, data_quality: dataQuality });
    if (err) { setValidationError(err); return; }

    try {
      if (existingMetric) {
        await updateMetric(existingMetric.id, {
          metric_name: metricName,
          metric_category: metricCategory || null,
          current_value: currentValue || null,
          target_value: targetValue || null,
          unit: unit || null,
          measurement_period: measurementPeriod || null,
          population_description: populationDescription || null,
          data_source: dataSource || null,
          data_quality: dataQuality,
          outcome_goal_id: outcomeGoalId || null,
          notes: notes || null,
        });
      } else {
        await createMetric({
          workspace_id: workspaceId,
          metric_name: metricName,
          metric_category: metricCategory || undefined,
          current_value: currentValue || undefined,
          target_value: targetValue || undefined,
          unit: unit || undefined,
          measurement_period: measurementPeriod || undefined,
          population_description: populationDescription || undefined,
          data_source: dataSource || undefined,
          data_quality: dataQuality,
          outcome_goal_id: outcomeGoalId || undefined,
          notes: notes || undefined,
        });
      }
      onSaved();
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Failed to save metric.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-green/20 bg-green-tint/30 p-4 mb-3 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Metric Name *</label>
          <input type="text" value={metricName} onChange={(e) => setMetricName(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Category</label>
          <input type="text" value={metricCategory} onChange={(e) => setMetricCategory(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
      </div>
      <div className="grid sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Current Value</label>
          <input type="text" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Target Value</label>
          <input type="text" value={targetValue} onChange={(e) => setTargetValue(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Unit</label>
          <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. %, $, days"
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Data Quality</label>
          <select value={dataQuality} onChange={(e) => setDataQuality(e.target.value as DataQualityLevel)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40">
            {DATA_QUALITY_LEVELS.map((d) => <option key={d} value={d}>{DATA_QUALITY_LABELS[d]}</option>)}
          </select>
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Measurement Period</label>
          <input type="text" value={measurementPeriod} onChange={(e) => setMeasurementPeriod(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Population</label>
          <input type="text" value={populationDescription} onChange={(e) => setPopulationDescription(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Data Source</label>
          <input type="text" value={dataSource} onChange={(e) => setDataSource(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-navy mb-1">Linked Outcome Goal</label>
        <select value={outcomeGoalId} onChange={(e) => setOutcomeGoalId(e.target.value)}
          className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40">
          <option value="">None</option>
          {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-navy mb-1">Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
      </div>
      {validationError && (
        <p className="text-sm text-red flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {validationError}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm">{existingMetric ? 'Update' : 'Add'} metric</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

// ============================================================
// Context and Considerations Section
// ============================================================

function ContextNotesSection({
  workspaceId,
  notes,
  editable,
  userId,
  onRefresh,
}: {
  workspaceId: string;
  notes: AnalysisNoteRow[];
  editable: boolean;
  userId: string;
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleDelete = async (noteId: string) => {
    try { await deleteAnalysisNote(noteId); onRefresh(); } catch { /* */ }
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-navy/60" />
          <span className="eyebrow">Context and Considerations</span>
        </div>
        {editable && !showForm && (
          <Button size="sm" variant="ghost" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" /> Add note
          </Button>
        )}
      </div>

      {showForm && (
        <NoteForm
          workspaceId={workspaceId}
          userId={userId}
          onSaved={() => { setShowForm(false); onRefresh(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {editingId && (
        <NoteForm
          workspaceId={workspaceId}
          userId={userId}
          existingNote={notes.find((n) => n.id === editingId)}
          onSaved={() => { setEditingId(null); onRefresh(); }}
          onCancel={() => setEditingId(null)}
        />
      )}

      {notes.length === 0 && !showForm && !editingId ? (
        <p className="text-sm text-neutral-muted py-4">No context notes defined yet.</p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} className="rounded-md border border-neutral-border-soft p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="info">{NOTE_TYPE_LABELS[note.note_type]}</Badge>
                    <Badge variant="neutral">{NOTE_VISIBILITY_LABELS[note.visibility]}</Badge>
                    <Badge variant={note.importance === 'critical' ? 'danger' : note.importance === 'high' ? 'warning' : 'neutral'}>
                      {NOTE_IMPORTANCE_LABELS[note.importance]}
                    </Badge>
                  </div>
                  {note.title && <p className="text-sm font-semibold text-navy mt-1.5">{note.title}</p>}
                  <p className="text-sm text-neutral-secondary mt-1">{note.content}</p>
                </div>
                {editable && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setEditingId(note.id)} className="text-neutral-muted hover:text-navy p-1">
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(note.id)} className="text-neutral-muted hover:text-red p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function NoteForm({
  workspaceId,
  userId,
  existingNote,
  onSaved,
  onCancel,
}: {
  workspaceId: string;
  userId: string;
  existingNote?: AnalysisNoteRow;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [noteType, setNoteType] = useState<AnalysisNoteType>(existingNote?.note_type ?? 'organization_context');
  const [title, setTitle] = useState(existingNote?.title ?? '');
  const [content, setContent] = useState(existingNote?.content ?? '');
  const [visibility, setVisibility] = useState<AnalysisNoteVisibility>(existingNote?.visibility ?? 'internal');
  const [importance, setImportance] = useState<AnalysisNoteImportance>(existingNote?.importance ?? 'normal');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateNoteInput({ note_type: noteType, content, visibility, importance });
    if (err) { setValidationError(err); return; }

    try {
      if (existingNote) {
        await updateAnalysisNote(existingNote.id, {
          note_type: noteType,
          title: title || null,
          content,
          visibility,
          importance,
        });
      } else {
        await createAnalysisNote({
          workspace_id: workspaceId,
          note_type: noteType,
          title: title || undefined,
          content,
          visibility,
          importance,
          created_by: userId,
        });
      }
      onSaved();
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Failed to save note.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-green/20 bg-green-tint/30 p-4 mb-3 space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Note Type *</label>
          <select value={noteType} onChange={(e) => setNoteType(e.target.value as AnalysisNoteType)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40">
            {NOTE_TYPES.map((t) => <option key={t} value={t}>{NOTE_TYPE_LABELS[t]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Visibility</label>
          <select value={visibility} onChange={(e) => setVisibility(e.target.value as AnalysisNoteVisibility)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40">
            {NOTE_VISIBILITIES.map((v) => <option key={v} value={v}>{NOTE_VISIBILITY_LABELS[v]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Importance</label>
          <select value={importance} onChange={(e) => setImportance(e.target.value as AnalysisNoteImportance)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40">
            {NOTE_IMPORTANCES.map((i) => <option key={i} value={i}>{NOTE_IMPORTANCE_LABELS[i]}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-navy mb-1">Title</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
      </div>
      <div>
        <label className="block text-xs font-medium text-navy mb-1">Content *</label>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3}
          className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
      </div>
      {validationError && (
        <p className="text-sm text-red flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {validationError}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm">{existingNote ? 'Update' : 'Add'} note</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

// ============================================================
// Programs and Resources Section
// ============================================================

function ProgramsSection({
  clientOrgId,
  programs,
  editable,
  onRefresh,
}: {
  clientOrgId: string;
  programs: ClientProgramRow[];
  editable: boolean;
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleDelete = async (programId: string) => {
    try { await deleteProgram(programId); onRefresh(); } catch { /* */ }
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-navy/60" />
          <span className="eyebrow">Programs and Resources</span>
        </div>
        {editable && !showForm && (
          <Button size="sm" variant="ghost" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" /> Add program
          </Button>
        )}
      </div>

      {showForm && (
        <ProgramForm
          clientOrgId={clientOrgId}
          onSaved={() => { setShowForm(false); onRefresh(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {editingId && (
        <ProgramForm
          clientOrgId={clientOrgId}
          existingProgram={programs.find((p) => p.id === editingId)}
          onSaved={() => { setEditingId(null); onRefresh(); }}
          onCancel={() => setEditingId(null)}
        />
      )}

      {programs.length === 0 && !showForm && !editingId ? (
        <p className="text-sm text-neutral-muted py-4">No programs defined yet. Programs belong to the client and can be reused across workspaces.</p>
      ) : (
        <div className="space-y-3">
          {programs.map((p) => (
            <div key={p.id} className="rounded-md border border-neutral-border-soft p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-navy">{p.program_name}</span>
                    <Badge variant="neutral">{p.program_category}</Badge>
                    <Badge variant={p.status === 'active' ? 'success' : p.status === 'paused' ? 'warning' : 'neutral'}>
                      {PROGRAM_STATUS_LABELS[p.status]}
                    </Badge>
                    {p.incentive_connected && <Badge variant="info">Incentive-linked</Badge>}
                  </div>
                  {p.provider_name && <p className="text-xs text-neutral-muted mt-0.5">Provider: {p.provider_name}</p>}
                  {p.description && <p className="text-sm text-neutral-secondary mt-1">{p.description}</p>}
                  <div className="flex gap-4 mt-2 text-xs text-neutral-muted flex-wrap">
                    {p.target_population && <span>Population: {p.target_population}</span>}
                    {p.access_method && <span>Access: {p.access_method}</span>}
                    {p.start_date && <span>Started: {new Date(p.start_date).toLocaleDateString()}</span>}
                  </div>
                </div>
                {editable && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setEditingId(p.id)} className="text-neutral-muted hover:text-navy p-1">
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="text-neutral-muted hover:text-red p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ProgramForm({
  clientOrgId,
  existingProgram,
  onSaved,
  onCancel,
}: {
  clientOrgId: string;
  existingProgram?: ClientProgramRow;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [programName, setProgramName] = useState(existingProgram?.program_name ?? '');
  const [providerName, setProviderName] = useState(existingProgram?.provider_name ?? '');
  const [programCategory, setProgramCategory] = useState(existingProgram?.program_category ?? '');
  const [description, setDescription] = useState(existingProgram?.description ?? '');
  const [targetPopulation, setTargetPopulation] = useState(existingProgram?.target_population ?? '');
  const [eligibilitySummary, setEligibilitySummary] = useState(existingProgram?.eligibility_summary ?? '');
  const [accessMethod, setAccessMethod] = useState(existingProgram?.access_method ?? '');
  const [communicationChannels, setCommunicationChannels] = useState(existingProgram?.communication_channels ?? '');
  const [incentiveConnected, setIncentiveConnected] = useState(existingProgram?.incentive_connected ?? false);
  const [status, setStatus] = useState<ProgramStatus>(existingProgram?.status ?? 'active');
  const [startDate, setStartDate] = useState(existingProgram?.start_date ?? '');
  const [endDate, setEndDate] = useState(existingProgram?.end_date ?? '');
  const [sourceType, setSourceType] = useState<ProgramSourceType>(existingProgram?.source_type ?? 'client_reported');
  const [sourceNote, setSourceNote] = useState(existingProgram?.source_note ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateProgramInput({ program_name: programName, program_category: programCategory, status, source_type: sourceType });
    if (err) { setValidationError(err); return; }

    try {
      if (existingProgram) {
        await updateProgram(existingProgram.id, {
          program_name: programName,
          provider_name: providerName || null,
          program_category: programCategory,
          description: description || null,
          target_population: targetPopulation || null,
          eligibility_summary: eligibilitySummary || null,
          access_method: accessMethod || null,
          communication_channels: communicationChannels || null,
          incentive_connected: incentiveConnected,
          status,
          start_date: startDate || null,
          end_date: endDate || null,
          source_type: sourceType,
          source_note: sourceNote || null,
        });
      } else {
        await createProgram({
          client_organization_id: clientOrgId,
          program_name: programName,
          program_category: programCategory,
          provider_name: providerName || undefined,
          description: description || undefined,
          target_population: targetPopulation || undefined,
          eligibility_summary: eligibilitySummary || undefined,
          access_method: accessMethod || undefined,
          communication_channels: communicationChannels || undefined,
          incentive_connected: incentiveConnected,
          status,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          source_type: sourceType,
          source_note: sourceNote || undefined,
        });
      }
      onSaved();
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Failed to save program.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-green/20 bg-green-tint/30 p-4 mb-3 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Program Name *</label>
          <input type="text" value={programName} onChange={(e) => setProgramName(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Provider</label>
          <input type="text" value={providerName} onChange={(e) => setProviderName(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Category *</label>
          <input type="text" value={programCategory} onChange={(e) => setProgramCategory(e.target.value)}
            placeholder="e.g. Wellness, EAP, Mental Health"
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as ProgramStatus)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40">
            {PROGRAM_STATUSES.map((s) => <option key={s} value={s}>{PROGRAM_STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Source Type</label>
          <select value={sourceType} onChange={(e) => setSourceType(e.target.value as ProgramSourceType)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40">
            {PROGRAM_SOURCE_TYPES.map((s) => <option key={s} value={s}>{PROGRAM_SOURCE_TYPE_LABELS[s]}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-navy mb-1">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
          className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Target Population</label>
          <input type="text" value={targetPopulation} onChange={(e) => setTargetPopulation(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Eligibility Summary</label>
          <input type="text" value={eligibilitySummary} onChange={(e) => setEligibilitySummary(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Access Method</label>
          <input type="text" value={accessMethod} onChange={(e) => setAccessMethod(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Communication Channels</label>
          <input type="text" value={communicationChannels} onChange={(e) => setCommunicationChannels(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Start Date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">End Date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-navy">
            <input type="checkbox" checked={incentiveConnected} onChange={(e) => setIncentiveConnected(e.target.checked)}
              className="rounded border-neutral-border" />
            Incentive-connected
          </label>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-navy mb-1">Source Note</label>
        <input type="text" value={sourceNote} onChange={(e) => setSourceNote(e.target.value)}
          className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
      </div>
      {validationError && (
        <p className="text-sm text-red flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {validationError}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm">{existingProgram ? 'Update' : 'Add'} program</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

// ============================================================
// Program Utilization Section
// ============================================================

function UtilizationSection({
  workspaceId,
  utilizationRecords,
  programs,
  editable,
  onRefresh,
}: {
  workspaceId: string;
  utilizationRecords: ProgramUtilizationRecordRow[];
  programs: ClientProgramRow[];
  editable: boolean;
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleDelete = async (recordId: string) => {
    try { await deleteUtilizationRecord(recordId); onRefresh(); } catch { /* */ }
  };

  const programName = (id: string) => programs.find((p) => p.id === id)?.program_name ?? 'Unknown program';

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-navy/60" />
          <span className="eyebrow">Program Utilization</span>
        </div>
        {editable && !showForm && programs.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" /> Add utilization record
          </Button>
        )}
      </div>

      {showForm && (
        <UtilizationForm
          workspaceId={workspaceId}
          programs={programs}
          onSaved={() => { setShowForm(false); onRefresh(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {editingId && (
        <UtilizationForm
          workspaceId={workspaceId}
          programs={programs}
          existingRecord={utilizationRecords.find((r) => r.id === editingId)}
          onSaved={() => { setEditingId(null); onRefresh(); }}
          onCancel={() => setEditingId(null)}
        />
      )}

      {utilizationRecords.length === 0 && !showForm && !editingId ? (
        <p className="text-sm text-neutral-muted py-4">
          {programs.length === 0 ? 'Add programs first before recording utilization data.' : 'No utilization records yet.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-border-soft text-left">
                <th className="py-2 pr-4 font-medium text-neutral-muted">Program</th>
                <th className="py-2 pr-4 font-medium text-neutral-muted">Eligible</th>
                <th className="py-2 pr-4 font-medium text-neutral-muted">Active</th>
                <th className="py-2 pr-4 font-medium text-neutral-muted">Rate</th>
                <th className="py-2 pr-4 font-medium text-neutral-muted">Status</th>
                <th className="py-2 pr-4 font-medium text-neutral-muted">Data Quality</th>
                {editable && <th className="py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {utilizationRecords.map((r) => (
                <tr key={r.id} className="border-b border-neutral-border-soft">
                  <td className="py-2 pr-4 font-medium text-navy">{programName(r.client_program_id)}</td>
                  <td className="py-2 pr-4 text-navy">{r.eligible_population ?? '—'}</td>
                  <td className="py-2 pr-4 text-navy">{r.active_user_count ?? '—'}</td>
                  <td className="py-2 pr-4 text-navy">{r.utilization_rate != null ? `${r.utilization_rate}%` : '—'}</td>
                  <td className="py-2 pr-4">
                    <Badge variant={r.utilization_status === 'high' ? 'success' : r.utilization_status === 'low' ? 'warning' : 'neutral'}>
                      {UTILIZATION_STATUS_LABELS[r.utilization_status]}
                    </Badge>
                  </td>
                  <td className="py-2 pr-4">
                    <Badge variant={r.data_quality === 'verified' ? 'success' : r.data_quality === 'incomplete' ? 'warning' : 'neutral'}>
                      {DATA_QUALITY_LABELS[r.data_quality]}
                    </Badge>
                  </td>
                  {editable && (
                    <td className="py-2">
                      <div className="flex gap-1">
                        <button onClick={() => setEditingId(r.id)} className="text-neutral-muted hover:text-navy p-1">
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(r.id)} className="text-neutral-muted hover:text-red p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function UtilizationForm({
  workspaceId,
  programs,
  existingRecord,
  onSaved,
  onCancel,
}: {
  workspaceId: string;
  programs: ClientProgramRow[];
  existingRecord?: ProgramUtilizationRecordRow;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [clientProgramId, setClientProgramId] = useState(existingRecord?.client_program_id ?? '');
  const [measurementStart, setMeasurementStart] = useState(existingRecord?.measurement_start ?? '');
  const [measurementEnd, setMeasurementEnd] = useState(existingRecord?.measurement_end ?? '');
  const [eligiblePopulation, setEligiblePopulation] = useState(existingRecord?.eligible_population?.toString() ?? '');
  const [registeredCount, setRegisteredCount] = useState(existingRecord?.registered_count?.toString() ?? '');
  const [activeUserCount, setActiveUserCount] = useState(existingRecord?.active_user_count?.toString() ?? '');
  const [completionCount, setCompletionCount] = useState(existingRecord?.completion_count?.toString() ?? '');
  const [utilizationRate, setUtilizationRate] = useState(existingRecord?.utilization_rate?.toString() ?? '');
  const [repeatEngagementRate, setRepeatEngagementRate] = useState(existingRecord?.repeat_engagement_rate?.toString() ?? '');
  const [benchmarkValue, setBenchmarkValue] = useState(existingRecord?.benchmark_value ?? '');
  const [benchmarkSource, setBenchmarkSource] = useState(existingRecord?.benchmark_source ?? '');
  const [utilizationStatus, setUtilizationStatus] = useState<UtilizationStatus>(existingRecord?.utilization_status ?? 'not_measured');
  const [dataQuality, setDataQuality] = useState<DataQualityLevel>(existingRecord?.data_quality ?? 'unknown');
  const [notes, setNotes] = useState(existingRecord?.notes ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateUtilizationInput({ client_program_id: clientProgramId, utilization_status: utilizationStatus, data_quality: dataQuality });
    if (err) { setValidationError(err); return; }

    try {
      const numOrUndef = (v: string) => v ? Number(v) : undefined;
      if (existingRecord) {
        await updateUtilizationRecord(existingRecord.id, {
          measurement_start: measurementStart || null,
          measurement_end: measurementEnd || null,
          eligible_population: eligiblePopulation ? Number(eligiblePopulation) : null,
          registered_count: registeredCount ? Number(registeredCount) : null,
          active_user_count: activeUserCount ? Number(activeUserCount) : null,
          completion_count: completionCount ? Number(completionCount) : null,
          utilization_rate: utilizationRate ? Number(utilizationRate) : null,
          repeat_engagement_rate: repeatEngagementRate ? Number(repeatEngagementRate) : null,
          benchmark_value: benchmarkValue || null,
          benchmark_source: benchmarkSource || null,
          utilization_status: utilizationStatus,
          data_quality: dataQuality,
          notes: notes || null,
        });
      } else {
        await createUtilizationRecord({
          workspace_id: workspaceId,
          client_program_id: clientProgramId,
          measurement_start: measurementStart || undefined,
          measurement_end: measurementEnd || undefined,
          eligible_population: numOrUndef(eligiblePopulation),
          registered_count: numOrUndef(registeredCount),
          active_user_count: numOrUndef(activeUserCount),
          completion_count: numOrUndef(completionCount),
          utilization_rate: utilizationRate ? Number(utilizationRate) : undefined,
          repeat_engagement_rate: repeatEngagementRate ? Number(repeatEngagementRate) : undefined,
          benchmark_value: benchmarkValue || undefined,
          benchmark_source: benchmarkSource || undefined,
          utilization_status: utilizationStatus,
          data_quality: dataQuality,
          notes: notes || undefined,
        });
      }
      onSaved();
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Failed to save utilization record.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-green/20 bg-green-tint/30 p-4 mb-3 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Program *</label>
          <select value={clientProgramId} onChange={(e) => setClientProgramId(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40">
            <option value="">Select a program…</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.program_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Utilization Status</label>
          <select value={utilizationStatus} onChange={(e) => setUtilizationStatus(e.target.value as UtilizationStatus)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40">
            {UTILIZATION_STATUSES.map((s) => <option key={s} value={s}>{UTILIZATION_STATUS_LABELS[s]}</option>)}
          </select>
        </div>
      </div>
      <div className="grid sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Eligible Population</label>
          <input type="number" value={eligiblePopulation} onChange={(e) => setEligiblePopulation(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Registered</label>
          <input type="number" value={registeredCount} onChange={(e) => setRegisteredCount(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Active Users</label>
          <input type="number" value={activeUserCount} onChange={(e) => setActiveUserCount(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Completions</label>
          <input type="number" value={completionCount} onChange={(e) => setCompletionCount(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
      </div>
      <div className="grid sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Utilization Rate (%)</label>
          <input type="number" step="0.01" value={utilizationRate} onChange={(e) => setUtilizationRate(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Repeat Engagement (%)</label>
          <input type="number" step="0.01" value={repeatEngagementRate} onChange={(e) => setRepeatEngagementRate(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Measurement Start</label>
          <input type="date" value={measurementStart} onChange={(e) => setMeasurementStart(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Measurement End</label>
          <input type="date" value={measurementEnd} onChange={(e) => setMeasurementEnd(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
      </div>
      <div className="grid sm:grid-cols3 gap-3">
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Benchmark Value</label>
          <input type="text" value={benchmarkValue} onChange={(e) => setBenchmarkValue(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Benchmark Source</label>
          <input type="text" value={benchmarkSource} onChange={(e) => setBenchmarkSource(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Data Quality</label>
          <select value={dataQuality} onChange={(e) => setDataQuality(e.target.value as DataQualityLevel)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40">
            {DATA_QUALITY_LEVELS.map((d) => <option key={d} value={d}>{DATA_QUALITY_LABELS[d]}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-navy mb-1">Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
      </div>
      {validationError && (
        <p className="text-sm text-red flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {validationError}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm">{existingRecord ? 'Update' : 'Add'} utilization record</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

// ============================================================
// Resource Gaps Section
// ============================================================

function ResourceGapsSection({
  workspaceId,
  gaps,
  editable,
  userId,
  onRefresh,
}: {
  workspaceId: string;
  gaps: AnalysisResourceGapRow[];
  editable: boolean;
  userId: string;
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleDelete = async (gapId: string) => {
    try { await deleteResourceGap(gapId); onRefresh(); } catch { /* */ }
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-navy/60" />
          <span className="eyebrow">Resource Gaps</span>
        </div>
        {editable && !showForm && (
          <Button size="sm" variant="ghost" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" /> Add gap
          </Button>
        )}
      </div>

      {showForm && (
        <GapForm
          workspaceId={workspaceId}
          userId={userId}
          onSaved={() => { setShowForm(false); onRefresh(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {editingId && (
        <GapForm
          workspaceId={workspaceId}
          userId={userId}
          existingGap={gaps.find((g) => g.id === editingId)}
          onSaved={() => { setEditingId(null); onRefresh(); }}
          onCancel={() => setEditingId(null)}
        />
      )}

      {gaps.length === 0 && !showForm && !editingId ? (
        <p className="text-sm text-neutral-muted py-4">No resource gaps identified yet. Gaps must be manually entered — underuse is not inferred automatically.</p>
      ) : (
        <div className="space-y-3">
          {gaps.map((gap) => (
            <div key={gap.id} className="rounded-md border border-neutral-border-soft p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="neutral">{GAP_CATEGORY_LABELS[gap.gap_category]}</Badge>
                    <span className="text-sm font-semibold text-navy">{gap.title}</span>
                    <Badge variant={gap.severity === 'critical' ? 'danger' : gap.severity === 'high' ? 'warning' : 'neutral'}>
                      {GAP_SEVERITY_LABELS[gap.severity]}
                    </Badge>
                    <Badge variant="info">{GAP_CONFIDENCE_LABELS[gap.confidence]}</Badge>
                    <Badge variant={gap.status === 'open' ? 'warning' : gap.status === 'confirmed' ? 'info' : 'success'}>
                      {GAP_STATUS_LABELS[gap.status]}
                    </Badge>
                    {gap.user_confirmed && <Badge variant="success" dot>Confirmed</Badge>}
                  </div>
                  <p className="text-sm text-neutral-secondary mt-1">{gap.description}</p>
                  <div className="flex gap-4 mt-2 text-xs text-neutral-muted flex-wrap">
                    <span>Evidence: {GAP_EVIDENCE_SOURCE_LABELS[gap.evidence_source]}</span>
                    {gap.affected_population && <span>Population: {gap.affected_population}</span>}
                  </div>
                </div>
                {editable && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setEditingId(gap.id)} className="text-neutral-muted hover:text-navy p-1">
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(gap.id)} className="text-neutral-muted hover:text-red p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function GapForm({
  workspaceId,
  userId,
  existingGap,
  onSaved,
  onCancel,
}: {
  workspaceId: string;
  userId: string;
  existingGap?: AnalysisResourceGapRow;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [gapCategory, setGapCategory] = useState<GapCategory>(existingGap?.gap_category ?? 'program_gap');
  const [title, setTitle] = useState(existingGap?.title ?? '');
  const [description, setDescription] = useState(existingGap?.description ?? '');
  const [affectedPopulation, setAffectedPopulation] = useState(existingGap?.affected_population ?? '');
  const [evidenceSource, setEvidenceSource] = useState<GapEvidenceSource>(existingGap?.evidence_source ?? 'manual');
  const [severity, setSeverity] = useState<GapSeverity>(existingGap?.severity ?? 'medium');
  const [confidence, setConfidence] = useState<GapConfidence>(existingGap?.confidence ?? 'medium');
  const [status, setStatus] = useState<GapStatus>(existingGap?.status ?? 'open');
  const [userConfirmed, setUserConfirmed] = useState(existingGap?.user_confirmed ?? false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateGapInput({ gap_category: gapCategory, title, description, severity, confidence, status, evidence_source: evidenceSource });
    if (err) { setValidationError(err); return; }

    try {
      if (existingGap) {
        await updateResourceGap(existingGap.id, {
          gap_category: gapCategory,
          title,
          description,
          affected_population: affectedPopulation || null,
          evidence_source: evidenceSource,
          severity,
          confidence,
          status,
          user_confirmed: userConfirmed,
        });
      } else {
        await createResourceGap({
          workspace_id: workspaceId,
          gap_category: gapCategory,
          title,
          description,
          affected_population: affectedPopulation || undefined,
          evidence_source: evidenceSource,
          severity,
          confidence,
          status,
          user_confirmed: userConfirmed,
          created_by: userId,
        });
      }
      onSaved();
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Failed to save gap.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-green/20 bg-green-tint/30 p-4 mb-3 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Gap Category *</label>
          <select value={gapCategory} onChange={(e) => setGapCategory(e.target.value as GapCategory)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40">
            {GAP_CATEGORIES.map((c) => <option key={c} value={c}>{GAP_CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Title *</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-navy mb-1">Description *</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
          className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
      </div>
      <div className="grid sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Severity</label>
          <select value={severity} onChange={(e) => setSeverity(e.target.value as GapSeverity)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40">
            {GAP_SEVERITIES.map((s) => <option key={s} value={s}>{GAP_SEVERITY_LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Confidence</label>
          <select value={confidence} onChange={(e) => setConfidence(e.target.value as GapConfidence)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40">
            {GAP_CONFIDENCES.map((c) => <option key={c} value={c}>{GAP_CONFIDENCE_LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as GapStatus)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40">
            {GAP_STATUSES.map((s) => <option key={s} value={s}>{GAP_STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Evidence Source</label>
          <select value={evidenceSource} onChange={(e) => setEvidenceSource(e.target.value as GapEvidenceSource)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40">
            {GAP_EVIDENCE_SOURCES.map((s) => <option key={s} value={s}>{GAP_EVIDENCE_SOURCE_LABELS[s]}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-navy mb-1">Affected Population</label>
        <input type="text" value={affectedPopulation} onChange={(e) => setAffectedPopulation(e.target.value)}
          className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
      </div>
      <label className="flex items-center gap-2 text-sm text-navy">
        <input type="checkbox" checked={userConfirmed} onChange={(e) => setUserConfirmed(e.target.checked)}
          className="rounded border-neutral-border" />
        User-confirmed gap
      </label>
      {validationError && (
        <p className="text-sm text-red flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {validationError}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm">{existingGap ? 'Update' : 'Add'} gap</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

// ============================================================
// Evidence Sources Section
// ============================================================

function EvidenceSourcesSection({
  workspaceId,
  evidenceSources,
  editable,
  userId,
  onRefresh,
}: {
  workspaceId: string;
  evidenceSources: AnalysisEvidenceSourceRow[];
  editable: boolean;
  userId: string;
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleDelete = async (evidenceId: string) => {
    try { await deleteEvidenceSource(evidenceId); onRefresh(); } catch { /* */ }
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-navy/60" />
          <span className="eyebrow">Evidence Sources</span>
        </div>
        {editable && !showForm && (
          <Button size="sm" variant="ghost" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" /> Add evidence
          </Button>
        )}
      </div>

      {showForm && (
        <EvidenceForm
          workspaceId={workspaceId}
          userId={userId}
          onSaved={() => { setShowForm(false); onRefresh(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {editingId && (
        <EvidenceForm
          workspaceId={workspaceId}
          userId={userId}
          existingEvidence={evidenceSources.find((e) => e.id === editingId)}
          onSaved={() => { setEditingId(null); onRefresh(); }}
          onCancel={() => setEditingId(null)}
        />
      )}

      {evidenceSources.length === 0 && !showForm && !editingId ? (
        <p className="text-sm text-neutral-muted py-4">No evidence sources recorded yet.</p>
      ) : (
        <div className="space-y-3">
          {evidenceSources.map((e) => (
            <div key={e.id} className="rounded-md border border-neutral-border-soft p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="info">{EVIDENCE_SOURCE_TYPE_LABELS[e.source_type]}</Badge>
                    <span className="text-sm font-semibold text-navy">{e.source_name}</span>
                    <Badge variant={e.verification_status === 'verified' ? 'success' : e.verification_status === 'disputed' ? 'danger' : 'neutral'}>
                      {VERIFICATION_STATUS_LABELS[e.verification_status]}
                    </Badge>
                  </div>
                  {e.description && <p className="text-sm text-neutral-secondary mt-1">{e.description}</p>}
                  <div className="flex gap-4 mt-2 text-xs text-neutral-muted flex-wrap">
                    {e.source_date && <span>Date: {new Date(e.source_date).toLocaleDateString()}</span>}
                    {e.file_reference && <span>Ref: {e.file_reference}</span>}
                  </div>
                </div>
                {editable && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setEditingId(e.id)} className="text-neutral-muted hover:text-navy p-1">
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(e.id)} className="text-neutral-muted hover:text-red p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function EvidenceForm({
  workspaceId,
  userId,
  existingEvidence,
  onSaved,
  onCancel,
}: {
  workspaceId: string;
  userId: string;
  existingEvidence?: AnalysisEvidenceSourceRow;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [sourceType, setSourceType] = useState<EvidenceSourceType>(existingEvidence?.source_type ?? 'assessment_data');
  const [sourceName, setSourceName] = useState(existingEvidence?.source_name ?? '');
  const [sourceDate, setSourceDate] = useState(existingEvidence?.source_date ?? '');
  const [description, setDescription] = useState(existingEvidence?.description ?? '');
  const [fileReference, setFileReference] = useState(existingEvidence?.file_reference ?? '');
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>(existingEvidence?.verification_status ?? 'unverified');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateEvidenceInput({ source_type: sourceType, source_name: sourceName, verification_status: verificationStatus });
    if (err) { setValidationError(err); return; }

    try {
      if (existingEvidence) {
        await updateEvidenceSource(existingEvidence.id, {
          source_type: sourceType,
          source_name: sourceName,
          source_date: sourceDate || null,
          description: description || null,
          file_reference: fileReference || null,
          verification_status: verificationStatus,
        });
      } else {
        await createEvidenceSource({
          workspace_id: workspaceId,
          source_type: sourceType,
          source_name: sourceName,
          source_date: sourceDate || undefined,
          description: description || undefined,
          file_reference: fileReference || undefined,
          verification_status: verificationStatus,
          entered_by: userId,
        });
      }
      onSaved();
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Failed to save evidence source.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-green/20 bg-green-tint/30 p-4 mb-3 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Source Type *</label>
          <select value={sourceType} onChange={(e) => setSourceType(e.target.value as EvidenceSourceType)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40">
            {EVIDENCE_SOURCE_TYPES.map((t) => <option key={t} value={t}>{EVIDENCE_SOURCE_TYPE_LABELS[t]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Source Name *</label>
          <input type="text" value={sourceName} onChange={(e) => setSourceName(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Source Date</label>
          <input type="date" value={sourceDate} onChange={(e) => setSourceDate(e.target.value)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Verification Status</label>
          <select value={verificationStatus} onChange={(e) => setVerificationStatus(e.target.value as VerificationStatus)}
            className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40">
            {VERIFICATION_STATUSES.map((v) => <option key={v} value={v}>{VERIFICATION_STATUS_LABELS[v]}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-navy mb-1">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
          className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
      </div>
      <div>
        <label className="block text-xs font-medium text-navy mb-1">File Reference</label>
        <input type="text" value={fileReference} onChange={(e) => setFileReference(e.target.value)}
          placeholder="e.g. filename, document ID, or link"
          className="w-full rounded-sm border border-neutral-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/40" />
      </div>
      {validationError && (
        <p className="text-sm text-red flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {validationError}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm">{existingEvidence ? 'Update' : 'Add'} evidence</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

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
  const editable = canEditWorkspace(capabilities, workspace.status);
  const canApprove = canApproveWorkspace(capabilities);
  const isFinalized = workspace.status === 'finalized';

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
                {(Object.keys(WORKSPACE_STATUS_LABELS) as WorkspaceStatus[]).map((s) => (
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

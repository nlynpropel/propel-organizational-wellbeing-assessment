import { supabase } from '../lib/supabase';
import { logDbError } from '../lib/logger';
import { hasCapability } from './capabilities';
import { fetchServiceOrganizationId } from './organizations';
import type {
  AnalysisWorkspaceRow,
  AnalysisOutcomeGoalRow,
  AnalysisOutcomeMetricRow,
  AnalysisNoteRow,
  WorkspaceWithDetails,
  WorkspaceStatus,
  OutcomeGoalPriority,
  OutcomeGoalSourceType,
  DataQualityLevel,
  AnalysisNoteType,
  AnalysisNoteVisibility,
  AnalysisNoteImportance,
  OrganizationCapability,
} from '../lib/database.types';

// ============================================================
// Validation helpers
// ============================================================

export const WORKSPACE_STATUSES: WorkspaceStatus[] = [
  'draft',
  'inputs_in_progress',
  'ready_for_analysis',
  'analysis_generated',
  'under_review',
  'approved',
  'finalized',
];

export const DATA_QUALITY_LEVELS: DataQualityLevel[] = [
  'verified',
  'client_reported',
  'estimated',
  'incomplete',
  'unknown',
];

export const NOTE_TYPES: AnalysisNoteType[] = [
  'organization_context',
  'analyst_observation',
  'specific_question',
  'key_consideration',
  'known_constraint',
  'client_priority',
  'implementation_history',
  'data_limitation',
  'follow_up',
];

export const NOTE_VISIBILITIES: AnalysisNoteVisibility[] = [
  'internal',
  'organization_team',
  'client_report_candidate',
];

export const NOTE_IMPORTANCES: AnalysisNoteImportance[] = [
  'low',
  'normal',
  'high',
  'critical',
];

export const GOAL_PRIORITIES: OutcomeGoalPriority[] = [
  'low',
  'medium',
  'high',
  'critical',
];

export const GOAL_SOURCE_TYPES: OutcomeGoalSourceType[] = [
  'analyst',
  'client_directed',
  'assessment_finding',
  'stakeholder_input',
];

export const WORKSPACE_STATUS_LABELS: Record<WorkspaceStatus, string> = {
  draft: 'Draft',
  inputs_in_progress: 'Inputs In Progress',
  ready_for_analysis: 'Ready for Analysis',
  analysis_generated: 'Analysis Generated',
  under_review: 'Under Review',
  approved: 'Approved',
  finalized: 'Finalized',
};

export const DATA_QUALITY_LABELS: Record<DataQualityLevel, string> = {
  verified: 'Verified',
  client_reported: 'Client Reported',
  estimated: 'Estimated',
  incomplete: 'Incomplete',
  unknown: 'Unknown',
};

export const NOTE_TYPE_LABELS: Record<AnalysisNoteType, string> = {
  organization_context: 'Organization Context',
  analyst_observation: 'Analyst Observation',
  specific_question: 'Specific Question',
  key_consideration: 'Key Consideration',
  known_constraint: 'Known Constraint',
  client_priority: 'Client Priority',
  implementation_history: 'Implementation History',
  data_limitation: 'Data Limitation',
  follow_up: 'Follow Up',
};

export const NOTE_VISIBILITY_LABELS: Record<AnalysisNoteVisibility, string> = {
  internal: 'Internal',
  organization_team: 'Organization Team',
  client_report_candidate: 'Client Report Candidate',
};

export const NOTE_IMPORTANCE_LABELS: Record<AnalysisNoteImportance, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  critical: 'Critical',
};

export const PRIORITY_LABELS: Record<OutcomeGoalPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const SOURCE_TYPE_LABELS: Record<OutcomeGoalSourceType, string> = {
  analyst: 'Analyst',
  client_directed: 'Client Directed',
  assessment_finding: 'Assessment Finding',
  stakeholder_input: 'Stakeholder Input',
};

export function isWorkspaceEditable(status: WorkspaceStatus): boolean {
  return status !== 'finalized';
}

export function canEditWorkspace(
  capabilities: Set<OrganizationCapability>,
  status: WorkspaceStatus
): boolean {
  return (
    hasCapability(capabilities, 'edit_strategy_analysis') &&
    isWorkspaceEditable(status)
  );
}

export function canApproveWorkspace(capabilities: Set<OrganizationCapability>): boolean {
  return hasCapability(capabilities, 'approve_strategy_analysis');
}

export function validateGoalInput(input: {
  outcome_category: string;
  title: string;
  priority?: string;
  source_type?: string;
}): string | null {
  if (!input.outcome_category.trim()) return 'Outcome category is required';
  if (!input.title.trim()) return 'Title is required';
  if (input.priority && !GOAL_PRIORITIES.includes(input.priority as OutcomeGoalPriority)) {
    return 'Invalid priority';
  }
  if (input.source_type && !GOAL_SOURCE_TYPES.includes(input.source_type as OutcomeGoalSourceType)) {
    return 'Invalid source type';
  }
  return null;
}

export function validateMetricInput(input: {
  metric_name: string;
  data_quality?: string;
}): string | null {
  if (!input.metric_name.trim()) return 'Metric name is required';
  if (input.data_quality && !DATA_QUALITY_LEVELS.includes(input.data_quality as DataQualityLevel)) {
    return 'Invalid data quality level';
  }
  return null;
}

export function validateNoteInput(input: {
  note_type: string;
  content: string;
  visibility?: string;
  importance?: string;
}): string | null {
  if (!input.note_type.trim()) return 'Note type is required';
  if (!NOTE_TYPES.includes(input.note_type as AnalysisNoteType)) {
    return 'Invalid note type';
  }
  if (!input.content.trim()) return 'Content is required';
  if (input.visibility && !NOTE_VISIBILITIES.includes(input.visibility as AnalysisNoteVisibility)) {
    return 'Invalid visibility';
  }
  if (input.importance && !NOTE_IMPORTANCES.includes(input.importance as AnalysisNoteImportance)) {
    return 'Invalid importance level';
  }
  return null;
}

export function validateWorkspaceInput(input: {
  title: string;
  assessment_instance_id: string;
}): string | null {
  if (!input.title.trim()) return 'Title is required';
  if (!input.assessment_instance_id) return 'Assessment instance is required';
  return null;
}

// ============================================================
// Workspace CRUD
// ============================================================

export async function fetchWorkspacesForClient(clientOrgId: string): Promise<AnalysisWorkspaceRow[]> {
  const { data, error } = await supabase
    .from('analysis_workspaces')
    .select('*')
    .eq('client_organization_id', clientOrgId)
    .order('created_at', { ascending: false });
  if (error) {
    logDbError({ fn: 'fetchWorkspacesForClient', error });
    throw error;
  }
  return data ?? [];
}

export async function fetchWorkspaceById(workspaceId: string): Promise<WorkspaceWithDetails | null> {
  const { data: ws, error: wsErr } = await supabase
    .from('analysis_workspaces')
    .select('*')
    .eq('id', workspaceId)
    .maybeSingle();
  if (wsErr) {
    logDbError({ fn: 'fetchWorkspaceById', error: wsErr });
    throw wsErr;
  }
  if (!ws) return null;

  const [goals, metrics, notes] = await Promise.all([
    fetchGoalsForWorkspace(workspaceId),
    fetchMetricsForWorkspace(workspaceId),
    fetchNotesForWorkspace(workspaceId),
  ]);

  return {
    ...(ws as AnalysisWorkspaceRow),
    goals,
    metrics,
    notes,
  };
}

export async function createWorkspace(params: {
  client_organization_id: string;
  assessment_instance_id: string;
  title: string;
  created_by: string;
}): Promise<AnalysisWorkspaceRow> {
  const validationError = validateWorkspaceInput(params);
  if (validationError) throw new Error(validationError);

  const serviceOrgId = await fetchServiceOrganizationId();
  if (!serviceOrgId) throw new Error('No service organization found for your account');

  const { data, error } = await supabase
    .from('analysis_workspaces')
    .insert({
      client_organization_id: params.client_organization_id,
      assessment_instance_id: params.assessment_instance_id,
      service_organization_id: serviceOrgId,
      created_by: params.created_by,
      title: params.title,
      status: 'draft',
    })
    .select()
    .single();
  if (error) {
    logDbError({ fn: 'createWorkspace', error });
    throw error;
  }
  return data;
}

export async function updateWorkspace(
  workspaceId: string,
  updates: Partial<Pick<AnalysisWorkspaceRow, 'title' | 'status' | 'assigned_to'>>
): Promise<AnalysisWorkspaceRow> {
  const { data, error } = await supabase
    .from('analysis_workspaces')
    .update(updates)
    .eq('id', workspaceId)
    .select()
    .single();
  if (error) {
    logDbError({ fn: 'updateWorkspace', error });
    throw error;
  }
  return data;
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
  const { error } = await supabase
    .from('analysis_workspaces')
    .delete()
    .eq('id', workspaceId);
  if (error) {
    logDbError({ fn: 'deleteWorkspace', error });
    throw error;
  }
}

export async function approveWorkspace(workspaceId: string): Promise<void> {
  const { error } = await supabase.rpc('approve_workspace', {
    p_workspace_id: workspaceId,
  });
  if (error) {
    logDbError({ fn: 'approveWorkspace', error });
    throw error;
  }
}

export async function finalizeWorkspace(workspaceId: string): Promise<void> {
  const { error } = await supabase.rpc('finalize_workspace', {
    p_workspace_id: workspaceId,
  });
  if (error) {
    logDbError({ fn: 'finalizeWorkspace', error });
    throw error;
  }
}

// ============================================================
// Outcome Goals CRUD
// ============================================================

export async function fetchGoalsForWorkspace(workspaceId: string): Promise<AnalysisOutcomeGoalRow[]> {
  const { data, error } = await supabase
    .from('analysis_outcome_goals')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });
  if (error) {
    logDbError({ fn: 'fetchGoalsForWorkspace', error });
    throw error;
  }
  return data ?? [];
}

export async function createGoal(params: {
  workspace_id: string;
  outcome_category: string;
  title: string;
  description?: string;
  priority?: OutcomeGoalPriority;
  target_population?: string;
  desired_timeframe?: string;
  source_type?: OutcomeGoalSourceType;
  source_note?: string;
  created_by: string;
}): Promise<AnalysisOutcomeGoalRow> {
  const validationError = validateGoalInput(params);
  if (validationError) throw new Error(validationError);

  const { data, error } = await supabase
    .from('analysis_outcome_goals')
    .insert({
      workspace_id: params.workspace_id,
      outcome_category: params.outcome_category,
      title: params.title,
      description: params.description ?? null,
      priority: params.priority ?? 'medium',
      target_population: params.target_population ?? null,
      desired_timeframe: params.desired_timeframe ?? null,
      source_type: params.source_type ?? 'analyst',
      source_note: params.source_note ?? null,
      created_by: params.created_by,
    })
    .select()
    .single();
  if (error) {
    logDbError({ fn: 'createGoal', error });
    throw error;
  }
  return data;
}

export async function updateGoal(
  goalId: string,
  updates: Partial<Omit<AnalysisOutcomeGoalRow, 'id' | 'workspace_id' | 'created_by' | 'created_at' | 'updated_at'>>
): Promise<AnalysisOutcomeGoalRow> {
  const { data, error } = await supabase
    .from('analysis_outcome_goals')
    .update(updates)
    .eq('id', goalId)
    .select()
    .single();
  if (error) {
    logDbError({ fn: 'updateGoal', error });
    throw error;
  }
  return data;
}

export async function deleteGoal(goalId: string): Promise<void> {
  const { error } = await supabase
    .from('analysis_outcome_goals')
    .delete()
    .eq('id', goalId);
  if (error) {
    logDbError({ fn: 'deleteGoal', error });
    throw error;
  }
}

// ============================================================
// Outcome Metrics CRUD
// ============================================================

export async function fetchMetricsForWorkspace(workspaceId: string): Promise<AnalysisOutcomeMetricRow[]> {
  const { data, error } = await supabase
    .from('analysis_outcome_metrics')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });
  if (error) {
    logDbError({ fn: 'fetchMetricsForWorkspace', error });
    throw error;
  }
  return data ?? [];
}

export async function createMetric(params: {
  workspace_id: string;
  outcome_goal_id?: string;
  metric_name: string;
  metric_category?: string;
  current_value?: string;
  target_value?: string;
  unit?: string;
  measurement_period?: string;
  population_description?: string;
  data_source?: string;
  data_quality?: DataQualityLevel;
  notes?: string;
}): Promise<AnalysisOutcomeMetricRow> {
  const validationError = validateMetricInput(params);
  if (validationError) throw new Error(validationError);

  const { data, error } = await supabase
    .from('analysis_outcome_metrics')
    .insert({
      workspace_id: params.workspace_id,
      outcome_goal_id: params.outcome_goal_id ?? null,
      metric_name: params.metric_name,
      metric_category: params.metric_category ?? null,
      current_value: params.current_value ?? null,
      target_value: params.target_value ?? null,
      unit: params.unit ?? null,
      measurement_period: params.measurement_period ?? null,
      population_description: params.population_description ?? null,
      data_source: params.data_source ?? null,
      data_quality: params.data_quality ?? 'unknown',
      notes: params.notes ?? null,
    })
    .select()
    .single();
  if (error) {
    logDbError({ fn: 'createMetric', error });
    throw error;
  }
  return data;
}

export async function updateMetric(
  metricId: string,
  updates: Partial<Omit<AnalysisOutcomeMetricRow, 'id' | 'workspace_id' | 'created_at' | 'updated_at'>>
): Promise<AnalysisOutcomeMetricRow> {
  const { data, error } = await supabase
    .from('analysis_outcome_metrics')
    .update(updates)
    .eq('id', metricId)
    .select()
    .single();
  if (error) {
    logDbError({ fn: 'updateMetric', error });
    throw error;
  }
  return data;
}

export async function deleteMetric(metricId: string): Promise<void> {
  const { error } = await supabase
    .from('analysis_outcome_metrics')
    .delete()
    .eq('id', metricId);
  if (error) {
    logDbError({ fn: 'deleteMetric', error });
    throw error;
  }
}

// ============================================================
// Analysis Notes CRUD
// ============================================================

export async function fetchNotesForWorkspace(workspaceId: string): Promise<AnalysisNoteRow[]> {
  const { data, error } = await supabase
    .from('analysis_notes')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  if (error) {
    logDbError({ fn: 'fetchNotesForWorkspace', error });
    throw error;
  }
  return data ?? [];
}

export async function createAnalysisNote(params: {
  workspace_id: string;
  note_type: AnalysisNoteType;
  title?: string;
  content: string;
  visibility?: AnalysisNoteVisibility;
  importance?: AnalysisNoteImportance;
  created_by: string;
}): Promise<AnalysisNoteRow> {
  const validationError = validateNoteInput(params);
  if (validationError) throw new Error(validationError);

  const { data, error } = await supabase
    .from('analysis_notes')
    .insert({
      workspace_id: params.workspace_id,
      note_type: params.note_type,
      title: params.title ?? null,
      content: params.content,
      visibility: params.visibility ?? 'internal',
      importance: params.importance ?? 'normal',
      created_by: params.created_by,
    })
    .select()
    .single();
  if (error) {
    logDbError({ fn: 'createAnalysisNote', error });
    throw error;
  }
  return data;
}

export async function updateAnalysisNote(
  noteId: string,
  updates: Partial<Omit<AnalysisNoteRow, 'id' | 'workspace_id' | 'created_by' | 'created_at' | 'updated_at'>>
): Promise<AnalysisNoteRow> {
  const { data, error } = await supabase
    .from('analysis_notes')
    .update(updates)
    .eq('id', noteId)
    .select()
    .single();
  if (error) {
    logDbError({ fn: 'updateAnalysisNote', error });
    throw error;
  }
  return data;
}

export async function deleteAnalysisNote(noteId: string): Promise<void> {
  const { error } = await supabase
    .from('analysis_notes')
    .delete()
    .eq('id', noteId);
  if (error) {
    logDbError({ fn: 'deleteAnalysisNote', error });
    throw error;
  }
}

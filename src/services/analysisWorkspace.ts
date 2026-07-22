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
  CompletenessLevel,
  ReadinessEvaluation,
  ReadinessRequirement,
  AnalysisInputSnapshotRow,
  CreateSnapshotResult,
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

  const [goals, metrics, notes, utilizationRecords, resourceGaps, evidenceSources] = await Promise.all([
    fetchGoalsForWorkspace(workspaceId),
    fetchMetricsForWorkspace(workspaceId),
    fetchNotesForWorkspace(workspaceId),
    fetchUtilizationForWorkspace(workspaceId),
    fetchResourceGapsForWorkspace(workspaceId),
    fetchEvidenceSourcesForWorkspace(workspaceId),
  ]);

  return {
    ...(ws as AnalysisWorkspaceRow),
    goals,
    metrics,
    notes,
    utilizationRecords,
    resourceGaps,
    evidenceSources,
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

// ============================================================
// Enums and labels for new tables
// ============================================================

export const PROGRAM_STATUSES: ProgramStatus[] = ['active', 'paused', 'discontinued', 'planned'];
export const PROGRAM_SOURCE_TYPES: ProgramSourceType[] = ['client_reported', 'analyst_entered', 'verified', 'estimated'];
export const UTILIZATION_STATUSES: UtilizationStatus[] = ['not_measured', 'low', 'moderate', 'high', 'unknown'];
export const GAP_CATEGORIES: GapCategory[] = ['program_gap', 'population_gap', 'access_gap', 'resource_gap', 'data_gap', 'other'];
export const GAP_EVIDENCE_SOURCES: GapEvidenceSource[] = ['manual', 'utilization_data', 'assessment_finding', 'client_input', 'benchmark'];
export const GAP_SEVERITIES: GapSeverity[] = ['low', 'medium', 'high', 'critical'];
export const GAP_CONFIDENCES: GapConfidence[] = ['low', 'medium', 'high'];
export const GAP_STATUSES: GapStatus[] = ['open', 'confirmed', 'addressed', 'dismissed'];
export const EVIDENCE_SOURCE_TYPES: EvidenceSourceType[] = ['assessment_data', 'utilization_report', 'client_document', 'benchmark_data', 'stakeholder_interview', 'third_party_report', 'other'];
export const VERIFICATION_STATUSES: VerificationStatus[] = ['unverified', 'verified', 'disputed'];

export const PROGRAM_STATUS_LABELS: Record<ProgramStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  discontinued: 'Discontinued',
  planned: 'Planned',
};
export const PROGRAM_SOURCE_TYPE_LABELS: Record<ProgramSourceType, string> = {
  client_reported: 'Client Reported',
  analyst_entered: 'Analyst Entered',
  verified: 'Verified',
  estimated: 'Estimated',
};
export const UTILIZATION_STATUS_LABELS: Record<UtilizationStatus, string> = {
  not_measured: 'Not Measured',
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  unknown: 'Unknown',
};
export const GAP_CATEGORY_LABELS: Record<GapCategory, string> = {
  program_gap: 'Program Gap',
  population_gap: 'Population Gap',
  access_gap: 'Access Gap',
  resource_gap: 'Resource Gap',
  data_gap: 'Data Gap',
  other: 'Other',
};
export const GAP_EVIDENCE_SOURCE_LABELS: Record<GapEvidenceSource, string> = {
  manual: 'Manual',
  utilization_data: 'Utilization Data',
  assessment_finding: 'Assessment Finding',
  client_input: 'Client Input',
  benchmark: 'Benchmark',
};
export const GAP_SEVERITY_LABELS: Record<GapSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};
export const GAP_CONFIDENCE_LABELS: Record<GapConfidence, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};
export const GAP_STATUS_LABELS: Record<GapStatus, string> = {
  open: 'Open',
  confirmed: 'Confirmed',
  addressed: 'Addressed',
  dismissed: 'Dismissed',
};
export const EVIDENCE_SOURCE_TYPE_LABELS: Record<EvidenceSourceType, string> = {
  assessment_data: 'Assessment Data',
  utilization_report: 'Utilization Report',
  client_document: 'Client Document',
  benchmark_data: 'Benchmark Data',
  stakeholder_interview: 'Stakeholder Interview',
  third_party_report: 'Third-Party Report',
  other: 'Other',
};
export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  unverified: 'Unverified',
  verified: 'Verified',
  disputed: 'Disputed',
};

// ============================================================
// Validation for new tables
// ============================================================

export function validateProgramInput(input: {
  program_name: string;
  program_category: string;
  status?: string;
  source_type?: string;
}): string | null {
  if (!input.program_name.trim()) return 'Program name is required';
  if (!input.program_category.trim()) return 'Program category is required';
  if (input.status && !PROGRAM_STATUSES.includes(input.status as ProgramStatus)) return 'Invalid program status';
  if (input.source_type && !PROGRAM_SOURCE_TYPES.includes(input.source_type as ProgramSourceType)) return 'Invalid program source type';
  return null;
}

export function validateUtilizationInput(input: {
  client_program_id: string;
  utilization_status?: string;
  data_quality?: string;
}): string | null {
  if (!input.client_program_id) return 'Client program is required';
  if (input.utilization_status && !UTILIZATION_STATUSES.includes(input.utilization_status as UtilizationStatus)) return 'Invalid utilization status';
  if (input.data_quality && !DATA_QUALITY_LEVELS.includes(input.data_quality as DataQualityLevel)) return 'Invalid data quality level';
  return null;
}

export function validateGapInput(input: {
  gap_category: string;
  title: string;
  description: string;
  severity?: string;
  confidence?: string;
  status?: string;
  evidence_source?: string;
}): string | null {
  if (!input.gap_category.trim()) return 'Gap category is required';
  if (!GAP_CATEGORIES.includes(input.gap_category as GapCategory)) return 'Invalid gap category';
  if (!input.title.trim()) return 'Title is required';
  if (!input.description.trim()) return 'Description is required';
  if (input.severity && !GAP_SEVERITIES.includes(input.severity as GapSeverity)) return 'Invalid severity';
  if (input.confidence && !GAP_CONFIDENCES.includes(input.confidence as GapConfidence)) return 'Invalid confidence';
  if (input.status && !GAP_STATUSES.includes(input.status as GapStatus)) return 'Invalid gap status';
  if (input.evidence_source && !GAP_EVIDENCE_SOURCES.includes(input.evidence_source as GapEvidenceSource)) return 'Invalid evidence source';
  return null;
}

export function validateEvidenceInput(input: {
  source_type: string;
  source_name: string;
  verification_status?: string;
}): string | null {
  if (!input.source_type.trim()) return 'Source type is required';
  if (!EVIDENCE_SOURCE_TYPES.includes(input.source_type as EvidenceSourceType)) return 'Invalid evidence source type';
  if (!input.source_name.trim()) return 'Source name is required';
  if (input.verification_status && !VERIFICATION_STATUSES.includes(input.verification_status as VerificationStatus)) return 'Invalid verification status';
  return null;
}

// ============================================================
// Client Programs CRUD (org-scoped, not workspace-scoped)
// ============================================================

export async function fetchProgramsForClient(clientOrgId: string): Promise<ClientProgramRow[]> {
  const { data, error } = await supabase
    .from('client_programs')
    .select('*')
    .eq('client_organization_id', clientOrgId)
    .order('created_at', { ascending: false });
  if (error) {
    logDbError({ fn: 'fetchProgramsForClient', error });
    throw error;
  }
  return data ?? [];
}

export async function createProgram(params: {
  client_organization_id: string;
  program_name: string;
  program_category: string;
  provider_name?: string;
  description?: string;
  target_population?: string;
  eligibility_summary?: string;
  access_method?: string;
  communication_channels?: string;
  incentive_connected?: boolean;
  status?: ProgramStatus;
  start_date?: string;
  end_date?: string;
  source_type?: ProgramSourceType;
  source_note?: string;
}): Promise<ClientProgramRow> {
  const validationError = validateProgramInput(params);
  if (validationError) throw new Error(validationError);

  const { data, error } = await supabase
    .from('client_programs')
    .insert({
      client_organization_id: params.client_organization_id,
      program_name: params.program_name,
      program_category: params.program_category,
      provider_name: params.provider_name ?? null,
      description: params.description ?? null,
      target_population: params.target_population ?? null,
      eligibility_summary: params.eligibility_summary ?? null,
      access_method: params.access_method ?? null,
      communication_channels: params.communication_channels ?? null,
      incentive_connected: params.incentive_connected ?? false,
      status: params.status ?? 'active',
      start_date: params.start_date ?? null,
      end_date: params.end_date ?? null,
      source_type: params.source_type ?? 'client_reported',
      source_note: params.source_note ?? null,
    })
    .select()
    .single();
  if (error) {
    logDbError({ fn: 'createProgram', error });
    throw error;
  }
  return data;
}

export async function updateProgram(
  programId: string,
  updates: Partial<Omit<ClientProgramRow, 'id' | 'client_organization_id' | 'created_at' | 'updated_at'>>
): Promise<ClientProgramRow> {
  const { data, error } = await supabase
    .from('client_programs')
    .update(updates)
    .eq('id', programId)
    .select()
    .single();
  if (error) {
    logDbError({ fn: 'updateProgram', error });
    throw error;
  }
  return data;
}

export async function deleteProgram(programId: string): Promise<void> {
  const { error } = await supabase
    .from('client_programs')
    .delete()
    .eq('id', programId);
  if (error) {
    logDbError({ fn: 'deleteProgram', error });
    throw error;
  }
}

// ============================================================
// Program Utilization CRUD (workspace-scoped)
// ============================================================

export async function fetchUtilizationForWorkspace(workspaceId: string): Promise<ProgramUtilizationRecordRow[]> {
  const { data, error } = await supabase
    .from('program_utilization_records')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });
  if (error) {
    logDbError({ fn: 'fetchUtilizationForWorkspace', error });
    throw error;
  }
  return data ?? [];
}

export async function createUtilizationRecord(params: {
  workspace_id: string;
  client_program_id: string;
  measurement_start?: string;
  measurement_end?: string;
  eligible_population?: number;
  registered_count?: number;
  active_user_count?: number;
  completion_count?: number;
  utilization_rate?: number;
  repeat_engagement_rate?: number;
  benchmark_value?: string;
  benchmark_source?: string;
  utilization_status?: UtilizationStatus;
  data_quality?: DataQualityLevel;
  notes?: string;
}): Promise<ProgramUtilizationRecordRow> {
  const validationError = validateUtilizationInput(params);
  if (validationError) throw new Error(validationError);

  const { data, error } = await supabase
    .from('program_utilization_records')
    .insert({
      workspace_id: params.workspace_id,
      client_program_id: params.client_program_id,
      measurement_start: params.measurement_start ?? null,
      measurement_end: params.measurement_end ?? null,
      eligible_population: params.eligible_population ?? null,
      registered_count: params.registered_count ?? null,
      active_user_count: params.active_user_count ?? null,
      completion_count: params.completion_count ?? null,
      utilization_rate: params.utilization_rate ?? null,
      repeat_engagement_rate: params.repeat_engagement_rate ?? null,
      benchmark_value: params.benchmark_value ?? null,
      benchmark_source: params.benchmark_source ?? null,
      utilization_status: params.utilization_status ?? 'not_measured',
      data_quality: params.data_quality ?? 'unknown',
      notes: params.notes ?? null,
    })
    .select()
    .single();
  if (error) {
    logDbError({ fn: 'createUtilizationRecord', error });
    throw error;
  }
  return data;
}

export async function updateUtilizationRecord(
  recordId: string,
  updates: Partial<Omit<ProgramUtilizationRecordRow, 'id' | 'workspace_id' | 'client_program_id' | 'created_at' | 'updated_at'>>
): Promise<ProgramUtilizationRecordRow> {
  const { data, error } = await supabase
    .from('program_utilization_records')
    .update(updates)
    .eq('id', recordId)
    .select()
    .single();
  if (error) {
    logDbError({ fn: 'updateUtilizationRecord', error });
    throw error;
  }
  return data;
}

export async function deleteUtilizationRecord(recordId: string): Promise<void> {
  const { error } = await supabase
    .from('program_utilization_records')
    .delete()
    .eq('id', recordId);
  if (error) {
    logDbError({ fn: 'deleteUtilizationRecord', error });
    throw error;
  }
}

// ============================================================
// Resource Gaps CRUD (workspace-scoped)
// ============================================================

export async function fetchResourceGapsForWorkspace(workspaceId: string): Promise<AnalysisResourceGapRow[]> {
  const { data, error } = await supabase
    .from('analysis_resource_gaps')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });
  if (error) {
    logDbError({ fn: 'fetchResourceGapsForWorkspace', error });
    throw error;
  }
  return data ?? [];
}

export async function createResourceGap(params: {
  workspace_id: string;
  gap_category: GapCategory;
  title: string;
  description: string;
  affected_population?: string;
  evidence_source?: GapEvidenceSource;
  severity?: GapSeverity;
  confidence?: GapConfidence;
  status?: GapStatus;
  user_confirmed?: boolean;
  created_by: string;
}): Promise<AnalysisResourceGapRow> {
  const validationError = validateGapInput(params);
  if (validationError) throw new Error(validationError);

  const { data, error } = await supabase
    .from('analysis_resource_gaps')
    .insert({
      workspace_id: params.workspace_id,
      gap_category: params.gap_category,
      title: params.title,
      description: params.description,
      affected_population: params.affected_population ?? null,
      evidence_source: params.evidence_source ?? 'manual',
      severity: params.severity ?? 'medium',
      confidence: params.confidence ?? 'medium',
      status: params.status ?? 'open',
      user_confirmed: params.user_confirmed ?? false,
      created_by: params.created_by,
    })
    .select()
    .single();
  if (error) {
    logDbError({ fn: 'createResourceGap', error });
    throw error;
  }
  return data;
}

export async function updateResourceGap(
  gapId: string,
  updates: Partial<Omit<AnalysisResourceGapRow, 'id' | 'workspace_id' | 'created_by' | 'created_at' | 'updated_at'>>
): Promise<AnalysisResourceGapRow> {
  const { data, error } = await supabase
    .from('analysis_resource_gaps')
    .update(updates)
    .eq('id', gapId)
    .select()
    .single();
  if (error) {
    logDbError({ fn: 'updateResourceGap', error });
    throw error;
  }
  return data;
}

export async function deleteResourceGap(gapId: string): Promise<void> {
  const { error } = await supabase
    .from('analysis_resource_gaps')
    .delete()
    .eq('id', gapId);
  if (error) {
    logDbError({ fn: 'deleteResourceGap', error });
    throw error;
  }
}

// ============================================================
// Evidence Sources CRUD (workspace-scoped)
// ============================================================

export async function fetchEvidenceSourcesForWorkspace(workspaceId: string): Promise<AnalysisEvidenceSourceRow[]> {
  const { data, error } = await supabase
    .from('analysis_evidence_sources')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  if (error) {
    logDbError({ fn: 'fetchEvidenceSourcesForWorkspace', error });
    throw error;
  }
  return data ?? [];
}

export async function createEvidenceSource(params: {
  workspace_id: string;
  source_type: EvidenceSourceType;
  source_name: string;
  source_date?: string;
  description?: string;
  file_reference?: string;
  verification_status?: VerificationStatus;
  entered_by: string;
}): Promise<AnalysisEvidenceSourceRow> {
  const validationError = validateEvidenceInput(params);
  if (validationError) throw new Error(validationError);

  const { data, error } = await supabase
    .from('analysis_evidence_sources')
    .insert({
      workspace_id: params.workspace_id,
      source_type: params.source_type,
      source_name: params.source_name,
      source_date: params.source_date ?? null,
      description: params.description ?? null,
      file_reference: params.file_reference ?? null,
      verification_status: params.verification_status ?? 'unverified',
      entered_by: params.entered_by,
    })
    .select()
    .single();
  if (error) {
    logDbError({ fn: 'createEvidenceSource', error });
    throw error;
  }
  return data;
}

export async function updateEvidenceSource(
  evidenceId: string,
  updates: Partial<Omit<AnalysisEvidenceSourceRow, 'id' | 'workspace_id' | 'entered_by' | 'created_at'>>
): Promise<AnalysisEvidenceSourceRow> {
  const { data, error } = await supabase
    .from('analysis_evidence_sources')
    .update(updates)
    .eq('id', evidenceId)
    .select()
    .single();
  if (error) {
    logDbError({ fn: 'updateEvidenceSource', error });
    throw error;
  }
  return data;
}

export async function deleteEvidenceSource(evidenceId: string): Promise<void> {
  const { error } = await supabase
    .from('analysis_evidence_sources')
    .delete()
    .eq('id', evidenceId);
  if (error) {
    logDbError({ fn: 'deleteEvidenceSource', error });
    throw error;
  }
}

// ============================================================
// Readiness Evaluation
// ============================================================

export const COMPLETENESS_LEVELS: CompletenessLevel[] = ['not_ready', 'limited', 'sufficient', 'strong'];

export const COMPLETENESS_LEVEL_LABELS: Record<CompletenessLevel, string> = {
  not_ready: 'Not Ready',
  limited: 'Limited',
  sufficient: 'Sufficient',
  strong: 'Strong',
};

export const READINESS_STATUS_LABELS: Record<ReadinessRequirementStatus, string> = {
  complete: 'Complete',
  incomplete: 'Incomplete',
  unavailable: 'Unavailable',
  optional: 'Optional',
};

export type ReadinessRequirementStatus = ReadinessRequirement['status'];

// Client-side readiness evaluation (mirrors server RPC for UI display)
export function evaluateReadinessClient(workspace: WorkspaceWithDetails): ReadinessEvaluation {
  const requirements: ReadinessRequirement[] = [];
  let completeCount = 0;
  let totalRequired = 0;

  // 1. Finalized assessment present
  totalRequired++;
  const hasAssessment = workspace.assessment_instance?.status === 'submitted' || workspace.assessment_instance?.status === 'report_ready';
  if (hasAssessment) {
    requirements.push({ key: 'finalized_assessment', label: 'Finalized assessment', status: 'complete', detail: workspace.assessment_instance?.status ?? '' });
    completeCount++;
  } else {
    requirements.push({ key: 'finalized_assessment', label: 'Finalized assessment', status: 'incomplete', detail: 'No finalized assessment linked' });
  }

  // 2. Assessment scores available
  totalRequired++;
  if (workspace.assessment_instance?.overall_score != null) {
    requirements.push({ key: 'assessment_scores', label: 'Assessment scores', status: 'complete', detail: 'Overall score available' });
    completeCount++;
  } else {
    requirements.push({ key: 'assessment_scores', label: 'Assessment scores', status: 'incomplete', detail: 'No scores calculated yet' });
  }

  // 3. At least one desired outcome
  totalRequired++;
  if (workspace.goals.length > 0) {
    requirements.push({ key: 'desired_outcomes', label: 'Desired outcomes', status: 'complete', detail: `${workspace.goals.length} outcome(s) defined` });
    completeCount++;
  } else {
    requirements.push({ key: 'desired_outcomes', label: 'Desired outcomes', status: 'incomplete', detail: 'No outcomes defined' });
  }

  // 4. Program inventory reviewed
  totalRequired++;
  if (workspace.utilizationRecords.length > 0 || workspace.resourceGaps.length > 0) {
    requirements.push({ key: 'program_inventory', label: 'Program inventory', status: 'complete', detail: 'Programs reviewed' });
    completeCount++;
  } else {
    requirements.push({ key: 'program_inventory', label: 'Program inventory', status: 'incomplete', detail: 'No programs entered' });
  }

  // 5. Utilization entered or explicitly marked unavailable
  totalRequired++;
  if (workspace.utilizationRecords.length > 0) {
    requirements.push({ key: 'utilization_data', label: 'Utilization data', status: 'complete', detail: `${workspace.utilizationRecords.length} record(s)` });
    completeCount++;
  } else {
    const hasUnavailableNote = workspace.notes.some(
      (n) => n.note_type === 'data_limitation' && n.content.toLowerCase().includes('utilization') && n.content.toLowerCase().includes('unavailable')
    );
    if (hasUnavailableNote) {
      requirements.push({ key: 'utilization_data', label: 'Utilization data', status: 'unavailable', detail: 'Explicitly marked unavailable' });
    } else {
      requirements.push({ key: 'utilization_data', label: 'Utilization data', status: 'incomplete', detail: 'No utilization data entered' });
    }
  }

  // 6. Resource gaps reviewed
  totalRequired++;
  if (workspace.resourceGaps.length > 0) {
    requirements.push({ key: 'resource_gaps', label: 'Resource gaps', status: 'complete', detail: `${workspace.resourceGaps.length} gap(s) identified` });
    completeCount++;
  } else {
    requirements.push({ key: 'resource_gaps', label: 'Resource gaps', status: 'incomplete', detail: 'No gaps reviewed' });
  }

  // 7. Notes and data limitations reviewed
  totalRequired++;
  if (workspace.notes.length > 0) {
    requirements.push({ key: 'notes_reviewed', label: 'Notes and data limitations', status: 'complete', detail: `${workspace.notes.length} note(s)` });
    completeCount++;
  } else {
    requirements.push({ key: 'notes_reviewed', label: 'Notes and data limitations', status: 'incomplete', detail: 'No notes added' });
  }

  // 8. Evidence sources (optional)
  if (workspace.evidenceSources.length > 0) {
    requirements.push({ key: 'evidence_sources', label: 'Evidence sources', status: 'complete', detail: `${workspace.evidenceSources.length} source(s)` });
  } else {
    requirements.push({ key: 'evidence_sources', label: 'Evidence sources', status: 'optional', detail: 'Optional but recommended' });
  }

  // Determine level
  let level: CompletenessLevel;
  const hasEvidence = workspace.evidenceSources.length > 0;
  if (completeCount === totalRequired && hasEvidence) {
    level = 'strong';
  } else if (completeCount === totalRequired) {
    level = 'sufficient';
  } else if (completeCount >= 4) {
    level = 'limited';
  } else {
    level = 'not_ready';
  }

  return { level, requirements, complete_count: completeCount, total_required: totalRequired };
}

export async function evaluateReadinessServer(workspaceId: string): Promise<ReadinessEvaluation> {
  const { data, error } = await supabase.rpc('evaluate_workspace_readiness', {
    p_workspace_id: workspaceId,
  });
  if (error) {
    logDbError({ fn: 'evaluateReadinessServer', error });
    throw error;
  }
  return data as ReadinessEvaluation;
}

export function canCreateSnapshot(
  capabilities: Set<OrganizationCapability>,
  workspaceStatus: WorkspaceStatus
): boolean {
  return (
    hasCapability(capabilities, 'edit_strategy_analysis') &&
    workspaceStatus !== 'finalized'
  );
}

export function validateSnapshotPrerequisites(readiness: ReadinessEvaluation): string | null {
  if (readiness.level === 'not_ready') {
    return 'Workspace is not ready for snapshot creation. Complete more requirements first.';
  }
  return null;
}

// ============================================================
// Snapshot CRUD
// ============================================================

export async function fetchSnapshotsForWorkspace(workspaceId: string): Promise<AnalysisInputSnapshotRow[]> {
  const { data, error } = await supabase
    .from('analysis_input_snapshots')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('snapshot_version', { ascending: false });
  if (error) {
    logDbError({ fn: 'fetchSnapshotsForWorkspace', error });
    throw error;
  }
  return data ?? [];
}

export async function createSnapshot(workspaceId: string): Promise<CreateSnapshotResult> {
  const { data, error } = await supabase.rpc('create_analysis_snapshot', {
    p_workspace_id: workspaceId,
  });
  if (error) {
    logDbError({ fn: 'createSnapshot', error });
    throw error;
  }
  return data as CreateSnapshotResult;
}

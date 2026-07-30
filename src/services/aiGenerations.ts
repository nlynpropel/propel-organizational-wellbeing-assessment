import { supabase } from '../lib/supabase';
import { logDbError } from '../lib/logger';
import { isFeatureEnabled } from '../lib/featureFlags';
import { hasCapability } from './capabilities';
import type {
  AnalysisGenerationRow,
  GenerationType,
  GenerationStatus,
  AnalysisInputSnapshotRow,
  OrganizationCapability,
} from '../lib/database.types';

export const GENERATION_TYPES: GenerationType[] = ['strategy_poc'];
export const GENERATION_STATUSES: GenerationStatus[] = [
  'queued',
  'generating',
  'draft_generated',
  'failed',
  'approved',
  'rejected',
];

export const GENERATION_STATUS_LABELS: Record<GenerationStatus, string> = {
  queued: 'Generating',
  generating: 'Generating',
  draft_generated: 'Draft',
  failed: 'Generation failed',
  approved: 'Approved',
  rejected: 'Draft rejected',
};

export const GENERATION_STATUS_VARIANTS: Record<GenerationStatus, 'neutral' | 'info' | 'progress' | 'success' | 'warning' | 'danger'> = {
  queued: 'neutral',
  generating: 'info',
  draft_generated: 'progress',
  failed: 'danger',
  approved: 'success',
  rejected: 'warning',
};

export type CreateGenerationInput = {
  workspace_id: string;
  snapshot_id: string;
  generation_type?: GenerationType;
  model_name: string;
  prompt_version: string;
  created_by: string;
};

export function validateGenerationInput(input: CreateGenerationInput): string | null {
  if (!input.workspace_id) return 'Workspace ID is required';
  if (!input.snapshot_id) return 'Snapshot ID is required';
  if (!GENERATION_TYPES.includes(input.generation_type ?? 'strategy_poc')) {
    return 'Invalid generation type';
  }
  if (!input.model_name.trim()) return 'Model name is required';
  if (!input.prompt_version.trim()) return 'Prompt version is required';
  if (!input.created_by) return 'Created by is required';
  return null;
}

export async function fetchGenerationsForWorkspace(
  workspaceId: string
): Promise<AnalysisGenerationRow[]> {
  const { data, error } = await supabase
    .from('analysis_generations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  if (error) {
    logDbError({ fn: 'fetchGenerationsForWorkspace', error });
    throw error;
  }
  return (data ?? []) as AnalysisGenerationRow[];
}

export async function fetchGenerationById(
  generationId: string
): Promise<AnalysisGenerationRow | null> {
  const { data, error } = await supabase
    .from('analysis_generations')
    .select('*')
    .eq('id', generationId)
    .maybeSingle();
  if (error) {
    logDbError({ fn: 'fetchGenerationById', error });
    throw error;
  }
  return data as AnalysisGenerationRow | null;
}

export async function createGeneration(
  input: CreateGenerationInput
): Promise<AnalysisGenerationRow> {
  const validationError = validateGenerationInput(input);
  if (validationError) throw new Error(validationError);

  if (!isFeatureEnabled('ENABLE_AI_ANALYSIS')) {
    throw new Error('AI analysis is not enabled. Contact your platform administrator.');
  }

  const { data: snapshot, error: snapErr } = await supabase
    .from('analysis_input_snapshots')
    .select('snapshot_version, completeness_level')
    .eq('id', input.snapshot_id)
    .maybeSingle();
  if (snapErr) {
    logDbError({ fn: 'createGeneration.snapshotLookup', error: snapErr });
    throw snapErr;
  }
  if (!snapshot) throw new Error('Snapshot not found');

  const completeness = snapshot.completeness_level as string;
  if (completeness !== 'sufficient' && completeness !== 'strong') {
    throw new Error(
      'Snapshot readiness is below sufficient. Only sufficient or strong snapshots can be used for generation.'
    );
  }

  // Block if an active generation already exists for this snapshot
  const { data: existing, error: existingErr } = await supabase
    .from('analysis_generations')
    .select('id, status')
    .eq('snapshot_id', input.snapshot_id)
    .in('status', ['queued', 'generating'])
    .maybeSingle();
  if (existingErr) {
    logDbError({ fn: 'createGeneration.activeCheck', error: existingErr });
    throw existingErr;
  }
  if (existing) {
    throw new Error('An active generation already exists for this snapshot. Wait for it to complete before starting a new one.');
  }

  const { data, error } = await supabase
    .from('analysis_generations')
    .insert({
      workspace_id: input.workspace_id,
      snapshot_id: input.snapshot_id,
      generation_type: input.generation_type ?? 'strategy_poc',
      status: 'queued',
      model_name: input.model_name,
      prompt_version: input.prompt_version,
      input_snapshot_version: snapshot.snapshot_version as number,
      output_json: null,
      error_message: null,
      created_by: input.created_by,
    })
    .select()
    .single();
  if (error) {
    logDbError({ fn: 'createGeneration', error });
    throw error;
  }
  return data as AnalysisGenerationRow;
}


// ============================================================
// Review workflow
// ============================================================

export type ReviewableGeneration = AnalysisGenerationRow;

export function canReviewGeneration(
  capabilities: Set<OrganizationCapability>
): boolean {
  return hasCapability(capabilities, 'edit_strategy_analysis') ||
    hasCapability(capabilities, 'approve_strategy_analysis');
}

export function canApproveGeneration(
  capabilities: Set<OrganizationCapability>
): boolean {
  return hasCapability(capabilities, 'approve_strategy_analysis');
}

export function canEditGeneration(
  capabilities: Set<OrganizationCapability>
): boolean {
  return hasCapability(capabilities, 'edit_strategy_analysis');
}

export function canRegenerate(
  capabilities: Set<OrganizationCapability>,
  generations: AnalysisGenerationRow[]
): boolean {
  if (!isFeatureEnabled('ENABLE_AI_ANALYSIS')) return false;
  if (!hasCapability(capabilities, 'generate_ai_analysis')) return false;
  const hasActive = generations.some(g => g.status === 'queued' || g.status === 'generating');
  return !hasActive;
}

export function isGenerationReadOnly(status: GenerationStatus): boolean {
  return status === 'approved' || status === 'rejected';
}

export type ReviewedOutput = {
  executive_summary: string;
  maturity_interpretation: string;
  prioritized_barriers: Array<{
    title: string;
    description: string;
  }>;
  priority_recommendations: Array<{
    title: string;
    why_this_matters: string;
    assessment_evidence: string;
    propel_knowledge_evidence: string;
    recommended_action: string;
    suggested_first_step: string;
    expected_strategic_impact: string;
    implementation_sequence: string;
    evidence_references: Array<{ path: string; label: string }>;
  }>;
  implementation_sequence: string[];
  client_discussion_questions: string[];
  limitations: string;
  source_references: Array<{
    source_title: string;
    source_type: "propel_knowledge";
    file_id: string | null;
  }>;
  evidence_references: Array<{ path: string; label: string }>;
};

export async function saveReviewEdits(
  generationId: string,
  reviewedOutput: ReviewedOutput
): Promise<void> {
  const { error } = await supabase.rpc('save_generation_review_edits', {
    p_generation_id: generationId,
    p_reviewed_output: reviewedOutput as unknown as Record<string, unknown>,
  });
  if (error) {
    logDbError({ fn: 'saveReviewEdits', error });
    throw new Error(error.message || 'Failed to save review edits.');
  }
}

export async function approveGeneration(
  generationId: string,
  _reviewerId: string,
  reviewedOutput?: ReviewedOutput
): Promise<void> {
  const { error } = await supabase.rpc('approve_generation', {
    p_generation_id: generationId,
    p_reviewed_output: reviewedOutput
      ? (reviewedOutput as unknown as Record<string, unknown>)
      : null,
  });
  if (error) {
    logDbError({ fn: 'approveGeneration', error });
    throw new Error(error.message || 'Failed to approve generation.');
  }
}

export async function rejectGeneration(
  generationId: string,
  _reviewerId: string,
  rejectionReason: string
): Promise<void> {
  if (!rejectionReason.trim()) {
    throw new Error('A rejection reason is required.');
  }

  const { error } = await supabase.rpc('reject_generation', {
    p_generation_id: generationId,
    p_rejection_reason: rejectionReason,
  });
  if (error) {
    logDbError({ fn: 'rejectGeneration', error });
    throw new Error(error.message || 'Failed to reject generation.');
  }
}

export async function deleteGeneration(generationId: string): Promise<void> {
  const { error } = await supabase
    .from('analysis_generations')
    .delete()
    .eq('id', generationId);
  if (error) {
    logDbError({ fn: 'deleteGeneration', error });
    throw error;
  }
}

export function canCreateGeneration(
  snapshot: AnalysisInputSnapshotRow | null
): boolean {
  if (!isFeatureEnabled('ENABLE_AI_ANALYSIS')) return false;
  if (!snapshot) return false;
  const level = snapshot.completeness_level as string;
  return level === 'sufficient' || level === 'strong';
}

// ============================================================
// Evidence path normalization
// ============================================================

const ASSESSMENT_NESTED_KEYS = new Set([
  'strategy_dimension_scores',
  'behavioral_readiness',
  'contextual_responses',
  'diagnostic_findings',
  'template_name',
  'template_description',
  'instance_status',
  'submitted_at',
  'overall_score',
  'maturity_band',
]);

export function normalizeEvidencePath(path: string): string {
  if (!path) return path;
  const parts = path.split('.');
  // Extract the key name before any array bracket: "contextual_responses[1]" -> "contextual_responses"
  const firstKey = parts[0].replace(/\[.*$/, '');
  if (firstKey !== parts[0] && ASSESSMENT_NESTED_KEYS.has(firstKey)) {
    return `assessment.${path}`;
  }
  if (parts.length > 0 && ASSESSMENT_NESTED_KEYS.has(parts[0])) {
    return `assessment.${path}`;
  }
  return path;
}

export function getDisplayOutput(gen: AnalysisGenerationRow): Record<string, unknown> | null {
  return gen.reviewed_output_json ?? gen.output_json ?? null;
}

// ============================================================
// Broker-facing strategy generation (auto-create workspace + snapshot)
// ============================================================

export type AutoCreateResult = {
  workspace_id: string;
  snapshot_id: string;
  snapshot_version: number;
};

export async function autoCreateWorkspaceAndSnapshot(
  assessmentInstanceId: string
): Promise<AutoCreateResult> {
  const { data, error } = await supabase.rpc('auto_create_workspace_and_snapshot', {
    p_assessment_instance_id: assessmentInstanceId,
  });
  if (error) {
    logDbError({ fn: 'autoCreateWorkspaceAndSnapshot', error });
    throw new Error(error.message || 'Failed to prepare strategy report.');
  }
  // PostgREST returns RETURNS TABLE functions as an array; take the single row
  const rows = data as unknown as AutoCreateResult[];
  const result = Array.isArray(rows) ? rows[0] : (data as AutoCreateResult);
  if (!result?.workspace_id || !result?.snapshot_id) {
    throw new Error('Failed to prepare strategy report: workspace or snapshot missing.');
  }
  return result;
}

export async function fetchGenerationsForAssessmentInstance(
  assessmentInstanceId: string
): Promise<AnalysisGenerationRow[]> {
  const { data, error } = await supabase
    .from('analysis_generations')
    .select(`
      *,
      workspace:analysis_workspaces!inner(assessment_instance_id)
    `)
    .eq('workspace.assessment_instance_id', assessmentInstanceId)
    .order('created_at', { ascending: false });
  if (error) {
    logDbError({ fn: 'fetchGenerationsForAssessmentInstance', error });
    throw error;
  }
  return (data ?? []) as AnalysisGenerationRow[];
}

export async function generateStrategyReport(
  assessmentInstanceId: string,
  createdBy: string
): Promise<AnalysisGenerationRow> {
  if (!isFeatureEnabled('ENABLE_AI_ANALYSIS')) {
    throw new Error('AI analysis is not enabled. Contact your platform administrator.');
  }

  const { workspace_id, snapshot_id } = await autoCreateWorkspaceAndSnapshot(
    assessmentInstanceId
  );

  const generation = await createGeneration({
    workspace_id,
    snapshot_id,
    created_by: createdBy,
    model_name: 'gpt-4o',
    prompt_version: 'strategy-poc-v2',
  });

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-strategy-poc`;
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      workspace_id,
      snapshot_id,
      generation_id: generation.id,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Generation failed: ${response.status} ${body}`);
  }

  const refreshed = await fetchGenerationById(generation.id);
  return refreshed ?? generation;
}

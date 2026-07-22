import { supabase } from '../lib/supabase';
import { logDbError } from '../lib/logger';
import type {
  AnalysisGenerationRow,
  GenerationType,
  GenerationStatus,
  AnalysisInputSnapshotRow,
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
  queued: 'Queued',
  generating: 'Generating',
  draft_generated: 'Draft Generated',
  failed: 'Failed',
  approved: 'Approved',
  rejected: 'Rejected',
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
  return data ?? [];
}

export async function createGeneration(
  input: CreateGenerationInput
): Promise<AnalysisGenerationRow> {
  const validationError = validateGenerationInput(input);
  if (validationError) throw new Error(validationError);

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
  return data;
}

export async function updateGenerationStatus(
  generationId: string,
  status: GenerationStatus,
  extra?: { output_json?: Record<string, unknown> | null; error_message?: string | null }
): Promise<AnalysisGenerationRow> {
  const { data, error } = await supabase
    .from('analysis_generations')
    .update({ status, ...extra })
    .eq('id', generationId)
    .select()
    .single();
  if (error) {
    logDbError({ fn: 'updateGenerationStatus', error });
    throw error;
  }
  return data;
}

export async function reviewGeneration(
  generationId: string,
  reviewerId: string,
  approved: boolean
): Promise<AnalysisGenerationRow> {
  const { data, error } = await supabase
    .from('analysis_generations')
    .update({
      status: approved ? 'approved' : 'rejected',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', generationId)
    .select()
    .single();
  if (error) {
    logDbError({ fn: 'reviewGeneration', error });
    throw error;
  }
  return data;
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
  if (!snapshot) return false;
  const level = snapshot.completeness_level as string;
  return level === 'sufficient' || level === 'strong';
}

// ============================================================
// Presentation Generations — client-side service
// Handles creating, fetching, and downloading PowerPoint decks
// ============================================================

import { supabase } from '../lib/supabase';
import { logDbError } from '../lib/logger';
import type {
  PresentationGenerationRow,
  PresentationGenerationStatus,
  OrganizationCapability,
} from '../lib/database.types';
import { hasCapability } from './capabilities';
import type { DeckPayload } from './deckPayload';
import {
  validateDeckPayload,
  validateDeckOverflow,
  validateNoProhibitedMetadata,
  validateNoPlaceholderTokens,
} from './deckPayload';

export const TEMPLATE_VERSION = 'opportunity-index-deck-v1';

// ============================================================
// Authorization
// ============================================================

export function canGeneratePresentation(
  capabilities: Set<OrganizationCapability>,
  role: string | null
): boolean {
  if (role === 'superadmin') return true;
  if (role === 'propel_csm') return hasCapability(capabilities, 'generate_ai_analysis');
  if (role === 'propel_sales') return hasCapability(capabilities, 'generate_ai_analysis');
  return false;
}

export function canDownloadPresentation(
  capabilities: Set<OrganizationCapability>,
  role: string | null
): boolean {
  if (role === 'superadmin') return true;
  if (role === 'propel_csm') return true;
  if (role === 'propel_sales') return hasCapability(capabilities, 'view_reports') || hasCapability(capabilities, 'generate_ai_analysis');
  if (role === 'broker') return true; // RLS enforces per-instance access
  return false;
}

// ============================================================
// Validation — runs before creating the generation record
// ============================================================

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  overflowViolations: string[];
  metadataViolations: string[];
  placeholderViolations: string[];
};

export function validatePayloadForGeneration(payload: DeckPayload): ValidationResult {
  const errors = validateDeckPayload(payload);
  const overflow = validateDeckOverflow(payload);
  const metadata = validateNoProhibitedMetadata(payload);
  const placeholders = validateNoPlaceholderTokens(payload);

  return {
    valid: errors.length === 0 && overflow.length === 0 && metadata.length === 0 && placeholders.length === 0,
    errors: errors.map(e => e.message),
    overflowViolations: overflow.map(v => v.message),
    metadataViolations: metadata,
    placeholderViolations: placeholders,
  };
}

// ============================================================
// Fetch presentation generations for an assessment instance
// ============================================================

export async function fetchPresentationGenerations(
  assessmentInstanceId: string
): Promise<PresentationGenerationRow[]> {
  const { data, error } = await supabase
    .from('presentation_generations')
    .select('*')
    .eq('assessment_instance_id', assessmentInstanceId)
    .order('created_at', { ascending: false });

  if (error) {
    logDbError({ fn: 'fetchPresentationGenerations', error });
    throw error;
  }

  return (data ?? []) as PresentationGenerationRow[];
}

// ============================================================
// Create a presentation generation record
// ============================================================

export async function createPresentationGeneration(input: {
  assessmentInstanceId: string;
  strategyGenerationId: string;
  payload: DeckPayload;
  generatedBy: string;
  supersedesGenerationId?: string;
}): Promise<PresentationGenerationRow> {
  const { error, data } = await supabase
    .from('presentation_generations')
    .insert({
      assessment_instance_id: input.assessmentInstanceId,
      strategy_generation_id: input.strategyGenerationId,
      template_version: TEMPLATE_VERSION,
      status: 'queued',
      payload_snapshot_json: input.payload as unknown as Record<string, unknown>,
      generated_by: input.generatedBy,
      supersedes_generation_id: input.supersedesGenerationId ?? null,
    })
    .select()
    .single();

  if (error) {
    logDbError({ fn: 'createPresentationGeneration', error });
    throw error;
  }

  return data as PresentationGenerationRow;
}

// ============================================================
// Trigger deck generation via edge function
// ============================================================

export async function triggerDeckGeneration(input: {
  presentationGenerationId: string;
  assessmentInstanceId: string;
  strategyGenerationId: string;
  payload: DeckPayload;
}): Promise<void> {
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-presentation`;
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
      presentation_generation_id: input.presentationGenerationId,
      assessment_instance_id: input.assessmentInstanceId,
      strategy_generation_id: input.strategyGenerationId,
      payload: input.payload,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Deck generation failed: ${response.status} ${body}`);
  }
}

// ============================================================
// Get a signed download URL
// ============================================================

export async function getSignedDownloadUrl(
  storagePath: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from('strategy-presentations')
    .createSignedUrl(storagePath, 300); // 5 minutes

  if (error || !data?.signedUrl) {
    logDbError({ fn: 'getSignedDownloadUrl', error });
    throw new Error('Failed to generate download link');
  }

  return data.signedUrl;
}

// ============================================================
// Download the file (triggers browser download)
// ============================================================

export async function downloadPresentation(
  storagePath: string,
  fileName: string
): Promise<void> {
  const signedUrl = await getSignedDownloadUrl(storagePath);

  // Fetch the file content and trigger download
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error('Failed to download file');

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// ============================================================
// Status labels
// ============================================================

export const PRESENTATION_STATUS_LABELS: Record<PresentationGenerationStatus, string> = {
  queued: 'Queued',
  generating: 'Generating',
  completed: 'Ready',
  failed: 'Failed',
};

export const PRESENTATION_STATUS_VARIANTS: Record<
  PresentationGenerationStatus,
  'neutral' | 'info' | 'progress' | 'success' | 'warning' | 'danger'
> = {
  queued: 'neutral',
  generating: 'info',
  completed: 'success',
  failed: 'danger',
};

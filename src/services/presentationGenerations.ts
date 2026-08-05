// ============================================================
// Presentation Generations — client-side service
// Handles creating, fetching, and downloading PowerPoint decks
// The browser sends only IDs — the server builds the payload.
// ============================================================

import { supabase } from '../lib/supabase';
import { logDbError } from '../lib/logger';
import type {
  PresentationGenerationRow,
  PresentationGenerationStatus,
} from '../lib/database.types';

export const TEMPLATE_VERSION = 'opportunity-index-deck-v1';

// ============================================================
// Authorization
// ============================================================

export function canGeneratePresentation(
  _capabilities: Set<string>,
  role: string | null
): boolean {
  return role === 'superadmin' || role === 'propel_csm';
}

export function canDownloadPresentation(
  _capabilities: Set<string>,
  role: string | null
): boolean {
  return role === 'superadmin' || role === 'propel_csm' || role === 'propel_sales' || role === 'broker';
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
// Create a presentation generation record (no payload — server builds it)
// ============================================================

export async function createPresentationGeneration(input: {
  assessmentInstanceId: string;
  strategyGenerationId: string;
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
// Trigger deck generation via edge function (sends only IDs)
// ============================================================

export async function triggerDeckGeneration(input: {
  presentationGenerationId: string;
  assessmentInstanceId: string;
  strategyGenerationId: string;
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
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Deck generation failed: ${response.status} ${body}`);
  }
}

// ============================================================
// Get a signed download URL via authorized edge function
// ============================================================

export async function getSignedDownloadUrl(
  presentationGenerationId: string
): Promise<{ signedUrl: string; fileName: string }> {
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-presentation`;
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
      presentation_generation_id: presentationGenerationId,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Failed to get download link: ${response.status} ${body}`);
  }

  const data = await response.json();
  return {
    signedUrl: data.signed_url,
    fileName: data.file_name,
  };
}

// ============================================================
// Download the file (triggers browser download via signed URL)
// ============================================================

export async function downloadPresentation(
  presentationGenerationId: string
): Promise<void> {
  const { signedUrl, fileName } = await getSignedDownloadUrl(presentationGenerationId);

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

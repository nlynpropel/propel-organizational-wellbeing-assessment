import { supabase } from '../lib/supabase';
import { logDbError } from '../lib/logger';
import type { Propel360GenerationRow } from '../lib/database.types';

const PROMPT_VERSION = '360-v1';
const MODEL = 'gpt-4o';

export async function fetch360GenerationsForInstance(
  assessmentInstanceId: string
): Promise<Propel360GenerationRow[]> {
  const { data, error } = await supabase
    .from('propel_360_generations')
    .select('*')
    .eq('assessment_instance_id', assessmentInstanceId)
    .order('created_at', { ascending: false });
  if (error) {
    logDbError({ fn: 'fetch360GenerationsForInstance', error });
    throw error;
  }
  return (data ?? []) as Propel360GenerationRow[];
}

export async function fetchLatest360Generation(
  assessmentInstanceId: string
): Promise<Propel360GenerationRow | null> {
  const { data, error } = await supabase
    .from('propel_360_generations')
    .select('*')
    .eq('assessment_instance_id', assessmentInstanceId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    logDbError({ fn: 'fetchLatest360Generation', error });
    throw error;
  }
  return data as Propel360GenerationRow | null;
}

export async function generate360Analysis(
  assessmentInstanceId: string,
  createdBy: string
): Promise<Propel360GenerationRow> {
  // Find the latest existing completed generation to supersede
  const existing = await fetchLatest360Generation(assessmentInstanceId);

  const { data: generation, error } = await supabase
    .from('propel_360_generations')
    .insert({
      assessment_instance_id: assessmentInstanceId,
      status: 'queued',
      model: MODEL,
      prompt_version: PROMPT_VERSION,
      created_by: createdBy,
      supersedes_generation_id: existing?.id ?? null,
    })
    .select()
    .single();
  if (error) {
    logDbError({ fn: 'generate360Analysis.insert', error });
    throw error;
  }

  const gen = generation as Propel360GenerationRow;

  // Call the edge function
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-360-analysis`;
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      assessment_instance_id: assessmentInstanceId,
      generation_id: gen.id,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const msg = (body as { error?: string }).error ?? `Generation failed (${response.status})`;
    throw new Error(msg);
  }

  const refreshed = await fetch360GenerationsForInstance(assessmentInstanceId);
  return refreshed[0] ?? gen;
}

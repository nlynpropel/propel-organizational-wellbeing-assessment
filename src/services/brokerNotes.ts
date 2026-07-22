import { supabase } from '../lib/supabase';
import type { BrokerNoteRow } from '../lib/database.types';

/**
 * Fetch notes for an organization via the neutral organization model.
 * RLS policies enforce access via resolve_accessible_client_orgs.
 * The brokerId parameter is retained for backward compatibility but no longer
 * used as a client-side filter — RLS handles authorization.
 */
export async function fetchNotesForOrganization(
  _brokerId: string,
  organizationId: string
): Promise<BrokerNoteRow[]> {
  const { data, error } = await supabase
    .from('broker_notes')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createNote(
  brokerId: string,
  organizationId: string,
  noteText: string
): Promise<BrokerNoteRow> {
  const { data, error } = await supabase
    .from('broker_notes')
    .insert({
      broker_id: brokerId,
      organization_id: organizationId,
      note_text: noteText,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateNote(
  _brokerId: string,
  noteId: string,
  noteText: string
): Promise<BrokerNoteRow> {
  const { data, error } = await supabase
    .from('broker_notes')
    .update({ note_text: noteText })
    .eq('id', noteId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteNote(_brokerId: string, noteId: string): Promise<void> {
  const { error } = await supabase
    .from('broker_notes')
    .delete()
    .eq('id', noteId);
  if (error) throw error;
}

export type { BrokerNoteRow };

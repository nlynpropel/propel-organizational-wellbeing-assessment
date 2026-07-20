import { supabase } from '../lib/supabase';
import type { BrokerNoteRow } from '../lib/database.types';

export async function fetchNotesForOrganization(
  brokerId: string,
  organizationId: string
): Promise<BrokerNoteRow[]> {
  const { data, error } = await supabase
    .from('broker_notes')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('broker_id', brokerId)
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
  brokerId: string,
  noteId: string,
  noteText: string
): Promise<BrokerNoteRow> {
  const { data, error } = await supabase
    .from('broker_notes')
    .update({ note_text: noteText })
    .eq('id', noteId)
    .eq('broker_id', brokerId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteNote(brokerId: string, noteId: string): Promise<void> {
  const { error } = await supabase
    .from('broker_notes')
    .delete()
    .eq('id', noteId)
    .eq('broker_id', brokerId);
  if (error) throw error;
}

export type { BrokerNoteRow };

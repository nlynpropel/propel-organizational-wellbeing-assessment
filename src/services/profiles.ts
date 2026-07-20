import { supabase } from '../lib/supabase';
import type { ProfileRow, ProfileRole, ProfileStatus } from '../lib/database.types';

export async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateOwnProfile(
  userId: string,
  updates: { first_name?: string; last_name?: string; brokerage_name?: string }
): Promise<ProfileRow> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function completeAccountSetup(params: {
  first_name: string;
  last_name: string;
  average_client_size: 'small' | 'mid' | 'large';
  territory: string;
}): Promise<ProfileRow> {
  const { data, error } = await supabase.rpc('complete_account_setup', {
    p_first_name: params.first_name,
    p_last_name: params.last_name,
    p_avg_client_size: params.average_client_size,
    p_territory: params.territory,
  });
  if (error) throw error;
  return data as ProfileRow;
}

export async function fetchBrokerCount(): Promise<number> {
  const { count, error } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'broker');
  if (error) throw error;
  return count ?? 0;
}

export type { ProfileRow, ProfileRole, ProfileStatus };

import { supabase } from '../lib/supabase';
import type { ProfileRow } from '../lib/database.types';

/**
 * Admin-only: fetch all registered profiles via the admin_list_all_profiles RPC.
 * The RPC validates is_active_admin() internally and raises if not authorized.
 */
export async function fetchAllProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await supabase.rpc('admin_list_all_profiles');
  if (error) throw error;
  return (data ?? []) as ProfileRow[];
}

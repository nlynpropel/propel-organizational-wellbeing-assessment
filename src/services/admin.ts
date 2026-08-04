import { supabase } from '../lib/supabase';
import type { UserDirectoryRow, AuditLogRow } from '../lib/database.types';

export async function fetchAllUsers(): Promise<UserDirectoryRow[]> {
  const { data, error } = await supabase.rpc('admin_list_all_users');
  if (error) throw error;
  return (data ?? []) as UserDirectoryRow[];
}

export async function fetchAuditLog(): Promise<AuditLogRow[]> {
  const { data, error } = await supabase
    .from('auth_audit_log')
    .select('id, actor_id, target_id, action, previous_values, new_values, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as AuditLogRow[];
}

export async function inviteUser(params: {
  email: string;
  role: 'superadmin' | 'propel_csm' | 'propel_sales' | 'broker';
  organization_id?: string;
}): Promise<{ user_id: string; sent: boolean; warning?: string }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const { data: session } = await supabase.auth.getSession();
  const accessToken = session.session?.access_token;
  if (!accessToken) throw new Error('Not authenticated');

  const response = await fetch(`${supabaseUrl}/functions/v1/admin-invite-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      email: params.email,
      role: params.role,
      organization_id: params.organization_id ?? null,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }

  const body = await response.json();
  return body;
}

export async function resendInvitation(userId: string): Promise<void> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const { data: session } = await supabase.auth.getSession();
  const accessToken = session.session?.access_token;
  if (!accessToken) throw new Error('Not authenticated');

  const response = await fetch(`${supabaseUrl}/functions/v1/admin-invite-user/resend`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ user_id: userId }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }
}

export async function repairUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_repair_user', { p_user_id: userId });
  if (error) throw error;
}

export async function changeUserRole(userId: string, role: 'superadmin' | 'propel_csm' | 'propel_sales' | 'broker'): Promise<void> {
  const { error } = await supabase.rpc('admin_change_user_role', {
    p_user_id: userId,
    p_role: role,
  });
  if (error) throw error;
}

export async function deleteUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_user', { p_user_id: userId });
  if (error) throw error;
}

export type { UserDirectoryRow, AuditLogRow };

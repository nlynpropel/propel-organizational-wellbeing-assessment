import { supabase } from '../lib/supabase';
import type { ApprovedDomainRow } from '../lib/database.types';

export async function fetchApprovedDomains(): Promise<ApprovedDomainRow[]> {
  const { data, error } = await supabase
    .from('approved_domains')
    .select('id, domain, organization_name, created_by, created_at')
    .order('domain');
  if (error) throw error;
  return data ?? [];
}

export async function addApprovedDomain(domain: string, organizationName?: string): Promise<ApprovedDomainRow> {
  const normalized = normalizeDomain(domain);
  if (!normalized) throw new Error('Invalid domain');
  const trimmedOrg = organizationName?.trim();
  const { data, error } = await supabase
    .from('approved_domains')
    .insert({ domain: normalized, organization_name: trimmedOrg || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeApprovedDomain(id: string): Promise<void> {
  const { error } = await supabase.from('approved_domains').delete().eq('id', id);
  if (error) throw error;
}

export function normalizeDomain(input: string): string {
  return input.trim().replace(/^@/, '').toLowerCase();
}

export async function isEmailDomainApproved(email: string): Promise<boolean> {
  const domain = extractDomain(email);
  if (!domain) return false;
  const domains = await fetchApprovedDomains();
  return domains.some((d) => d.domain === domain);
}

export function extractDomain(email: string): string {
  const at = email.lastIndexOf('@');
  if (at === -1 || at === email.length - 1) return '';
  return email.slice(at + 1).toLowerCase();
}

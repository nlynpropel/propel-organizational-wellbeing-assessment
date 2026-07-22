import { supabase } from '../lib/supabase';
import type {
  OrganizationMembershipRow,
  OrganizationType,
  MembershipRole,
  OrganizationCapability,
} from '../lib/database.types';

export type UserOrganization = {
  membership: OrganizationMembershipRow;
  organization: {
    id: string;
    organization_name: string;
    organization_type: OrganizationType | null;
  };
};

export async function fetchUserOrganizations(userId: string): Promise<UserOrganization[]> {
  const { data, error } = await supabase
    .from('organization_memberships')
    .select(
      '*, organization:organizations(id, organization_name, organization_type)'
    )
    .eq('profile_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    membership: row,
    organization: row.organization,
  })) as unknown as UserOrganization[];
}

export async function fetchUserCapabilities(userId: string): Promise<Set<OrganizationCapability>> {
  const { data, error } = await supabase
    .from('organization_memberships')
    .select('role')
    .eq('profile_id', userId)
    .eq('status', 'active');

  if (error) throw error;

  const roles = new Set<string>((data ?? []).map((m: { role: string }) => m.role));
  if (roles.size === 0) return new Set();

  const { data: caps, error: capErr } = await supabase
    .from('organization_role_capabilities')
    .select('capability')
    .in('role', Array.from(roles));

  if (capErr) throw capErr;

  return new Set(
    (caps ?? []).map((c: { capability: string }) => c.capability as OrganizationCapability)
  );
}

export function hasCapability(
  capabilities: Set<OrganizationCapability>,
  cap: OrganizationCapability
): boolean {
  return capabilities.has(cap);
}

export function isPlatformAdmin(
  memberships: (OrganizationMembershipRow | null | undefined)[]
): boolean {
  return memberships.some(
    (m) => m != null && m.role === 'platform_admin' && m.status === 'active'
  );
}

export function getPrimaryMembershipRole(
  memberships: (OrganizationMembershipRow | null | undefined)[]
): MembershipRole | null {
  const valid = memberships.filter((m): m is OrganizationMembershipRow => m != null);
  if (valid.length === 0) return null;
  const priority: MembershipRole[] = [
    'platform_admin',
    'organization_admin',
    'advisor',
    'client_manager',
    'employer_admin',
    'viewer',
  ];
  for (const role of priority) {
    const m = valid.find((m) => m.role === role && m.status === 'active');
    if (m) return m.role;
  }
  return valid[0].role;
}

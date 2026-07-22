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

type RawMembershipRow = Record<string, unknown> & {
  id: string;
  organization_id: string;
  profile_id: string;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
  organization?: unknown;
};

function normalizeOrganization(org: unknown): UserOrganization['organization'] | null {
  if (!org) return null;
  if (Array.isArray(org)) {
    const first = org[0] as Record<string, unknown> | undefined;
    if (!first) return null;
    return {
      id: first.id as string,
      organization_name: first.organization_name as string,
      organization_type: (first.organization_type as OrganizationType) ?? null,
    };
  }
  const o = org as Record<string, unknown>;
  return {
    id: o.id as string,
    organization_name: o.organization_name as string,
    organization_type: (o.organization_type as OrganizationType) ?? null,
  };
}

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

  return ((data ?? []) as RawMembershipRow[])
    .map((row) => {
      const organization = normalizeOrganization(row.organization);
      if (!organization) return null;
      const { organization: _org, ...membership } = row;
      return { membership, organization } as UserOrganization;
    })
    .filter((o): o is UserOrganization => o !== null);
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

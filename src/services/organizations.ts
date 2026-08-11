import { supabase } from '../lib/supabase';
import type { OrganizationRow, FundingTypeDb } from '../lib/database.types';
import type { AssessmentInstanceRow, AssessmentTemplateRow, AssessmentVersionRow } from '../lib/database.types';

export type OrganizationWithAssessment = OrganizationRow & {
  latest_assessment: (AssessmentInstanceRow & { assessment_versions?: { scoring_method: string } | null }) | null;
  assessment_instances: AssessmentInstanceRow[];
};

export type InstanceWithTemplate = AssessmentInstanceRow & {
  template: AssessmentTemplateRow | null;
  version: AssessmentVersionRow | null;
};

export type CreateOrganizationInput = {
  organization_name: string;
  organization_alias?: string;
  industry?: string;
  employee_count_range?: string;
  employee_count?: number;
  number_of_locations?: number;
  funding_type?: FundingTypeDb;
  renewal_month?: number;
  client_contact_name?: string;
  client_contact_email?: string;
};

/**
 * Resolve the accessible client organization IDs for the current user
 * via the neutral organization model (memberships + client relationships).
 * Falls back to legacy broker_id ownership.
 */
export async function fetchAccessibleClientOrgIds(): Promise<string[]> {
  const { data, error } = await supabase.rpc('resolve_accessible_client_orgs');
  if (error) throw error;
  return (data ?? []) as string[];
}

/**
 * Resolve the service organization ID for the current user
 * (their primary membership organization).
 */
export async function fetchServiceOrganizationId(): Promise<string | null> {
  const { data, error } = await supabase.rpc('resolve_service_organization_id');
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function fetchOrganizations(
  _brokerId: string,
  opts?: {
    search?: string;
    industry?: string;
    includeArchived?: boolean;
  }
): Promise<OrganizationWithAssessment[]> {
  let query = supabase
    .from('organizations')
    .select('*, assessment_instances(*, assessment_versions(scoring_method))');

  if (!opts?.includeArchived) {
    query = query.is('archived_at', null);
  }
  if (opts?.search) {
    query = query.ilike('organization_name', `%${opts.search}%`);
  }
  if (opts?.industry && opts.industry !== 'all') {
    query = query.eq('industry', opts.industry);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((org) => {
    const instances = (org.assessment_instances ?? []) as (AssessmentInstanceRow & { assessment_versions?: { scoring_method: string } | null })[];
    const sorted = instances.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const latest = sorted.length > 0 ? sorted[0] : null;
    const { assessment_instances, ...orgFields } = org;
    void assessment_instances;
    return { ...orgFields, latest_assessment: latest, assessment_instances: sorted } as OrganizationWithAssessment;
  });
}

export async function fetchOrganizationById(
  _brokerId: string,
  orgId: string
): Promise<OrganizationWithAssessment | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('*, assessment_instances(*, assessment_versions(scoring_method))')
    .eq('id', orgId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const instances = (data.assessment_instances ?? []) as (AssessmentInstanceRow & { assessment_versions?: { scoring_method: string } | null })[];
  const sorted = instances.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const latest = sorted.length > 0 ? sorted[0] : null;
  const { assessment_instances, ...orgFields } = data;
  void assessment_instances;
  return { ...orgFields, latest_assessment: latest, assessment_instances: sorted } as OrganizationWithAssessment;
}

export async function createOrganization(
  _brokerId: string,
  input: CreateOrganizationInput
): Promise<OrganizationRow> {
  const { data, error } = await supabase.rpc('create_client_organization', {
    p_organization_name: input.organization_name,
    p_organization_alias: input.organization_alias ?? null,
    p_industry: input.industry ?? null,
    p_employee_count_range: input.employee_count_range ?? null,
    p_employee_count: input.employee_count ?? null,
    p_number_of_locations: input.number_of_locations ?? null,
    p_funding_type: input.funding_type ?? null,
    p_renewal_month: input.renewal_month ?? null,
    p_client_contact_name: input.client_contact_name ?? null,
    p_client_contact_email: input.client_contact_email ?? null,
  });
  if (error) throw error;
  return data as OrganizationRow;
}

export async function fetchInstancesForOrganization(_brokerId: string, orgId: string): Promise<InstanceWithTemplate[]> {
  const { data, error } = await supabase
    .from('assessment_instances')
    .select('*, template:assessment_templates(*), version:assessment_versions(*)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as InstanceWithTemplate[];
}

export async function archiveOrganization(_brokerId: string, orgId: string): Promise<void> {
  const { error } = await supabase
    .from('organizations')
    .update({ archived_at: new Date().toISOString(), status: 'archived' })
    .eq('id', orgId);
  if (error) throw error;
}

export async function unarchiveOrganization(_brokerId: string, orgId: string): Promise<void> {
  const { error } = await supabase
    .from('organizations')
    .update({ archived_at: null, status: 'active' })
    .eq('id', orgId);
  if (error) throw error;
}

export type { OrganizationRow, FundingTypeDb };
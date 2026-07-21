import { supabase } from '../lib/supabase';
import type { OrganizationRow, FundingTypeDb } from '../lib/database.types';
import type { AssessmentInstanceRow, AssessmentTemplateRow, AssessmentVersionRow } from '../lib/database.types';

export type OrganizationWithAssessment = OrganizationRow & {
  latest_assessment: AssessmentInstanceRow | null;
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
  number_of_locations?: number;
  funding_type?: FundingTypeDb;
  renewal_month?: number;
  client_contact_name?: string;
  client_contact_email?: string;
};

export async function fetchOrganizations(
  brokerId: string,
  opts?: {
    search?: string;
    industry?: string;
    includeArchived?: boolean;
  }
): Promise<OrganizationWithAssessment[]> {
  let query = supabase
    .from('organizations')
    .select('*, assessment_instances(*)')
    .eq('broker_id', brokerId);

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

  // Reduce nested assessment_instances array to the most recent one.
  return (data ?? []).map((org) => {
    const instances = (org.assessment_instances ?? []) as AssessmentInstanceRow[];
    const sorted = instances.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const latest = sorted.length > 0 ? sorted[0] : null;
    const { assessment_instances, ...orgFields } = org;
    void assessment_instances;
    return { ...orgFields, latest_assessment: latest, assessment_instances: sorted } as OrganizationWithAssessment;
  });
}

export async function fetchOrganizationById(
  brokerId: string,
  orgId: string
): Promise<OrganizationWithAssessment | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('*, assessment_instances(*)')
    .eq('id', orgId)
    .eq('broker_id', brokerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const instances = (data.assessment_instances ?? []) as AssessmentInstanceRow[];
  const sorted = instances.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const latest = sorted.length > 0 ? sorted[0] : null;
  const { assessment_instances, ...orgFields } = data;
  void assessment_instances;
  return { ...orgFields, latest_assessment: latest, assessment_instances: sorted } as OrganizationWithAssessment;
}

export async function createOrganization(
  brokerId: string,
  input: CreateOrganizationInput
): Promise<OrganizationRow> {
  const { data, error } = await supabase
    .from('organizations')
    .insert({ ...input, broker_id: brokerId })
    .select()
    .single();
  if (error) throw error;
  return data;
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

export async function archiveOrganization(brokerId: string, orgId: string): Promise<void> {
  const { error } = await supabase
    .from('organizations')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', orgId)
    .eq('broker_id', brokerId);
  if (error) throw error;
}

export async function unarchiveOrganization(brokerId: string, orgId: string): Promise<void> {
  const { error } = await supabase
    .from('organizations')
    .update({ archived_at: null })
    .eq('id', orgId)
    .eq('broker_id', brokerId);
  if (error) throw error;
}

export type { OrganizationRow, FundingTypeDb };

import { supabase } from '../lib/supabase';
import type { AssessmentInstanceRow, AssessmentInstanceStatus } from '../lib/database.types';
import type { OrganizationRow } from './organizations';

export type AssessmentWithOrganization = AssessmentInstanceRow & {
  organization: Pick<OrganizationRow, 'id' | 'organization_name' | 'industry'>;
};

/**
 * Fetch assessments for the current user via the neutral organization model.
 * RLS policies enforce access via resolve_accessible_client_orgs.
 * The brokerId parameter is retained for backward compatibility but no longer
 * used as a query filter — RLS handles authorization.
 */
export async function fetchAssessmentsForBroker(
  _brokerId: string,
  opts?: { search?: string; status?: AssessmentInstanceStatus | 'all'; industry?: string }
): Promise<AssessmentWithOrganization[]> {
  let query = supabase
    .from('assessment_instances')
    .select('*, organization:organizations(id, organization_name, industry)');

  if (opts?.status && opts.status !== 'all') {
    query = query.eq('status', opts.status);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;

  let results = (data ?? []) as AssessmentWithOrganization[];

  if (opts?.search) {
    const q = opts.search.toLowerCase();
    results = results.filter((r) =>
      r.organization?.organization_name?.toLowerCase().includes(q)
    );
  }
  if (opts?.industry && opts.industry !== 'all') {
    results = results.filter((r) => r.organization?.industry === opts.industry);
  }

  return results;
}

export async function createDraftAssessment(
  brokerId: string,
  organizationId: string
): Promise<AssessmentInstanceRow> {
  const { data: tmpl, error: tmplErr } = await supabase
    .from('assessment_templates')
    .select('id, latest_version:assessment_versions!inner(id)')
    .eq('owner_type', 'propel')
    .eq('status', 'published')
    .eq('latest_version.status', 'published')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  const latestVersion = tmpl?.latest_version as unknown;
  const versionId = (Array.isArray(latestVersion) ? latestVersion[0]?.id : (latestVersion as { id?: string } | null)?.id) ?? undefined;
  const templateId = tmpl?.id;

  if (tmplErr || !versionId || !templateId) {
    throw new Error('No published Propel assessment template found. Publish an assessment before creating clients.');
  }

  const { data, error } = await supabase
    .from('assessment_instances')
    .insert({
      broker_id: brokerId,
      organization_id: organizationId,
      assessment_template_id: templateId,
      assessment_version_id: versionId,
      status: 'draft',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchAssessmentCountByStatus(
  _brokerId?: string
): Promise<Record<AssessmentInstanceStatus, number>> {
  const { data, error } = await supabase
    .from('assessment_instances')
    .select('status');
  if (error) throw error;

  const counts: Record<AssessmentInstanceStatus, number> = {
    draft: 0,
    sent: 0,
    not_opened: 0,
    opened: 0,
    in_progress: 0,
    submitted: 0,
    report_ready: 0,
    expired: 0,
    revoked: 0,
  };

  for (const row of data ?? []) {
    counts[row.status as AssessmentInstanceStatus]++;
  }
  return counts;
}

export async function fetchReportsReady(
  _brokerId?: string
): Promise<AssessmentWithOrganization[]> {
  const { data, error } = await supabase
    .from('assessment_instances')
    .select('*, organization:organizations(id, organization_name, industry)')
    .not('overall_score', 'is', null)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AssessmentWithOrganization[];
}

export type { AssessmentInstanceRow, AssessmentInstanceStatus };

import { supabase } from '../lib/supabase';
import type { AssessmentInstanceRow, AssessmentInstanceStatus, AssessmentTemplateRow, AssessmentVersionRow } from '../lib/database.types';
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

export type AccessibleAssessment = {
  template: AssessmentTemplateRow;
  version: AssessmentVersionRow;
};

export async function fetchAccessibleAssessments(role: string): Promise<AccessibleAssessment[]> {
  const { data: templates, error } = await supabase
    .from('assessment_templates')
    .select('*, latest_version:assessment_versions!inner(*)')
    .eq('status', 'published')
    .eq('latest_version.status', 'published')
    .order('name');

  if (error) throw error;
  if (!templates) return [];

  const results: AccessibleAssessment[] = [];
  for (const t of templates) {
    const latestVersion = Array.isArray(t.latest_version) ? t.latest_version[0] : t.latest_version;
    if (!latestVersion) continue;

    if (role === 'superadmin') {
      results.push({ template: t as AssessmentTemplateRow, version: latestVersion as AssessmentVersionRow });
      continue;
    }

    const { data: access } = await supabase
      .from('assessment_role_access')
      .select('can_view')
      .eq('assessment_template_id', t.id)
      .eq('role', role)
      .eq('can_view', true)
      .maybeSingle();

    if (access) {
      results.push({ template: t as AssessmentTemplateRow, version: latestVersion as AssessmentVersionRow });
    }
  }
  return results;
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
    .in('status', ['submitted', 'report_ready'])
    .not('overall_score', 'is', null)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AssessmentWithOrganization[];
}

export type { AssessmentInstanceRow, AssessmentInstanceStatus };

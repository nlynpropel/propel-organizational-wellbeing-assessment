import { supabase } from '../lib/supabase';
import { logDbError } from '../lib/logger';
import type { ReusableAssessmentLinkRow, IntakeSubmissionRow, ResolvedReusableLink } from '../lib/database.types';

export type GenerateLinkInput = {
  assessment_template_id: string;
  assessment_version_id: string;
  label?: string | null;
  expires_at?: string | null;
};

export async function generateReusableLink(
  input: GenerateLinkInput
): Promise<ReusableAssessmentLinkRow> {
  const { data, error } = await supabase.rpc('generate_reusable_link', {
    p_template_id: input.assessment_template_id,
    p_version_id: input.assessment_version_id,
    p_label: input.label ?? null,
    p_expires_at: input.expires_at ?? null,
  });

  if (error) {
    logDbError({ fn: 'generateReusableLink', error });
    throw error;
  }

  return data as ReusableAssessmentLinkRow;
}

export async function fetchReusableLinks(
  userId: string,
  isSuperadmin: boolean
): Promise<ReusableAssessmentLinkRow[]> {
  let query = supabase.from('reusable_assessment_links').select('*');

  if (!isSuperadmin) {
    query = query.eq('generating_user_id', userId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) {
    logDbError({ fn: 'fetchReusableLinks', error });
    throw error;
  }
  return (data ?? []) as ReusableAssessmentLinkRow[];
}

export async function updateReusableLink(
  linkId: string,
  updates: { label?: string | null; expires_at?: string | null; is_active?: boolean }
): Promise<void> {
  const { error } = await supabase
    .from('reusable_assessment_links')
    .update(updates)
    .eq('id', linkId);
  if (error) {
    logDbError({ fn: 'updateReusableLink', error });
    throw error;
  }
}

export async function deactivateReusableLink(linkId: string): Promise<void> {
  await updateReusableLink(linkId, { is_active: false });
}

export async function activateReusableLink(linkId: string): Promise<void> {
  await updateReusableLink(linkId, { is_active: true });
}

export async function fetchLinkSubmissions(
  linkId: string
): Promise<IntakeSubmissionRow[]> {
  const { data, error } = await supabase
    .from('intake_submissions')
    .select('*')
    .eq('reusable_link_id', linkId)
    .order('created_at', { ascending: false });
  if (error) {
    logDbError({ fn: 'fetchLinkSubmissions', error });
    throw error;
  }
  return (data ?? []) as IntakeSubmissionRow[];
}

// ============================================================
// Public RPCs (anon-accessible)
// ============================================================

export async function resolveReusableLink(
  token: string
): Promise<ResolvedReusableLink | { error: string }> {
  const { data, error } = await supabase.rpc('resolve_reusable_link', {
    p_token: token,
  });
  if (error) {
    logDbError({ fn: 'resolveReusableLink', error });
    throw error;
  }
  return data as ResolvedReusableLink | { error: string };
}

export async function createIntakeSubmission(params: {
  token: string;
  orgName: string;
  contactName: string;
  email: string;
  employeeCount: number;
  industry?: string;
}): Promise<{ submission_id: string; already_exists?: boolean } | { error: string }> {
  const { data, error } = await supabase.rpc('create_intake_submission', {
    p_token: params.token,
    p_org_name: params.orgName,
    p_contact_name: params.contactName,
    p_email: params.email,
    p_employee_count: params.employeeCount,
    p_industry: params.industry ?? null,
  });
  if (error) {
    logDbError({ fn: 'createIntakeSubmission', error });
    throw error;
  }
  return data as { submission_id: string; already_exists?: boolean } | { error: string };
}

export async function submitReusableAssessment(params: {
  token: string;
  submissionId: string;
  responses: Array<{
    question_id: string;
    selected_option_id?: string | null;
    numeric_value?: number | null;
    text_value?: string | null;
    boolean_value?: boolean | null;
  }>;
}): Promise<{ instance_id: string; secure_token: string; already_submitted?: boolean } | { error: string }> {
  const { data, error } = await supabase.rpc('submit_reusable_assessment', {
    p_token: params.token,
    p_submission_id: params.submissionId,
    p_responses: JSON.stringify(params.responses),
  });
  if (error) {
    logDbError({ fn: 'submitReusableAssessment', error });
    throw error;
  }
  return data as { instance_id: string; secure_token: string; already_submitted?: boolean } | { error: string };
}

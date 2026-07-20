import { supabase } from '../lib/supabase';
import { logDbError } from '../lib/logger';
import type {
  AssessmentTemplateRow,
  AssessmentVersionRow,
  AssessmentSectionRow,
  AssessmentQuestionRow,
  AssessmentQuestionOptionRow,
  AssessmentScoreBandRow,
  AssessmentInstanceRow,
  AssessmentResponseRow,
  AssessmentSectionScoreRow,
  AssessmentResultRow,
  AssessmentTemplateWithVersion,
  AssessmentSectionWithQuestions,
  AssessmentQuestionWithOptions,
  AssessmentOwnerType,
  AssessmentTemplateStatus,
  AssessmentQuestionType,
  AssessmentScoringMethod,
  ResolvedAssessment,
} from '../lib/database.types';

// ============================================================
// Templates
// ============================================================

export type CreateTemplateInput = {
  name: string;
  short_description?: string;
  full_description?: string;
  owner_type: AssessmentOwnerType;
  category?: string;
  estimated_minutes?: number;
  scoring_enabled: boolean;
  recommendations_enabled?: boolean;
};

export type UpdateTemplateInput = Partial<CreateTemplateInput> & {
  status?: AssessmentTemplateStatus;
};

export async function fetchTemplates(opts?: {
  ownerType?: AssessmentOwnerType;
  status?: AssessmentTemplateStatus;
  includeArchived?: boolean;
}): Promise<AssessmentTemplateWithVersion[]> {
  let query = supabase
    .from('assessment_templates')
    .select('*, latest_version:assessment_versions!inner(*)');

  if (opts?.ownerType) {
    query = query.eq('owner_type', opts.ownerType);
  }
  if (opts?.status && !opts.includeArchived) {
    query = query.eq('status', opts.status);
  }
  if (!opts?.includeArchived) {
    query = query.neq('status', 'archived');
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;

  return (data ?? []) as AssessmentTemplateWithVersion[];
}

export async function fetchTemplatesForBroker(brokerId: string): Promise<AssessmentTemplateWithVersion[]> {
  const { data, error } = await supabase
    .from('assessment_templates')
    .select('*, latest_version:assessment_versions!inner(*)')
    .or(`owner_type.eq.propel,and(owner_type.eq.broker,owner_profile_id.eq.${brokerId})`)
    .neq('status', 'archived')
    .order('created_at', { ascending: false });
  if (error) {
    logDbError({ fn: 'fetchTemplatesForBroker', route: '/assessments', error });
    throw error;
  }
  return (data ?? []) as AssessmentTemplateWithVersion[];
}

export async function fetchTemplateById(id: string): Promise<AssessmentTemplateRow | null> {
  const { data, error } = await supabase
    .from('assessment_templates')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createTemplate(input: CreateTemplateInput, createdBy: string): Promise<AssessmentTemplateRow> {
  const payload = {
    name: input.name,
    short_description: input.short_description ?? null,
    full_description: input.full_description ?? null,
    owner_type: input.owner_type,
    owner_profile_id: input.owner_type === 'broker' ? createdBy : null,
    status: 'draft' as AssessmentTemplateStatus,
    category: input.category ?? null,
    estimated_minutes: input.estimated_minutes ?? null,
    scoring_enabled: input.scoring_enabled,
    recommendations_enabled: input.owner_type === 'propel' ? (input.recommendations_enabled ?? false) : false,
    created_by: createdBy,
  };
  const { data, error } = await supabase
    .from('assessment_templates')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTemplate(id: string, updates: UpdateTemplateInput): Promise<AssessmentTemplateRow> {
  const { data, error } = await supabase
    .from('assessment_templates')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function archiveTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('assessment_templates')
    .update({ status: 'archived' })
    .eq('id', id);
  if (error) throw error;
}

// ============================================================
// Versions
// ============================================================

export type CreateVersionInput = {
  assessment_template_id: string;
  version_number: number;
  version_label?: string;
  introduction_text?: string;
  completion_message?: string;
  scoring_method?: AssessmentScoringMethod;
  show_overall_score?: boolean;
};

export async function fetchVersionsForTemplate(templateId: string): Promise<AssessmentVersionRow[]> {
  const { data, error } = await supabase
    .from('assessment_versions')
    .select('*')
    .eq('assessment_template_id', templateId)
    .order('version_number', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPublishedVersionForTemplate(templateId: string): Promise<AssessmentVersionRow | null> {
  const { data, error } = await supabase
    .from('assessment_versions')
    .select('*')
    .eq('assessment_template_id', templateId)
    .eq('status', 'published')
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchLatestVersionForTemplate(templateId: string): Promise<AssessmentVersionRow | null> {
  const { data, error } = await supabase
    .from('assessment_versions')
    .select('*')
    .eq('assessment_template_id', templateId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchVersionById(versionId: string): Promise<AssessmentVersionRow | null> {
  const { data, error } = await supabase
    .from('assessment_versions')
    .select('*')
    .eq('id', versionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createVersion(input: CreateVersionInput, createdBy: string): Promise<AssessmentVersionRow> {
  const payload = {
    assessment_template_id: input.assessment_template_id,
    name: '',
    version_number: input.version_number,
    version_label: input.version_label ?? null,
    introduction_text: input.introduction_text ?? null,
    completion_message: input.completion_message ?? null,
    scoring_method: input.scoring_method ?? 'none',
    show_overall_score: input.show_overall_score ?? true,
    status: 'draft',
    created_by: createdBy,
  };
  const { data, error } = await supabase
    .from('assessment_versions')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateVersion(versionId: string, updates: Partial<CreateVersionInput> & {
  status?: 'draft' | 'published' | 'retired';
  published_at?: string;
}): Promise<AssessmentVersionRow> {
  const { data, error } = await supabase
    .from('assessment_versions')
    .update(updates)
    .eq('id', versionId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function publishVersion(versionId: string): Promise<AssessmentVersionRow> {
  const { data, error } = await supabase
    .from('assessment_versions')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', versionId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function retireVersion(versionId: string): Promise<AssessmentVersionRow> {
  const { data, error } = await supabase
    .from('assessment_versions')
    .update({ status: 'retired' })
    .eq('id', versionId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// Sections
// ============================================================

export type CreateSectionInput = {
  assessment_version_id: string;
  title: string;
  description?: string;
  display_order: number;
  weight?: number;
  is_scored?: boolean;
};

export async function fetchSectionsForVersion(versionId: string): Promise<AssessmentSectionRow[]> {
  const { data, error } = await supabase
    .from('assessment_sections')
    .select('*')
    .eq('assessment_version_id', versionId)
    .order('display_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchSectionsWithQuestions(versionId: string): Promise<AssessmentSectionWithQuestions[]> {
  const { data, error } = await supabase
    .from('assessment_sections')
    .select('*, questions:assessment_questions(*, options:assessment_question_options(*))')
    .eq('assessment_version_id', versionId)
    .order('display_order', { ascending: true });
  if (error) throw error;

  return (data ?? []).map((s) => ({
    ...s,
    questions: (s.questions ?? [])
      .sort((a: AssessmentQuestionWithOptions, b: AssessmentQuestionWithOptions) => a.display_order - b.display_order)
      .map((q: AssessmentQuestionWithOptions) => ({
        ...q,
        options: (q.options ?? []).sort((o: AssessmentQuestionOptionRow, p: AssessmentQuestionOptionRow) => o.display_order - p.display_order),
      })),
  })) as AssessmentSectionWithQuestions[];
}

export async function createSection(input: CreateSectionInput): Promise<AssessmentSectionRow> {
  const payload = {
    assessment_version_id: input.assessment_version_id,
    title: input.title,
    description: input.description ?? null,
    display_order: input.display_order,
    weight: input.weight ?? 1.0,
    is_scored: input.is_scored ?? true,
  };
  const { data, error } = await supabase
    .from('assessment_sections')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSection(id: string, updates: Partial<Omit<AssessmentSectionRow, 'id' | 'assessment_version_id' | 'created_at' | 'updated_at'>>): Promise<AssessmentSectionRow> {
  const { data, error } = await supabase
    .from('assessment_sections')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSection(id: string): Promise<void> {
  const { error } = await supabase.from('assessment_sections').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// Questions
// ============================================================

export type CreateQuestionInput = {
  assessment_version_id: string;
  assessment_section_id: string;
  question_text: string;
  help_text?: string;
  question_type: AssessmentQuestionType;
  display_order: number;
  is_required?: boolean;
  is_scored?: boolean;
  weight?: number;
  reverse_scored?: boolean;
  reporting_label?: string;
  scoring_dimension?: string;
  numeric_rating_min_value?: number;
  numeric_rating_max_value?: number;
  numeric_rating_step_value?: number;
  numeric_rating_min_label?: string;
  numeric_rating_max_label?: string;
  maximum_selections?: number | null;
};

export async function fetchQuestionsForVersion(versionId: string): Promise<AssessmentQuestionRow[]> {
  const { data, error } = await supabase
    .from('assessment_questions')
    .select('*')
    .eq('assessment_version_id', versionId)
    .order('display_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchQuestionsForSection(sectionId: string): Promise<AssessmentQuestionRow[]> {
  const { data, error } = await supabase
    .from('assessment_questions')
    .select('*')
    .eq('assessment_section_id', sectionId)
    .order('display_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createQuestion(input: CreateQuestionInput): Promise<AssessmentQuestionRow> {
  const payload = {
    assessment_version_id: input.assessment_version_id,
    assessment_section_id: input.assessment_section_id,
    question_text: input.question_text,
    help_text: input.help_text ?? null,
    question_type: input.question_type,
    display_order: input.display_order,
    is_required: input.is_required ?? true,
    is_scored: input.is_scored ?? false,
    weight: input.weight ?? 1.0,
    reverse_scored: input.reverse_scored ?? false,
    reporting_label: input.reporting_label ?? null,
    scoring_dimension: input.scoring_dimension ?? null,
    numeric_rating_min_value: input.numeric_rating_min_value ?? 1,
    numeric_rating_max_value: input.numeric_rating_max_value ?? 10,
    numeric_rating_step_value: input.numeric_rating_step_value ?? 1,
    numeric_rating_min_label: input.numeric_rating_min_label ?? null,
    numeric_rating_max_label: input.numeric_rating_max_label ?? null,
    maximum_selections: input.maximum_selections ?? null,
  };
  const { data, error } = await supabase
    .from('assessment_questions')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateQuestion(id: string, updates: Partial<Omit<AssessmentQuestionRow, 'id' | 'assessment_version_id' | 'created_at' | 'updated_at'>>): Promise<AssessmentQuestionRow> {
  const { data, error } = await supabase
    .from('assessment_questions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteQuestion(id: string): Promise<void> {
  const { error } = await supabase.from('assessment_questions').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// Question Options
// ============================================================

export type CreateOptionInput = {
  question_id: string;
  option_label: string;
  option_value: string;
  score_value?: number | null;
  display_order: number;
  is_not_applicable?: boolean;
};

export async function fetchOptionsForQuestion(questionId: string): Promise<AssessmentQuestionOptionRow[]> {
  const { data, error } = await supabase
    .from('assessment_question_options')
    .select('*')
    .eq('question_id', questionId)
    .order('display_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createOption(input: CreateOptionInput): Promise<AssessmentQuestionOptionRow> {
  const payload = {
    question_id: input.question_id,
    option_label: input.option_label,
    option_value: input.option_value,
    score_value: input.score_value ?? null,
    display_order: input.display_order,
    is_not_applicable: input.is_not_applicable ?? false,
  };
  const { data, error } = await supabase
    .from('assessment_question_options')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateOption(id: string, updates: Partial<Omit<AssessmentQuestionOptionRow, 'id' | 'question_id' | 'created_at'>>): Promise<AssessmentQuestionOptionRow> {
  const { data, error } = await supabase
    .from('assessment_question_options')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteOption(id: string): Promise<void> {
  const { error } = await supabase.from('assessment_question_options').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// Score Bands
// ============================================================

export type CreateScoreBandInput = {
  assessment_version_id: string;
  band_name: string;
  min_threshold: number;
  max_threshold: number;
  display_order: number;
};

export async function fetchScoreBandsForVersion(versionId: string): Promise<AssessmentScoreBandRow[]> {
  const { data, error } = await supabase
    .from('assessment_score_bands')
    .select('*')
    .eq('assessment_version_id', versionId)
    .order('display_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createScoreBand(input: CreateScoreBandInput): Promise<AssessmentScoreBandRow> {
  const { data, error } = await supabase
    .from('assessment_score_bands')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateScoreBand(id: string, updates: Partial<Omit<AssessmentScoreBandRow, 'id' | 'assessment_version_id' | 'created_at'>>): Promise<AssessmentScoreBandRow> {
  const { data, error } = await supabase
    .from('assessment_score_bands')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteScoreBand(id: string): Promise<void> {
  const { error } = await supabase.from('assessment_score_bands').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// Instances
// ============================================================

export type CreateInstanceInput = {
  organization_id: string;
  broker_id: string;
  assessment_template_id: string;
  assessment_version_id: string;
  respondent_name: string;
  respondent_email: string;
  expires_at?: string | null;
  broker_message?: string | null;
};

export async function createAssessmentInstance(input: CreateInstanceInput): Promise<AssessmentInstanceRow> {
  const payload = {
    organization_id: input.organization_id,
    broker_id: input.broker_id,
    assessment_template_id: input.assessment_template_id,
    assessment_version_id: input.assessment_version_id,
    respondent_name: input.respondent_name,
    respondent_email: input.respondent_email,
    expires_at: input.expires_at ?? null,
    broker_message: input.broker_message ?? null,
    status: 'sent' as const,
    sent_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('assessment_instances')
    .insert(payload)
    .select()
    .single();
  if (error) {
    logDbError({ fn: 'createAssessmentInstance', route: '/assessments/send', error });
    throw error;
  }
  return data;
}

export async function fetchInstancesForBroker(brokerId: string): Promise<AssessmentInstanceRow[]> {
  const { data, error } = await supabase
    .from('assessment_instances')
    .select('*')
    .eq('broker_id', brokerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchInstanceById(instanceId: string): Promise<AssessmentInstanceRow | null> {
  const { data, error } = await supabase
    .from('assessment_instances')
    .select('*')
    .eq('id', instanceId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ============================================================
// Responses & Scores
// ============================================================

export async function fetchResponsesForInstance(instanceId: string): Promise<AssessmentResponseRow[]> {
  const { data, error } = await supabase
    .from('assessment_responses')
    .select('*')
    .eq('assessment_instance_id', instanceId);
  if (error) throw error;
  return data ?? [];
}

export async function fetchSectionScoresForInstance(instanceId: string): Promise<AssessmentSectionScoreRow[]> {
  const { data, error } = await supabase
    .from('assessment_section_scores')
    .select('*')
    .eq('assessment_instance_id', instanceId);
  if (error) throw error;
  return data ?? [];
}

export async function fetchResultForInstance(instanceId: string): Promise<AssessmentResultRow | null> {
  const { data, error } = await supabase
    .from('assessment_results')
    .select('*')
    .eq('assessment_instance_id', instanceId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function calculateScores(instanceId: string): Promise<AssessmentResultRow> {
  const { data, error } = await supabase.rpc('calculate_assessment_scores', {
    p_instance_id: instanceId,
  });
  if (error) throw error;
  return data as AssessmentResultRow;
}

// ============================================================
// Public respondent RPCs
// ============================================================

export async function resolveAssessmentByToken(token: string): Promise<ResolvedAssessment | { error: string; status?: string }> {
  const { data, error } = await supabase.rpc('resolve_assessment_by_token', {
    p_token: token,
  });
  if (error) {
    logDbError({ fn: 'resolveAssessmentByToken', route: '/assessment/:token', error });
    throw error;
  }
  return data as ResolvedAssessment | { error: string; status?: string };
}

export async function submitResponseByToken(params: {
  token: string;
  questionId: string;
  selectedOptionId?: string | null;
  numericValue?: number | null;
  textValue?: string | null;
  booleanValue?: boolean | null;
}): Promise<{ success: boolean }> {
  const { data, error } = await supabase.rpc('submit_assessment_response', {
    p_token: params.token,
    p_question_id: params.questionId,
    p_selected_option_id: params.selectedOptionId ?? null,
    p_numeric_value: params.numericValue ?? null,
    p_text_value: params.textValue ?? null,
    p_boolean_value: params.booleanValue ?? null,
  });
  if (error) throw error;
  return data as { success: boolean };
}

export async function finalizeSubmissionByToken(token: string): Promise<AssessmentResultRow> {
  const { data, error } = await supabase.rpc('finalize_assessment_submission', {
    p_token: token,
  });
  if (error) throw error;
  return data as AssessmentResultRow;
}

export async function regenerateAssessmentToken(instanceId: string): Promise<{ instance_id: string; secure_token: string } | { error: string }> {
  const { data, error } = await supabase.rpc('regenerate_assessment_token', {
    p_instance_id: instanceId,
  });
  if (error) throw error;
  return data as { instance_id: string; secure_token: string } | { error: string };
}

// ============================================================
// Version duplication
// ============================================================

export async function duplicateAssessmentVersion(sourceVersionId: string, createdBy: string): Promise<AssessmentVersionRow> {
  const { data, error } = await supabase.rpc('duplicate_assessment_version', {
    p_source_version_id: sourceVersionId,
    p_created_by: createdBy,
  });
  if (error) throw error;
  return data as AssessmentVersionRow;
}

export async function retireAssessmentVersion(versionId: string): Promise<AssessmentVersionRow> {
  const { data, error } = await supabase.rpc('retire_assessment_version', {
    p_version_id: versionId,
  });
  if (error) throw error;
  return data as AssessmentVersionRow;
}

// ============================================================
// Admin: all templates with stats
// ============================================================

export async function fetchAllTemplatesAdmin(): Promise<AssessmentTemplateWithVersion[]> {
  const { data, error } = await supabase
    .from('assessment_templates')
    .select('*, latest_version:assessment_versions!inner(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AssessmentTemplateWithVersion[];
}

export async function fetchInstanceCountForTemplate(templateId: string): Promise<number> {
  const { count, error } = await supabase
    .from('assessment_instances')
    .select('*', { count: 'exact', head: true })
    .eq('assessment_template_id', templateId);
  if (error) throw error;
  return count ?? 0;
}

export async function fetchCompletedCountForTemplate(templateId: string): Promise<number> {
  const { count, error } = await supabase
    .from('assessment_instances')
    .select('*', { count: 'exact', head: true })
    .eq('assessment_template_id', templateId)
    .in('status', ['submitted', 'report_ready']);
  if (error) throw error;
  return count ?? 0;
}

export async function fetchQuestionCountForVersion(versionId: string): Promise<number> {
  const { count, error } = await supabase
    .from('assessment_questions')
    .select('*', { count: 'exact', head: true })
    .eq('assessment_version_id', versionId);
  if (error) throw error;
  return count ?? 0;
}

import { supabase } from '../lib/supabase';
import { logDbError } from '../lib/logger';
import { getScoreBand } from '../lib/assessmentScoring';
import { fetchRecommendationsForResult, hasAnyRecommendations, type GroupedRecommendations } from './recommendations';
import type {
  AssessmentInstanceRow,
  AssessmentResponseRow,
  AssessmentSectionScoreRow,
  AssessmentResultRow,
  AssessmentSectionWithQuestions,
  AssessmentVersionRow,
  AssessmentTemplateRow,
  AssessmentScoreBandRow,
  OrganizationRow,
} from '../lib/database.types';

export type BehavioralReadiness = {
  clarity_of_value: number;
  motivation_overcoming_inertia: number;
  trust_social_proof: number;
  structural_environmental_friction: number;
};

export type ContextualAnswer = {
  question_text: string;
  section_title: string;
  selectedOptionLabels: string[];
  text_value: string | null;
};

export type ReportData = {
  instance: AssessmentInstanceRow;
  template: AssessmentTemplateRow | null;
  version: AssessmentVersionRow | null;
  organization: OrganizationRow | null;
  sections: AssessmentSectionWithQuestions[];
  responses: AssessmentResponseRow[];
  sectionScores: AssessmentSectionScoreRow[];
  result: AssessmentResultRow | null;
  scoreBands: AssessmentScoreBandRow[];
  overallScore: number | null;
  scoreBand: string | null;
  behavioralReadiness: BehavioralReadiness | null;
  contextualAnswers: ContextualAnswer[];
  showRecommendations: boolean;
  showBand: boolean;
  recommendations: GroupedRecommendations | null;
};

export async function fetchReportData(
  instanceId: string,
  brokerId: string,
  isAdmin: boolean
): Promise<ReportData | null> {
  const { data: inst, error: instErr } = await supabase
    .from('assessment_instances')
    .select('*')
    .eq('id', instanceId)
    .maybeSingle();

  if (instErr) {
    logDbError({ fn: 'fetchReportData', route: '/reports/:instanceId', error: instErr });
    throw instErr;
  }
  if (!inst) return null;

  if (!isAdmin && inst.broker_id !== brokerId) {
    return null;
  }

  const [orgResult, verResult, tmplResult, secsResult, respsResult, secScoresResult, resResult, bandsResult] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', inst.organization_id).maybeSingle(),
    inst.assessment_version_id
      ? supabase.from('assessment_versions').select('*').eq('id', inst.assessment_version_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    inst.assessment_template_id
      ? supabase.from('assessment_templates').select('*').eq('id', inst.assessment_template_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    inst.assessment_version_id
      ? fetchSectionsWithQuestions(inst.assessment_version_id)
      : Promise.resolve([]),
    supabase.from('assessment_responses').select('*').eq('assessment_instance_id', inst.id),
    supabase.from('assessment_section_scores').select('*').eq('assessment_instance_id', inst.id),
    supabase.from('assessment_results').select('*').eq('assessment_instance_id', inst.id).maybeSingle(),
    inst.assessment_version_id
      ? supabase.from('assessment_score_bands').select('*').eq('assessment_version_id', inst.assessment_version_id).order('display_order')
      : Promise.resolve({ data: [], error: null }),
  ]);

  const organization = orgResult.data as OrganizationRow | null;
  const version = verResult.data as AssessmentVersionRow | null;
  const template = tmplResult.data as AssessmentTemplateRow | null;
  const sections = secsResult as AssessmentSectionWithQuestions[];
  const responses = (respsResult.data ?? []) as AssessmentResponseRow[];
  const sectionScores = (secScoresResult.data ?? []) as AssessmentSectionScoreRow[];
  const result = resResult.data as AssessmentResultRow | null;
  const scoreBands = (bandsResult.data ?? []) as AssessmentScoreBandRow[];

  const overallScore = result ? Number(result.normalized_score) : inst.overall_score ? Number(inst.overall_score) : null;
  const showBand = template ? (template.owner_type === 'propel' ? true : scoreBands.length > 0) : false;
  const scoreBand = result?.score_band ?? (overallScore !== null && showBand ? getScoreBand(overallScore, scoreBands) : null);

  const behavioralReadiness = extractBehavioralReadiness(result?.result_snapshot ?? null);

  const contextualAnswers = extractContextualAnswers(sections, responses);

  const showRecommendations = template ? (template.owner_type === 'propel' && template.recommendations_enabled) : false;

  let recommendations: GroupedRecommendations | null = null;
  if (showRecommendations && result) {
    try {
      recommendations = await fetchRecommendationsForResult(result.id);
      if (!hasAnyRecommendations(recommendations)) {
        recommendations = null;
      }
    } catch {
      recommendations = null;
    }
  }

  return {
    instance: inst,
    template,
    version,
    organization,
    sections,
    responses,
    sectionScores,
    result,
    scoreBands,
    overallScore,
    scoreBand,
    behavioralReadiness,
    contextualAnswers,
    showRecommendations,
    showBand,
    recommendations,
  };
}

async function fetchSectionsWithQuestions(versionId: string): Promise<AssessmentSectionWithQuestions[]> {
  const { data, error } = await supabase
    .from('assessment_sections')
    .select(`
      *,
      questions:assessment_questions(
        *,
        options:assessment_question_options(*)
      )
    `)
    .eq('assessment_version_id', versionId)
    .order('display_order');

  if (error) {
    logDbError({ fn: 'fetchSectionsWithQuestions', error });
    throw error;
  }

  return (data ?? []) as unknown as AssessmentSectionWithQuestions[];
}

function extractBehavioralReadiness(snapshot: Record<string, unknown> | null): BehavioralReadiness | null {
  if (!snapshot) return null;
  const br = snapshot.behavioral_readiness;
  if (!br || typeof br !== 'object') return null;
  const b = br as Record<string, unknown>;
  return {
    clarity_of_value: Number(b.clarity_of_value ?? 0),
    motivation_overcoming_inertia: Number(b.motivation_overcoming_inertia ?? 0),
    trust_social_proof: Number(b.trust_social_proof ?? 0),
    structural_environmental_friction: Number(b.structural_environmental_friction ?? 0),
  };
}

function resolveOptionLabels(question: AssessmentSectionWithQuestions['questions'][number], response: AssessmentResponseRow): string[] {
  const labels: string[] = [];

  if (question.question_type === 'multi_select') {
    const raw = response.text_value;
    if (!raw) return labels;
    let ids: string[] = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        ids = parsed.filter((v): v is string => typeof v === 'string' && v.length > 0);
      }
    } catch {
      ids = raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
    }
    for (const id of ids) {
      const option = question.options.find((o) => o.id === id);
      if (option) labels.push(option.option_label);
    }
    return labels;
  }

  if (response.selected_option_id) {
    const option = question.options.find((o) => o.id === response.selected_option_id);
    if (option) labels.push(option.option_label);
  }
  return labels;
}

function isTextOnlyQuestion(question: AssessmentSectionWithQuestions['questions'][number]): boolean {
  return ['short_text', 'long_text', 'date', 'numeric_input', 'information'].includes(question.question_type);
}

function extractContextualAnswers(
  sections: AssessmentSectionWithQuestions[],
  responses: AssessmentResponseRow[]
): ContextualAnswer[] {
  const responseMap = new Map(responses.map((r) => [r.question_id, r]));
  const answers: ContextualAnswer[] = [];

  for (const section of sections) {
    for (const question of section.questions) {
      if (question.is_scored) continue;
      const response = responseMap.get(question.id);
      if (!response) continue;

      const labels = resolveOptionLabels(question, response);
      const hasText = isTextOnlyQuestion(question) && response.text_value;

      if (labels.length > 0) {
        answers.push({
          question_text: question.question_text,
          section_title: section.title,
          selectedOptionLabels: labels,
          text_value: null,
        });
      } else if (hasText) {
        answers.push({
          question_text: question.question_text,
          section_title: section.title,
          selectedOptionLabels: [],
          text_value: response.text_value,
        });
      } else if (question.question_type === 'yes_no' && response.boolean_value !== null) {
        answers.push({
          question_text: question.question_text,
          section_title: section.title,
          selectedOptionLabels: [response.boolean_value ? 'Yes' : 'No'],
          text_value: null,
        });
      } else if (question.question_type === 'numeric_rating' && response.numeric_value !== null) {
        answers.push({
          question_text: question.question_text,
          section_title: section.title,
          selectedOptionLabels: [String(response.numeric_value)],
          text_value: null,
        });
      }
    }
  }

  return answers;
}

export function getBehavioralInterpretation(score: number): string {
  if (score >= 80) return 'Strong behavioral support';
  if (score >= 65) return 'Generally supportive';
  if (score >= 50) return 'Meaningful barriers';
  return 'Significant barriers';
}

export const DRIVER_LABELS: Record<keyof BehavioralReadiness, string> = {
  clarity_of_value: 'Clarity of Value',
  motivation_overcoming_inertia: 'Motivation and Overcoming Inertia',
  trust_social_proof: 'Trust and Social Proof',
  structural_environmental_friction: 'Structural and Environmental Friction',
};

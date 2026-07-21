import { supabase } from '../lib/supabase';
import { logDbError } from '../lib/logger';
import type { AssessmentResultRecommendationRow, RecommendationType, EffortLevel, ImpactLevel } from '../lib/database.types';

export type SelectedRecommendation = {
  id: string;
  recommendation_type: RecommendationType;
  title: string;
  description: string;
  rationale: string;
  dimension_key: string | null;
  driver_key: string | null;
  effort_level: EffortLevel | null;
  impact_level: ImpactLevel | null;
  display_order: number;
};

export type GroupedRecommendations = {
  strengths: SelectedRecommendation[];
  priorityOpportunities: SelectedRecommendation[];
  quickWins: SelectedRecommendation[];
  highImpactMoves: SelectedRecommendation[];
  meetingQuestions: SelectedRecommendation[];
};

const TYPE_MAP: Record<string, keyof GroupedRecommendations> = {
  strength: 'strengths',
  priority_opportunity: 'priorityOpportunities',
  quick_win: 'quickWins',
  high_impact_move: 'highImpactMoves',
  meeting_question: 'meetingQuestions',
};

const DIMENSION_LABELS: Record<string, string> = {
  strategy_and_leadership: 'Strategy and Leadership',
  employee_relevance: 'Employee Relevance',
  engagement_and_communication: 'Engagement and Communication',
  experience_and_access: 'Experience and Access',
  culture_and_social_support: 'Culture and Social Support',
  measurement_and_improvement: 'Measurement and Improvement',
};

const DRIVER_LABELS: Record<string, string> = {
  clarity_of_value: 'Clarity of Value',
  motivation_overcoming_inertia: 'Motivation and Overcoming Inertia',
  trust_social_proof: 'Trust and Social Proof',
  structural_environmental_friction: 'Structural and Environmental Friction',
};

export function getDimensionLabel(key: string | null): string | null {
  if (!key) return null;
  return DIMENSION_LABELS[key] ?? key;
}

export function getDriverLabel(key: string | null): string | null {
  if (!key) return null;
  return DRIVER_LABELS[key] ?? key;
}

export function getEffortLabel(level: EffortLevel | null): string | null {
  if (!level) return null;
  return level.charAt(0).toUpperCase() + level.slice(1) + ' effort';
}

export function getImpactLabel(level: ImpactLevel | null): string | null {
  if (!level) return null;
  return level.charAt(0).toUpperCase() + level.slice(1) + ' impact';
}

export async function fetchRecommendationsForResult(resultId: string): Promise<GroupedRecommendations> {
  const { data, error } = await supabase
    .from('assessment_result_recommendations')
    .select('*')
    .eq('assessment_result_id', resultId)
    .order('recommendation_type')
    .order('display_order');

  if (error) {
    logDbError({ fn: 'fetchRecommendationsForResult', error });
    throw error;
  }

  const rows = (data ?? []) as AssessmentResultRecommendationRow[];

  const grouped: GroupedRecommendations = {
    strengths: [],
    priorityOpportunities: [],
    quickWins: [],
    highImpactMoves: [],
    meetingQuestions: [],
  };

  for (const row of rows) {
    const target = TYPE_MAP[row.recommendation_type];
    if (!target) continue;
    grouped[target].push({
      id: row.id,
      recommendation_type: row.recommendation_type,
      title: row.title_snapshot,
      description: row.description_snapshot,
      rationale: row.rationale_snapshot,
      dimension_key: row.dimension_key_snapshot,
      driver_key: row.driver_key_snapshot,
      effort_level: row.effort_level_snapshot,
      impact_level: row.impact_level_snapshot,
      display_order: row.display_order,
    });
  }

  return grouped;
}

export function hasAnyRecommendations(recs: GroupedRecommendations): boolean {
  return (
    recs.strengths.length > 0 ||
    recs.priorityOpportunities.length > 0 ||
    recs.quickWins.length > 0 ||
    recs.highImpactMoves.length > 0 ||
    recs.meetingQuestions.length > 0
  );
}

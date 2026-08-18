import { supabase } from '../lib/supabase';
import { logDbError } from '../lib/logger';

export type IntakeStrategyDimension = {
  id: string;
  title: string;
  display_order: number;
  normalized_score: number | null;
};

export type IntakeScoreBand = {
  id: string;
  assessment_version_id: string;
  band_name: string;
  min_threshold: number;
  max_threshold: number;
  display_order: number;
};

export type IntakeBehavioralReadiness = {
  clarity_of_value: number;
  motivation_overcoming_inertia: number;
  trust_social_proof: number;
  structural_environmental_friction: number;
};

export type IntakeOpportunityIndexSummary = {
  assessment_instance_id: string;
  template_name: string;
  organization_name: string | null;
  respondent_name: string | null;
  submitted_at: string | null;
  overall_score: number;
  score_band: string | null;
  strategy_dimensions: IntakeStrategyDimension[];
  behavioral_readiness: IntakeBehavioralReadiness | null;
  score_bands: IntakeScoreBand[];
};

export async function fetchIntakeOpportunityIndexSummary(
  secureToken: string,
): Promise<IntakeOpportunityIndexSummary> {
  const { data, error } = await supabase.rpc('get_intake_opportunity_index_summary', {
    p_secure_token: secureToken,
  });

  if (error) {
    logDbError({ fn: 'fetchIntakeOpportunityIndexSummary', error });
    throw error;
  }

  const payload = data as IntakeOpportunityIndexSummary | { error?: string } | null;
  if (!payload) throw new Error('Assessment results are not available yet.');
  if ('error' in payload && payload.error) throw new Error(payload.error);

  const summary = payload as IntakeOpportunityIndexSummary;
  return {
    ...summary,
    overall_score: Number(summary.overall_score),
    strategy_dimensions: (summary.strategy_dimensions ?? []).map((dimension) => ({
      ...dimension,
      normalized_score: dimension.normalized_score === null ? null : Number(dimension.normalized_score),
    })),
    behavioral_readiness: summary.behavioral_readiness && Object.keys(summary.behavioral_readiness).length > 0
      ? {
          clarity_of_value: Number(summary.behavioral_readiness.clarity_of_value ?? 0),
          motivation_overcoming_inertia: Number(summary.behavioral_readiness.motivation_overcoming_inertia ?? 0),
          trust_social_proof: Number(summary.behavioral_readiness.trust_social_proof ?? 0),
          structural_environmental_friction: Number(summary.behavioral_readiness.structural_environmental_friction ?? 0),
        }
      : null,
    score_bands: (summary.score_bands ?? []).map((band) => ({
      ...band,
      min_threshold: Number(band.min_threshold),
      max_threshold: Number(band.max_threshold),
    })),
  };
}

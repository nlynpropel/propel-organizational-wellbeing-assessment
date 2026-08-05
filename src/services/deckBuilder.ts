// ============================================================
// Deck payload builder — converts approved strategy report + assessment
// result snapshot into the exact DeckPayload structure for PptxGenJS
// ============================================================

import type { DeckPayload, DeckDimension, DeckBehavioralDriver, DeckRecommendation, DeckImplementationSequence } from './deckPayload';
import type { ReportData } from './reportData';
import { DRIVER_LABELS, DRIVER_DESCRIPTIONS, getBehavioralInterpretation } from './reportData';
import type { BehavioralReadiness } from './reportData';
import type { ReviewedOutput } from './aiGenerations';

// Maturity band labels (matches the gauge in the deck)
const MATURITY_BANDS = ['Reactive', 'Developing', 'Established', 'Strategic', 'Leading'];

function getMaturityLevel(score: number): string {
  if (score >= 85) return 'Leading';
  if (score >= 70) return 'Strategic';
  if (score >= 55) return 'Established';
  if (score >= 35) return 'Developing';
  return 'Reactive';
}

function getDimensionLevel(score: number): string {
  if (score >= 85) return 'Leading';
  if (score >= 70) return 'Strategic';
  if (score >= 55) return 'Established';
  if (score >= 35) return 'Developing';
  return 'Reactive';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export type DeckBuildResult = {
  payload: DeckPayload;
  errors: string[];
};

export function buildDeckPayload(
  reportData: ReportData,
  strategyOutput: ReviewedOutput
): DeckBuildResult {
  const errors: string[] = [];

  const org = reportData.organization;
  const instance = reportData.instance;
  const _result = reportData.result;
  const template = reportData.template;
  const sectionScores = reportData.sectionScores;
  const behavioralReadiness = reportData.behavioralReadiness;
  const recommendations = reportData.recommendations;

  // ---- Client ----
  const clientName = org?.organization_name ?? 'Unknown Client';
  const assessmentName = template?.template_name ?? 'Well-being Opportunity Index';
  const completionDate = formatDate(instance.submitted_at ?? instance.created_at ?? null);

  // ---- Assessment ----
  const overallScore = reportData.overallScore ?? 0;
  const maturity = reportData.scoreBand ?? getMaturityLevel(overallScore);
  const bands = reportData.scoreBands.length > 0
    ? reportData.scoreBands.map(b => b.band_label)
    : MATURITY_BANDS;

  // Strategy dimensions — from section scores
  const dimensions: DeckDimension[] = sectionScores.map(ss => {
    const score = Math.round(Number(ss.normalized_score));
    return {
      name: ss.section_title,
      score,
      level: getDimensionLevel(score),
    };
  });

  // Behavioral drivers — from result snapshot
  const behavioralDrivers: DeckBehavioralDriver[] = [];
  if (behavioralReadiness) {
    const br = behavioralReadiness as BehavioralReadiness;
    const driverEntries: Array<{ key: keyof BehavioralReadiness; score: number }> = [
      { key: 'clarity_of_value', score: br.clarity_of_value },
      { key: 'motivation_overcoming_inertia', score: br.motivation_overcoming_inertia },
      { key: 'trust_social_proof', score: br.trust_social_proof },
      { key: 'structural_environmental_friction', score: br.structural_environmental_friction },
    ];
    for (const { key, score } of driverEntries) {
      behavioralDrivers.push({
        name: DRIVER_LABELS[key],
        score: Math.round(score),
        level: getBehavioralInterpretation(score),
        body: DRIVER_DESCRIPTIONS[key],
      });
    }
  }

  // ---- Strategy ----
  // Strengths — from deterministic recommendations
  const strengths = recommendations?.strengths?.map(s => ({
    title: s.title,
    body: s.description,
  })) ?? [];

  // Priority opportunities — from deterministic recommendations
  const priorityOpportunities = recommendations?.priorityOpportunities?.map(o => ({
    title: o.title,
    body: o.description,
  })) ?? [];

  // Holding back — from AI prioritized_barriers
  const holdingBack = (strategyOutput.prioritized_barriers ?? []).map(b => ({
    title: b.title,
    body: b.description,
  }));

  // Recommendations — from AI priority_recommendations
  const deckRecommendations: DeckRecommendation[] = (strategyOutput.priority_recommendations ?? []).map(rec => ({
    title: rec.title,
    why_it_matters: rec.why_this_matters,
    recommended_action: rec.recommended_action,
    suggested_first_step: rec.suggested_first_step,
    expected_impact: rec.expected_strategic_impact,
    implementation_order: rec.implementation_sequence,
    guidance: rec.propel_knowledge_evidence,
    related_findings: rec.assessment_evidence,
  }));

  // Implementation sequence — from AI (array of strings → now/next/later)
  const implSeq = strategyOutput.implementation_sequence ?? [];
  const parsePhase = (text: string): { title: string; body: string } => {
    // Try to split on first colon or dash to separate title from body
    const colonIdx = text.indexOf(':');
    const dashIdx = text.indexOf(' - ');
    let splitIdx = -1;
    if (colonIdx > 0 && (dashIdx < 0 || colonIdx < dashIdx)) {
      splitIdx = colonIdx;
    } else if (dashIdx > 0) {
      splitIdx = dashIdx;
    }
    if (splitIdx > 0) {
      return {
        title: text.slice(0, splitIdx).trim(),
        body: text.slice(splitIdx + (text[splitIdx] === ':' ? 1 : 3)).trim(),
      };
    }
    return { title: text.trim(), body: '' };
  };

  const implementationSequence: DeckImplementationSequence = {
    now: implSeq[0] ? parsePhase(implSeq[0]) : { title: '', body: '' },
    next: implSeq[1] ? parsePhase(implSeq[1]) : { title: '', body: '' },
    later: implSeq[2] ? parsePhase(implSeq[2]) : { title: '', body: '' },
  };

  // Discussion questions — from AI, max 3
  const discussionQuestions = (strategyOutput.client_discussion_questions ?? []).slice(0, 3);

  const payload: DeckPayload = {
    client: {
      name: clientName,
      assessment_name: assessmentName,
      assessment_date: completionDate,
    },
    assessment: {
      overall_score: Math.round(overallScore),
      maturity,
      bands,
      dimensions,
      behavioral_drivers: behavioralDrivers,
    },
    strategy: {
      executive_summary: strategyOutput.executive_summary ?? '',
      current_maturity: strategyOutput.maturity_interpretation ?? '',
      strengths,
      priority_opportunities: priorityOpportunities,
      holding_back: holdingBack,
      recommendations: deckRecommendations,
      implementation_sequence: implementationSequence,
      discussion_questions: discussionQuestions,
    },
  };

  return { payload, errors };
}

// ============================================================
// Expected slide count: 8 fixed slides + 1 per recommendation
// ============================================================
export function getExpectedSlideCount(payload: DeckPayload): number {
  return 8 + payload.strategy.recommendations.length;
}

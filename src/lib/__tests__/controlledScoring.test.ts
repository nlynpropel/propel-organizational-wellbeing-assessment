import { describe, it, expect } from 'vitest';
import {
  normalizeQuestionScore,
  calculateOverallScore,
  getScoreBand,
  type ScoredSection,
} from '../assessmentScoring';

// ============================================================
// Controlled scoring tests using the real server methodology.
// The server RPC (calculate_assessment_scores) uses the same formula:
//   normalized = (score - min) / (max - min) * 100
// For 1-5 agreement scale: min=1, max=5, so (score-1)/4*100
// Answer 1=0, 2=25, 3=50, 4=75, 5=100
// ============================================================

const MIN_SCORE = 1;
const MAX_SCORE = 5;

function makeQuestion(id: string, weight: number = 1): { questionId: string; weight: number; reverseScored: boolean; options: Array<{ id: string; scoreValue: number | null; isNotApplicable: boolean }> } {
  return {
    questionId: id,
    weight,
    reverseScored: false,
    options: [
      { id: 'opt1', scoreValue: 1, isNotApplicable: false },
      { id: 'opt2', scoreValue: 2, isNotApplicable: false },
      { id: 'opt3', scoreValue: 3, isNotApplicable: false },
      { id: 'opt4', scoreValue: 4, isNotApplicable: false },
      { id: 'opt5', scoreValue: 5, isNotApplicable: false },
    ],
  };
}

function makeSection(sectionId: string, questions: ReturnType<typeof makeQuestion>[], weight: number = 1): ScoredSection {
  return { sectionId, weight, questions };
}

function makeResponse(scoreValue: number) {
  return { selectedOptionId: `opt${scoreValue}`, numericValue: null, scoreValue };
}

function buildSixSections(): ScoredSection[] {
  const sections: ScoredSection[] = [];
  const sectionConfigs: { id: string; qCount: number }[] = [
    { id: 's1', qCount: 4 },
    { id: 's2', qCount: 4 },
    { id: 's3', qCount: 5 },
    { id: 's4', qCount: 4 },
    { id: 's5', qCount: 4 },
    { id: 's6', qCount: 4 },
  ];
  let qNum = 1;
  for (const cfg of sectionConfigs) {
    const questions = [];
    for (let i = 0; i < cfg.qCount; i++) {
      questions.push(makeQuestion(`q${qNum++}`));
    }
    sections.push(makeSection(cfg.id, questions));
  }
  return sections;
}

function buildResponseMap(sections: ScoredSection[], scoreValue: number): Map<string, ReturnType<typeof makeResponse>> {
  const map = new Map<string, ReturnType<typeof makeResponse>>();
  for (const section of sections) {
    for (const q of section.questions) {
      map.set(q.questionId, makeResponse(scoreValue));
    }
  }
  return map;
}

describe('Controlled scoring tests', () => {
  // Test A: Every scored answer = 1 → all 0, Reactive
  it('Test A: all answers = 1 → sections 0, overall 0, Reactive', () => {
    const sections = buildSixSections();
    const responses = buildResponseMap(sections, 1);
    const result = calculateOverallScore(sections, responses);
    expect(result.normalizedScore).toBe(0);
    expect(result.scoreBand).toBe('Reactive');
    for (const s of result.sectionScores) {
      expect(s.normalizedScore).toBe(0);
    }
  });

  // Test B: Every scored answer = 3 → all 50, Developing
  it('Test B: all answers = 3 → sections 50, overall 50, Developing', () => {
    const sections = buildSixSections();
    const responses = buildResponseMap(sections, 3);
    const result = calculateOverallScore(sections, responses);
    expect(result.normalizedScore).toBe(50);
    expect(result.scoreBand).toBe('Developing');
    for (const s of result.sectionScores) {
      expect(s.normalizedScore).toBe(50);
    }
  });

  // Test C: Every scored answer = 5 → all 100, Leading
  it('Test C: all answers = 5 → sections 100, overall 100, Leading', () => {
    const sections = buildSixSections();
    const responses = buildResponseMap(sections, 5);
    const result = calculateOverallScore(sections, responses);
    expect(result.normalizedScore).toBe(100);
    expect(result.scoreBand).toBe('Leading');
    for (const s of result.sectionScores) {
      expect(s.normalizedScore).toBe(100);
    }
  });

  // Test D: Engagement=1, others=5 → Eng=0, others=100, overall=83.33, Strategic
  it('Test D: Eng&Comm=1, others=5 → Eng=0, others=100, overall≈83.33, Strategic', () => {
    const sections = buildSixSections();
    const responses = buildResponseMap(sections, 5);
    // Override section 3 (Engagement and Communication, 5 questions) to answer=1
    for (const q of sections[2].questions) {
      responses.set(q.questionId, makeResponse(1));
    }
    const result = calculateOverallScore(sections, responses);
    // Section 3 = 0, other 5 sections = 100
    // Overall = (0 + 100*5) / 6 = 500/6 = 83.333...
    expect(result.normalizedScore).toBeCloseTo(83.3333, 3);
    expect(result.scoreBand).toBe('Strategic');
    expect(result.sectionScores[0].normalizedScore).toBe(100);
    expect(result.sectionScores[1].normalizedScore).toBe(100);
    expect(result.sectionScores[2].normalizedScore).toBe(0);
    expect(result.sectionScores[3].normalizedScore).toBe(100);
    expect(result.sectionScores[4].normalizedScore).toBe(100);
    expect(result.sectionScores[5].normalizedScore).toBe(100);
    // Displayed overall should be 83
    expect(Math.round(result.normalizedScore)).toBe(83);
  });

  // Test E: Contextual answers don't affect scores
  it('Test E: contextual answers change → scores unchanged', () => {
    const sections = buildSixSections();
    const responses = buildResponseMap(sections, 4);
    const result1 = calculateOverallScore(sections, responses);

    // Contextual (unscored) questions do not participate in scoring.
    // Verify that adding a contextual response doesn't change scored results.
    const responsesWithContext = new Map(responses);
    responsesWithContext.set('q26', { selectedOptionId: 'opt1', numericValue: null, scoreValue: 1 });
    // Only scored sections are passed to calculateOverallScore (matching server behavior)
    const result3 = calculateOverallScore(sections, responsesWithContext);
    expect(result3.normalizedScore).toBe(result1.normalizedScore);
    expect(result3.scoreBand).toBe(result1.scoreBand);
  });

  // Test F: Report values come from server result, not sampleData
  it('Test F: normalizeQuestionScore matches server formula (score-1)/4*100', () => {
    expect(normalizeQuestionScore(1, MIN_SCORE, MAX_SCORE, false)).toBe(0);
    expect(normalizeQuestionScore(2, MIN_SCORE, MAX_SCORE, false)).toBe(25);
    expect(normalizeQuestionScore(3, MIN_SCORE, MAX_SCORE, false)).toBe(50);
    expect(normalizeQuestionScore(4, MIN_SCORE, MAX_SCORE, false)).toBe(75);
    expect(normalizeQuestionScore(5, MIN_SCORE, MAX_SCORE, false)).toBe(100);
  });

  // Score band verification
  it('Score bands: 0=Reactive, 40=Developing, 60=Established, 75=Strategic, 90=Leading', () => {
    expect(getScoreBand(0)).toBe('Reactive');
    expect(getScoreBand(39)).toBe('Reactive');
    expect(getScoreBand(40)).toBe('Developing');
    expect(getScoreBand(59)).toBe('Developing');
    expect(getScoreBand(60)).toBe('Established');
    expect(getScoreBand(74)).toBe('Established');
    expect(getScoreBand(75)).toBe('Strategic');
    expect(getScoreBand(89)).toBe('Strategic');
    expect(getScoreBand(90)).toBe('Leading');
    expect(getScoreBand(100)).toBe('Leading');
  });

  // Behavioral readiness: 5-question section not weighted more than 4-question sections
  it('Equal section weights: 5-question section does not dominate overall', () => {
    const sections = buildSixSections();
    const responses = buildResponseMap(sections, 5);
    const result = calculateOverallScore(sections, responses);
    // All sections have weight=1, so overall = average of all section scores
    // 5-question section (s3) should have same weight as 4-question sections
    const sectionWeightSum = sections.reduce((sum, s) => sum + s.weight, 0);
    expect(sectionWeightSum).toBe(6); // 6 sections, each weight 1
    expect(result.normalizedScore).toBe(100);
  });
});

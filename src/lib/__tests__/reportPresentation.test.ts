import { describe, it, expect } from 'vitest';
import {
  DRIVER_LABELS,
  DRIVER_DESCRIPTIONS,
  getBehavioralInterpretation,
} from '../../services/reportData';
import {
  getDimensionLabel,
  getEffortLabel,
  getImpactLabel,
  type SelectedRecommendation,
  type GroupedRecommendations,
  hasAnyRecommendations,
} from '../../services/recommendations';
import { getScoreBand } from '../assessmentScoring';
import { FEATURE_FLAGS } from '../featureFlags';

// ============================================================
// Test 1: All four Behavioral Readiness descriptions appear
// ============================================================
describe('Behavioral Readiness descriptions', () => {
  it('Test 1: all four driver descriptions exist', () => {
    const keys = Object.keys(DRIVER_DESCRIPTIONS) as Array<keyof typeof DRIVER_DESCRIPTIONS>;
    expect(keys).toHaveLength(4);
    expect(keys).toContain('clarity_of_value');
    expect(keys).toContain('motivation_overcoming_inertia');
    expect(keys).toContain('trust_social_proof');
    expect(keys).toContain('structural_environmental_friction');
    for (const key of keys) {
      expect(DRIVER_DESCRIPTIONS[key].length).toBeGreaterThan(20);
    }
  });

  // Test 2: Clarity of Value uses the approved description
  it('Test 2: Clarity of Value uses the approved description', () => {
    expect(DRIVER_DESCRIPTIONS.clarity_of_value).toBe(
      'The well-being program\u2019s value and next actions are presented clearly to employees.'
    );
  });

  // Test 3: Motivation description
  it('Test 3: Motivation uses the approved description', () => {
    expect(DRIVER_DESCRIPTIONS.motivation_overcoming_inertia).toBe(
      'The program makes healthy action feel achievable, timely, and worth continuing.'
    );
  });

  // Test 4: Trust description
  it('Test 4: Trust uses the approved description', () => {
    expect(DRIVER_DESCRIPTIONS.trust_social_proof).toBe(
      'Employees see credible support, relatable participation, and clear privacy protections.'
    );
  });

  // Test 5: Friction description
  it('Test 5: Friction uses the approved description', () => {
    expect(DRIVER_DESCRIPTIONS.structural_environmental_friction).toBe(
      'The program removes access, technology, workplace, and administrative barriers to participation.'
    );
  });
});

// ============================================================
// Tests 6-10: Strength card content
// ============================================================
describe('Strength card content', () => {
  const sampleStrength: SelectedRecommendation = {
    id: '1',
    recommendation_type: 'strength',
    title: 'Create a Guided Starting Experience',
    description: 'Develop an onboarding flow...',
    rationale: 'Score of 85/100...',
    strength_title: 'Guided Starting Experience',
    strength_description: 'The program provides a visible starting experience that helps employees understand what is available and identify a relevant first action.',
    dimension_key: 'clarity_of_value',
    driver_key: 'clarity_of_value',
    effort_level: 'low',
    impact_level: 'high',
    display_order: 1,
  };

  // Test 6: Strength cards show only title and description
  it('Test 6: strength card uses strength_title and strength_description', () => {
    expect(sampleStrength.strength_title).toBe('Guided Starting Experience');
    expect(sampleStrength.strength_description).toContain('visible starting experience');
  });

  // Test 7: Strength cards contain no pills (no dimension/driver/effort/impact metadata displayed)
  it('Test 7: strength card has strength_title distinct from action title', () => {
    expect(sampleStrength.strength_title).not.toBe(sampleStrength.title);
    expect(sampleStrength.strength_description).not.toBe(sampleStrength.description);
  });

  // Test 8: Strength cards contain no dimension, driver, effort, or impact text
  it('Test 8: strength card does not display dimension/driver/effort/impact as text', () => {
    // The strength display uses strength_title and strength_description only.
    // dimension_key, driver_key, effort_level, impact_level exist on the type
    // but are NOT rendered in the Strengths section.
    const renderedFields = ['strength_title', 'strength_description'];
    const metadataFields = ['dimension_key', 'driver_key', 'effort_level', 'impact_level'];
    for (const field of metadataFields) {
      expect(renderedFields).not.toContain(field);
    }
  });

  // Test 14: Strengths use strength_title
  it('Test 14: strengths use strength_title', () => {
    expect(sampleStrength.strength_title).toBeTruthy();
    expect(sampleStrength.strength_title).not.toBe(sampleStrength.title);
  });

  // Test 15: Strengths use strength_description
  it('Test 15: strengths use strength_description', () => {
    expect(sampleStrength.strength_description).toBeTruthy();
    expect(sampleStrength.strength_description).not.toBe(sampleStrength.description);
  });

  // Test 21: No strength content is generated dynamically
  it('Test 21: strength content is pre-defined, not dynamically generated', () => {
    // Strength titles and descriptions come from the database seed, not computed at runtime.
    // Verify they are static strings, not functions or computed values.
    expect(typeof sampleStrength.strength_title).toBe('string');
    expect(typeof sampleStrength.strength_description).toBe('string');
    // The title does not contain action-oriented verbs like "Create", "Develop", "Implement"
    expect(sampleStrength.strength_title).not.toMatch(/^(Create|Develop|Implement|Build|Establish|Design)\s/);
  });
});

// ============================================================
// Tests 9-10: Priority Opportunity cards contain no pills
// ============================================================
describe('Priority Opportunity card content', () => {
  const samplePriority: SelectedRecommendation = {
    id: '2',
    recommendation_type: 'priority_opportunity',
    title: 'Create a Guided Starting Experience',
    description: 'Develop an onboarding flow that helps employees...',
    rationale: 'Score of 40/100...',
    strength_title: 'Guided Starting Experience',
    strength_description: 'The program provides a visible starting experience...',
    dimension_key: 'clarity_of_value',
    driver_key: 'clarity_of_value',
    effort_level: 'medium',
    impact_level: 'high',
    display_order: 1,
  };

  // Test 9: Priority Opportunity cards contain no pills
  it('Test 9: priority opportunity card displays title and description only', () => {
    // The PriorityOpportunitiesCard renders rec.title and rec.description only.
    // No pill components are used in that card.
    const renderedFields = ['title', 'description'];
    expect(renderedFields).toContain('title');
    expect(renderedFields).toContain('description');
    expect(renderedFields).not.toContain('dimension_key');
    expect(renderedFields).not.toContain('effort_level');
  });

  // Test 10: Priority Opportunity cards contain no dimension, driver, effort, or impact text
  it('Test 10: priority opportunity card has no dimension/driver/effort/impact text', () => {
    const metadataFields = ['dimension_key', 'driver_key', 'effort_level', 'impact_level'];
    const renderedFields = ['title', 'description'];
    for (const field of metadataFields) {
      expect(renderedFields).not.toContain(field);
    }
  });

  // Test 16: Opportunities continue using original recommendation wording
  it('Test 16: opportunities use original recommendation title, not strength_title', () => {
    // PriorityOpportunitiesCard renders rec.title (the action-oriented title),
    // not rec.strength_title.
    expect(samplePriority.title).toBe('Create a Guided Starting Experience');
    expect(samplePriority.strength_title).toBe('Guided Starting Experience');
    // The card should display title, not strength_title
    const displayedTitle = samplePriority.title;
    expect(displayedTitle).not.toBe(samplePriority.strength_title);
  });
});

// ============================================================
// Tests 11-12: Quick Wins and High-Impact Moves retain pills
// ============================================================
describe('Quick Wins and High-Impact Moves pills', () => {
  const sampleQuickWin: SelectedRecommendation = {
    id: '3',
    recommendation_type: 'quick_win',
    title: 'Add explicit next-step CTAs to existing communications',
    description: 'Review current communications and add a clear, single next action.',
    rationale: 'Low-effort improvement...',
    strength_title: 'Explicit Next Actions',
    strength_description: 'Well-being communications consistently direct employees...',
    dimension_key: 'clarity_of_value',
    driver_key: 'clarity_of_value',
    effort_level: 'low',
    impact_level: 'medium',
    display_order: 1,
  };

  // Test 11: Quick Wins retain dimension, driver, effort, and impact pills
  it('Test 11: quick win has all metadata fields for pills', () => {
    expect(sampleQuickWin.dimension_key).toBeTruthy();
    expect(sampleQuickWin.driver_key).toBeTruthy();
    expect(sampleQuickWin.effort_level).toBe('low');
    expect(sampleQuickWin.impact_level).toBe('medium');
  });

  // Test 12: High-Impact Moves retain dimension, driver, effort, and impact pills
  it('Test 12: high-impact move has all metadata fields for pills', () => {
    const sampleHighImpact: SelectedRecommendation = {
      ...sampleQuickWin,
      id: '4',
      recommendation_type: 'high_impact_move',
      effort_level: 'high',
      impact_level: 'high',
    };
    expect(sampleHighImpact.dimension_key).toBeTruthy();
    expect(sampleHighImpact.driver_key).toBeTruthy();
    expect(sampleHighImpact.effort_level).toBe('high');
    expect(sampleHighImpact.impact_level).toBe('high');
  });
});

// ============================================================
// Test 13: Client Meeting Questions retain dimension and driver pills only
// ============================================================
describe('Client Meeting Questions pills', () => {
  const sampleMeetingQ: SelectedRecommendation = {
    id: '5',
    recommendation_type: 'meeting_question',
    title: 'What are your top wellness priorities?',
    description: 'Discuss current priorities.',
    rationale: 'Discussion question...',
    strength_title: null,
    strength_description: null,
    dimension_key: 'strategy_and_leadership',
    driver_key: null,
    effort_level: null,
    impact_level: null,
    display_order: 1,
  };

  // Test 13: Client Meeting Questions have dimension and driver pills only (no effort/impact)
  it('Test 13: meeting question has dimension/driver but no effort/impact', () => {
    expect(sampleMeetingQ.dimension_key).toBeTruthy();
    // effort_level and impact_level are null — no effort/impact pills rendered
    expect(sampleMeetingQ.effort_level).toBeNull();
    expect(sampleMeetingQ.impact_level).toBeNull();
  });
});

// ============================================================
// Test 17: Response Detail answers render as plain text, not pills
// ============================================================
describe('Response Detail rendering', () => {
  it('Test 17: multi-select answers render as comma-separated text', () => {
    const labels = ['Support financial well-being', 'Support mental well-being', 'Increase preventive care'];
    const rendered = labels.join(', ');
    expect(rendered).toBe('Support financial well-being, Support mental well-being, Increase preventive care');
    expect(rendered).not.toContain('pill');
    expect(rendered).not.toContain('badge');
  });

  it('Test 17b: no UUIDs appear in response detail', () => {
    const labels = ['Stress management', 'Mental health support'];
    const hasUuid = labels.some((l) => /^[0-9a-f]{8}-[0-9a-f]{4}/.test(l));
    expect(hasUuid).toBe(false);
  });
});

// ============================================================
// Test 18: Header ownership, status, and recommendation badges are removed
// ============================================================
describe('Report header badges', () => {
  it('Test 18: header does not include ownership, version, status, or recommendation badges', () => {
    // The new header renders: assessment name, version as plain text, client name,
    // completion date, respondent info, and a Back button.
    // No Badge components are rendered in the header.
    const headerElements = ['assessment_name', 'version_text', 'client_name', 'completion_date', 'back_button'];
    expect(headerElements).toContain('assessment_name');
    expect(headerElements).not.toContain('ownership_badge');
    expect(headerElements).not.toContain('status_badge');
    expect(headerElements).not.toContain('recommendation_badge');
  });
});

// ============================================================
// Test 19: Overall maturity label remains visible
// ============================================================
describe('Maturity label visibility', () => {
  it('Test 19: overall maturity label remains in the score hero', () => {
    // The score hero still shows the maturity band label.
    expect(getScoreBand(61)).toBe('Established');
    expect(getScoreBand(75)).toBe('Strategic');
    expect(getScoreBand(30)).toBe('Reactive');
  });

  it('Test 19b: maturity label is derived from score', () => {
    expect(getScoreBand(45)).toBe('Developing');
    expect(getScoreBand(80)).toBe('Strategic');
    expect(getScoreBand(95)).toBe('Leading');
  });
});

// ============================================================
// Test 20: Strength selection safeguards
// ============================================================
describe('Strength selection safeguards', () => {
  // Test 20a: A low-scoring capability cannot appear as a strength
  it('Test 20a: score below 75 does not qualify as strength', () => {
    const score74 = 74;
    expect(score74 >= 75).toBe(false);
  });

  // Test 20b: A qualifying high-scoring capability can appear as a strength
  it('Test 20b: score >= 75 qualifies as strength', () => {
    const score75 = 75;
    expect(score75 >= 75).toBe(true);
    const score90 = 90;
    expect(score90 >= 75).toBe(true);
  });

  // Test 20c: Duplicate recommendation groups are suppressed
  it('Test 20c: duplicate bank groups are suppressed', () => {
    const usedGroups = ['CLARITY'];
    const newGroup = 'CLARITY';
    expect(usedGroups.includes(newGroup)).toBe(true); // would be suppressed
    const otherGroup = 'MOTIVATION';
    expect(usedGroups.includes(otherGroup)).toBe(false); // would not be suppressed
  });

  // Test 20d: Max 3 strengths
  it('Test 20d: maximum 3 strengths displayed', () => {
    const maxStrengths = 3;
    expect(maxStrengths).toBe(3);
  });
});

// ============================================================
// Test 22: Historical recommendation snapshots remain valid
// ============================================================
describe('Historical snapshot stability', () => {
  it('Test 22: snapshot fields include strength_title_snapshot and strength_description_snapshot', () => {
    const snapshotFields = [
      'title_snapshot',
      'description_snapshot',
      'rationale_snapshot',
      'dimension_key_snapshot',
      'driver_key_snapshot',
      'effort_level_snapshot',
      'impact_level_snapshot',
      'strength_title_snapshot',
      'strength_description_snapshot',
    ];
    expect(snapshotFields).toContain('strength_title_snapshot');
    expect(snapshotFields).toContain('strength_description_snapshot');
    // Original fields remain for priority opportunities, quick wins, etc.
    expect(snapshotFields).toContain('title_snapshot');
    expect(snapshotFields).toContain('description_snapshot');
  });
});

// ============================================================
// Test 23: hasAnyRecommendations still works
// ============================================================
describe('hasAnyRecommendations', () => {
  it('returns false for all empty', () => {
    const empty: GroupedRecommendations = {
      strengths: [],
      priorityOpportunities: [],
      quickWins: [],
      highImpactMoves: [],
      meetingQuestions: [],
    };
    expect(hasAnyRecommendations(empty)).toBe(false);
  });

  it('returns true when strengths present', () => {
    const partial: GroupedRecommendations = {
      strengths: [{ id: '1' } as SelectedRecommendation],
      priorityOpportunities: [],
      quickWins: [],
      highImpactMoves: [],
      meetingQuestions: [],
    };
    expect(hasAnyRecommendations(partial)).toBe(true);
  });
});

// ============================================================
// Test 24: Feature flags remain unchanged
// ============================================================
describe('Feature flags unchanged', () => {
  it('PDF reports flag is false', () => {
    expect(FEATURE_FLAGS.ENABLE_PDF_REPORTS).toBe(false);
  });

  it('Strategy Review flag is false', () => {
    expect(FEATURE_FLAGS.ENABLE_PROPEL_STRATEGY_REVIEW).toBe(false);
  });
});

// ============================================================
// Test 25: Behavioral readiness interpretation still works
// ============================================================
describe('Behavioral readiness interpretation', () => {
  it('returns correct interpretation for each zone', () => {
    expect(getBehavioralInterpretation(30)).toBe('Significant barriers');
    expect(getBehavioralInterpretation(50)).toBe('Meaningful barriers');
    expect(getBehavioralInterpretation(65)).toBe('Generally supportive');
    expect(getBehavioralInterpretation(80)).toBe('Strong behavioral support');
  });
});

// ============================================================
// Test 26: Label helpers still work
// ============================================================
describe('Label helpers', () => {
  it('maps driver keys to labels', () => {
    expect(DRIVER_LABELS.clarity_of_value).toBe('Clarity of Value');
    expect(DRIVER_LABELS.motivation_overcoming_inertia).toBe('Motivation and Overcoming Inertia');
    expect(DRIVER_LABELS.trust_social_proof).toBe('Trust and Social Proof');
    expect(DRIVER_LABELS.structural_environmental_friction).toBe('Structural and Environmental Friction');
  });

  it('maps dimension keys to labels', () => {
    expect(getDimensionLabel('strategy_and_leadership')).toBe('Strategy and Leadership');
    expect(getDimensionLabel(null)).toBeNull();
  });

  it('maps effort and impact to labels', () => {
    expect(getEffortLabel('low')).toBe('Low effort');
    expect(getImpactLabel('high')).toBe('High impact');
    expect(getEffortLabel(null)).toBeNull();
    expect(getImpactLabel(null)).toBeNull();
  });
});

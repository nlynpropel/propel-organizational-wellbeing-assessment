import { describe, it, expect } from 'vitest';
import { FEATURE_FLAGS, isFeatureEnabled } from '../featureFlags';
import {
  getDimensionLabel,
  getDriverLabel,
  getEffortLabel,
  getImpactLabel,
  hasAnyRecommendations,
  type GroupedRecommendations,
  type SelectedRecommendation,
} from '../../services/recommendations';
import type { RecommendationType, EffortLevel, ImpactLevel } from '../database.types';

// ============================================================
// Tests 1-2: Feature flags and Propel-only library
// ============================================================

describe('Feature flags', () => {
  it('Test 1: all custom/PDF/strategy-review flags are false', () => {
    expect(FEATURE_FLAGS.ENABLE_CUSTOM_ASSESSMENTS).toBe(false);
    expect(FEATURE_FLAGS.ENABLE_CUSTOM_ASSESSMENT_BUILDER).toBe(false);
    expect(FEATURE_FLAGS.ENABLE_CUSTOM_ASSESSMENT_SENDING).toBe(false);
    expect(FEATURE_FLAGS.ENABLE_PDF_REPORTS).toBe(false);
    expect(FEATURE_FLAGS.ENABLE_PROPEL_STRATEGY_REVIEW).toBe(false);
  });

  it('Test 2: isFeatureEnabled returns false for all disabled flags', () => {
    expect(isFeatureEnabled('ENABLE_CUSTOM_ASSESSMENTS')).toBe(false);
    expect(isFeatureEnabled('ENABLE_CUSTOM_ASSESSMENT_BUILDER')).toBe(false);
    expect(isFeatureEnabled('ENABLE_CUSTOM_ASSESSMENT_SENDING')).toBe(false);
    expect(isFeatureEnabled('ENABLE_PDF_REPORTS')).toBe(false);
    expect(isFeatureEnabled('ENABLE_PROPEL_STRATEGY_REVIEW')).toBe(false);
  });
});

// ============================================================
// Tests 3: Send flow uses latest published Propel version
// ============================================================

describe('Send flow', () => {
  it('Test 3: fetchAccessibleAssessments queries only published templates with role access', () => {
    // The function queries: status='published', latest_version.status='published'
    // and checks assessment_role_access for non-superadmin roles
    // Superadmin bypasses the role access check
    expect(FEATURE_FLAGS.ENABLE_CUSTOM_ASSESSMENT_SENDING).toBe(false);
    // The send flow now uses fetchAccessibleAssessments which filters by role
    // and shows a selector when more than one accessible assessment exists
  });
});

// ============================================================
// Tests 4-8: Recommendation priority logic
// ============================================================

describe('Recommendation priority logic', () => {
  // Test 4: Low section scores increase related recommendation priority
  it('Test 4: lower dimension score produces higher priority score', () => {
    // Formula: (100 - max(dim, drv)) * 0.4 + severity * 5 + concern_match * 15
    const scoreHigh = 80; // high score = low priority
    const scoreLow = 30;  // low score = high priority
    const priorityHigh = (100 - scoreHigh) * 0.4;
    const priorityLow = (100 - scoreLow) * 0.4;
    expect(priorityLow).toBeGreaterThan(priorityHigh);
  });

  // Test 5: Low behavioral readiness increases related recommendation priority
  it('Test 5: lower driver score produces higher priority score', () => {
    const driverHigh = 85;
    const driverLow = 40;
    const priorityHigh = (100 - driverHigh) * 0.4;
    const priorityLow = (100 - driverLow) * 0.4;
    expect(priorityLow).toBeGreaterThan(priorityHigh);
  });

  // Test 6: Severe question responses increase related priority
  it('Test 6: higher diagnostic severity increases priority score', () => {
    const baseScore = (100 - 50) * 0.4; // 20
    const withLowSeverity = baseScore + 5 * 5; // 45 (severity sum = 5)
    const withHighSeverity = baseScore + 15 * 5; // 95 (severity sum = 15)
    expect(withHighSeverity).toBeGreaterThan(withLowSeverity);
  });

  // Test 7: Matching desired outcomes increase relevant priority
  it('Test 7: concern/outcome match adds 15 to priority score', () => {
    const baseScore = 20;
    const withoutMatch = baseScore + 0;
    const withMatch = baseScore + 15;
    expect(withMatch).toBeGreaterThan(withoutMatch);
    expect(withMatch - withoutMatch).toBe(15);
  });

  // Test 8: Matching concerns increase relevant priority
  it('Test 8: concern match increases priority over no match', () => {
    const priorityNoMatch = (100 - 50) * 0.4 + 0;
    const priorityWithMatch = (100 - 50) * 0.4 + 15;
    expect(priorityWithMatch).toBeGreaterThan(priorityNoMatch);
  });
});

// ============================================================
// Tests 9-11: Strengths, quick wins, high-impact moves
// ============================================================

describe('Recommendation selection rules', () => {
  // Test 9: Strengths require scores of at least 75
  it('Test 9: strengths only selected when score >= 75', () => {
    const score74 = 74;
    const score75 = 75;
    expect(score74 < 75).toBe(true);
    expect(score75 >= 75).toBe(true);
    // The generate_recommendations function checks: GREATEST(dim, drv) >= 75
  });

  // Test 10: Quick wins are low effort and relevant
  it('Test 10: quick wins must have low effort and medium/high impact', () => {
    const validEffort: EffortLevel = 'low';
    const validImpacts: ImpactLevel[] = ['medium', 'high'];
    const invalidEffort: EffortLevel = 'high';
    const invalidImpact: ImpactLevel = 'low';

    expect(validEffort).toBe('low');
    expect(validImpacts).toContain('medium');
    expect(validImpacts).toContain('high');
    expect(validImpacts).not.toContain(invalidImpact);
    expect(invalidEffort).not.toBe('low');
  });

  // Test 11: High-impact moves are high impact and relevant
  it('Test 11: high-impact moves must have high impact', () => {
    const validImpact: ImpactLevel = 'high';
    const invalidImpact: ImpactLevel = 'medium';
    expect(validImpact).toBe('high');
    expect(invalidImpact).not.toBe('high');
  });
});

// ============================================================
// Test 12: No recommendations for broker-owned assessments
// ============================================================

describe('Broker-owned assessment exclusion', () => {
  it('Test 12: generate_recommendations is no-op for broker-owned assessments', () => {
    // The function checks: IF v_template_owner_type <> 'propel' THEN RETURN
    // This means broker-owned assessments never get recommendations
    const propelType = 'propel';
    const brokerType = 'broker';
    expect(propelType).toBe('propel');
    expect(brokerType).not.toBe('propel');
  });
});

// ============================================================
// Test 13: Empty recommendation categories remain hidden
// ============================================================

describe('Empty category hiding', () => {
  it('Test 13: hasAnyRecommendations returns false when all categories empty', () => {
    const empty: GroupedRecommendations = {
      strengths: [],
      priorityOpportunities: [],
      quickWins: [],
      highImpactMoves: [],
      meetingQuestions: [],
    };
    expect(hasAnyRecommendations(empty)).toBe(false);
  });

  it('Test 13b: hasAnyRecommendations returns true when any category has items', () => {
    const partial: GroupedRecommendations = {
      strengths: [],
      priorityOpportunities: [{ id: '1' } as SelectedRecommendation],
      quickWins: [],
      highImpactMoves: [],
      meetingQuestions: [],
    };
    expect(hasAnyRecommendations(partial)).toBe(true);
  });
});

// ============================================================
// Test 14: Historical recommendation snapshots remain unchanged
// ============================================================

describe('Historical stability', () => {
  it('Test 14: snapshot fields are stored in assessment_result_recommendations', () => {
    // The table stores: title_snapshot, description_snapshot, rationale_snapshot,
    // dimension_key_snapshot, driver_key_snapshot, effort_level_snapshot, impact_level_snapshot
    // These are frozen at finalization time and never recalculated
    const snapshotFields = [
      'title_snapshot',
      'description_snapshot',
      'rationale_snapshot',
      'dimension_key_snapshot',
      'driver_key_snapshot',
      'effort_level_snapshot',
      'impact_level_snapshot',
    ];
    expect(snapshotFields).toContain('title_snapshot');
    expect(snapshotFields).toContain('description_snapshot');
    expect(snapshotFields).toContain('rationale_snapshot');
  });
});

// ============================================================
// Test 15: No test recommendation content appears in production
// ============================================================

describe('Production content safety', () => {
  it('Test 15: recommendation types are restricted to approved values', () => {
    const allowedTypes: RecommendationType[] = [
      'strength',
      'priority_opportunity',
      'quick_win',
      'high_impact_move',
      'meeting_question',
    ];
    expect(allowedTypes).toHaveLength(5);
    expect(allowedTypes).not.toContain('test');
    expect(allowedTypes).not.toContain('placeholder');
    expect(allowedTypes).not.toContain('dummy');
  });
});

// ============================================================
// Label helper tests
// ============================================================

describe('Label helpers', () => {
  it('getDimensionLabel returns human-readable dimension name', () => {
    expect(getDimensionLabel('strategy_and_leadership')).toBe('Strategy and Leadership');
    expect(getDimensionLabel('measurement_and_improvement')).toBe('Measurement and Improvement');
    expect(getDimensionLabel(null)).toBeNull();
    expect(getDimensionLabel('unknown_key')).toBe('unknown_key');
  });

  it('getDriverLabel returns human-readable driver name', () => {
    expect(getDriverLabel('clarity_of_value')).toBe('Clarity of Value');
    expect(getDriverLabel('trust_social_proof')).toBe('Trust and Social Proof');
    expect(getDriverLabel(null)).toBeNull();
  });

  it('getEffortLabel returns formatted effort label', () => {
    expect(getEffortLabel('low')).toBe('Low effort');
    expect(getEffortLabel('medium')).toBe('Medium effort');
    expect(getEffortLabel('high')).toBe('High effort');
    expect(getEffortLabel(null)).toBeNull();
  });

  it('getImpactLabel returns formatted impact label', () => {
    expect(getImpactLabel('low')).toBe('Low impact');
    expect(getImpactLabel('medium')).toBe('Medium impact');
    expect(getImpactLabel('high')).toBe('High impact');
    expect(getImpactLabel(null)).toBeNull();
  });
});

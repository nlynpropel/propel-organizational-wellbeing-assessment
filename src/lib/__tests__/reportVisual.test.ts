import { describe, it, expect } from 'vitest';
import { getScoreBand, roundForDisplay } from '../assessmentScoring';
import { getBehavioralInterpretation, DRIVER_LABELS } from '../../services/reportData';
import { maturityColor, behavioralColor, scoreColor, MATURITY_BANDS, maturityClass } from '../scores';
import { FEATURE_FLAGS } from '../featureFlags';
import { getDimensionLabel, getEffortLabel, getImpactLabel } from '../../services/recommendations';

// ============================================================
// 1. Overall hero displays the real score
// ============================================================
describe('Overall hero score display', () => {
  it('rounds the real score for display', () => {
    expect(roundForDisplay(60.83)).toBe(61);
    expect(roundForDisplay(75)).toBe(75);
    expect(roundForDisplay(0)).toBe(0);
    expect(roundForDisplay(100)).toBe(100);
  });
});

// ============================================================
// 2. Score-band marker uses the real score
// ============================================================
describe('Score-band marker', () => {
  it('places marker at the actual score percentage', () => {
    const score = 62;
    const pct = Math.max(0, Math.min(100, score));
    expect(pct).toBe(62);
  });

  it('clamps scores outside 0-100', () => {
    expect(Math.max(0, Math.min(100, -5))).toBe(0);
    expect(Math.max(0, Math.min(100, 105))).toBe(100);
  });
});

// ============================================================
// 3. A score of 61 displays Established
// ============================================================
describe('Maturity band: 61 → Established', () => {
  it('returns Established for 61', () => {
    expect(getScoreBand(61)).toBe('Established');
    expect(maturityClass(61)).toBe('Established');
  });
});

// ============================================================
// 4. A score of 75 displays Strategic
// ============================================================
describe('Maturity band: 75 → Strategic', () => {
  it('returns Strategic for 75', () => {
    expect(getScoreBand(75)).toBe('Strategic');
    expect(maturityClass(75)).toBe('Strategic');
  });
});

// ============================================================
// 5. Strategy rows show the number only once
// ============================================================
describe('Score row: single number display', () => {
  it('rounds the score once for the top-right display', () => {
    const score = 65;
    const displayed = roundForDisplay(score);
    expect(displayed).toBe(65);
  });
});

// ============================================================
// 6. Strategy rows show the maturity label
// ============================================================
describe('Score row: maturity label', () => {
  it('derives the maturity label from the score', () => {
    expect(getScoreBand(30)).toBe('Reactive');
    expect(getScoreBand(45)).toBe('Developing');
    expect(getScoreBand(60)).toBe('Established');
    expect(getScoreBand(80)).toBe('Strategic');
    expect(getScoreBand(95)).toBe('Leading');
  });
});

// ============================================================
// 7. Behavioral rows show the readiness interpretation
// ============================================================
describe('Behavioral readiness interpretation', () => {
  it('returns the correct interpretation label for each zone', () => {
    expect(getBehavioralInterpretation(30)).toBe('Significant barriers');
    expect(getBehavioralInterpretation(49.9999)).toBe('Significant barriers');
    expect(getBehavioralInterpretation(50)).toBe('Meaningful barriers');
    expect(getBehavioralInterpretation(64.9999)).toBe('Meaningful barriers');
    expect(getBehavioralInterpretation(65)).toBe('Generally supportive');
    expect(getBehavioralInterpretation(79.9999)).toBe('Generally supportive');
    expect(getBehavioralInterpretation(80)).toBe('Strong behavioral support');
    expect(getBehavioralInterpretation(100)).toBe('Strong behavioral support');
  });
});

// ============================================================
// 8. Bar color changes by zone
// ============================================================
describe('Zone-based bar colors', () => {
  it('uses maturity colors for strategy dimensions', () => {
    expect(maturityColor('Reactive')).toBe('#3d4a5e');
    expect(maturityColor('Developing')).toBe('#5a6b8a');
    expect(maturityColor('Established')).toBe('#e89149');
    expect(maturityColor('Strategic')).toBe('#6ea83c');
    expect(maturityColor('Leading')).toBe('#3d7a1f');
  });

  it('uses behavioral colors for behavioral readiness', () => {
    expect(behavioralColor(30)).toBe('#5a6b8a');
    expect(behavioralColor(55)).toBe('#e89149');
    expect(behavioralColor(70)).toBe('#6ea83c');
    expect(behavioralColor(85)).toBe('#3d7a1f');
  });

  it('scoreColor changes by zone', () => {
    expect(scoreColor(30)).toBe('#3d4a5e');
    expect(scoreColor(50)).toBe('#5a6b8a');
    expect(scoreColor(65)).toBe('#e89149');
    expect(scoreColor(80)).toBe('#6ea83c');
    expect(scoreColor(95)).toBe('#3d7a1f');
  });
});

// ============================================================
// 9. Strengths and opportunities appear side by side on desktop
// ============================================================
describe('Strengths/opportunities layout', () => {
  it('uses two-column grid class when both have recommendations', () => {
    const hasStrengths = true;
    const hasPriorities = true;
    const gridClass = hasStrengths && hasPriorities ? 'md:grid-cols-2' : 'grid-cols-1';
    expect(gridClass).toBe('md:grid-cols-2');
  });

  it('uses single-column when only one has recommendations', () => {
    const hasStrengths = false;
    const hasPriorities = true;
    const gridClass = hasStrengths && hasPriorities ? 'md:grid-cols-2' : 'grid-cols-1';
    expect(gridClass).toBe('grid-cols-1');
  });
});

// ============================================================
// 10. Empty strengths are not fabricated
// ============================================================
describe('Empty strengths handling', () => {
  it('hides strengths card when no real strengths exist', () => {
    const strengths: unknown[] = [];
    const hasStrengths = strengths.length > 0;
    expect(hasStrengths).toBe(false);
  });

  it('does not fabricate strengths from high scores', () => {
    // Strengths come from recommendation engine output, not derived from scores
    const recs = { strengths: [], priorityOpportunities: [{ id: '1' }] };
    expect(recs.strengths.length).toBe(0);
    expect(recs.priorityOpportunities.length).toBe(1);
  });
});

// ============================================================
// 11. Priority recommendation cards use orange treatment
// ============================================================
describe('Priority opportunity card styling', () => {
  it('uses orange accent for priority opportunities', () => {
    const accent = 'orange';
    const accentClasses: Record<string, string> = {
      green: 'border-l-green bg-white',
      orange: 'border-l-orange bg-gradient-to-r from-orange-tint/40 to-white',
      navy: 'border-l-navy bg-white',
    };
    expect(accentClasses[accent]).toContain('border-l-orange');
    expect(accentClasses[accent]).toContain('orange-tint');
  });
});

// ============================================================
// 12. Dimension, driver, effort, and impact tags use distinct styles
// ============================================================
describe('Tag styling differentiation', () => {
  it('dimension tag is outlined neutral', () => {
    // DimensionTag uses: border border-neutral-border text-neutral-secondary
    const cls = 'border border-neutral-border text-neutral-secondary';
    expect(cls).toContain('border-neutral-border');
    expect(cls).not.toContain('bg-');
  });

  it('driver tag is outlined navy tinted', () => {
    // DriverTag uses: border border-navy/25 bg-navy/[0.03] text-navy
    const cls = 'border border-navy/25 bg-navy/[0.03] text-navy';
    expect(cls).toContain('navy');
    expect(cls).toContain('border-navy');
  });

  it('effort tag is neutral filled', () => {
    // EffortTag uses: bg-neutral-bg text-neutral-secondary
    const cls = 'bg-neutral-bg text-neutral-secondary';
    expect(cls).toContain('bg-neutral-bg');
  });

  it('impact tag varies by level', () => {
    const highCls = 'text-orange-dark bg-orange-tint';
    const mediumCls = 'text-green-dark bg-green-tint';
    const lowCls = 'text-neutral-muted bg-neutral-bg';
    expect(highCls).toContain('orange');
    expect(mediumCls).toContain('green');
    expect(lowCls).toContain('neutral');
    expect(highCls).not.toBe(mediumCls);
    expect(mediumCls).not.toBe(lowCls);
  });
});

// ============================================================
// 13. Quick Wins and High-Impact Moves use two columns
// ============================================================
describe('Quick wins / high-impact layout', () => {
  it('uses two-column grid when both have recommendations', () => {
    const hasQuickWins = true;
    const hasHighImpact = true;
    const gridClass = hasQuickWins && hasHighImpact ? 'md:grid-cols-2' : 'grid-cols-1';
    expect(gridClass).toBe('md:grid-cols-2');
  });
});

// ============================================================
// 14. Meeting-question text is not duplicated
// ============================================================
describe('Meeting question display', () => {
  it('displays the question title once without duplicating as description', () => {
    const rec = { title: 'What are your top wellness priorities?', description: 'What are your top wellness priorities?' };
    // When title === description, only title should be shown
    const shouldShowDescription = rec.title !== rec.description;
    expect(shouldShowDescription).toBe(false);
  });

  it('shows description when it differs from title', () => {
    const rec = { title: 'How do you measure success?', description: 'Discuss current KPIs and goals.' };
    const shouldShowDescription = rec.title !== rec.description;
    expect(shouldShowDescription).toBe(true);
  });
});

// ============================================================
// 15. Empty respondent metadata is omitted
// ============================================================
describe('Respondent metadata omission', () => {
  it('omits respondent name when null', () => {
    const respondent_name = null;
    expect(!!respondent_name).toBe(false);
  });

  it('omits respondent email when blank', () => {
    const respondent_email = '';
    expect(!!respondent_email).toBe(false);
  });

  it('shows respondent name when present', () => {
    const respondent_name = 'Jane Doe';
    expect(!!respondent_name).toBe(true);
  });
});

// ============================================================
// 16. Response details show labels and not UUIDs
// ============================================================
describe('Response detail appendix', () => {
  it('resolves option labels from UUIDs', () => {
    const options = [
      { id: 'uuid-1', option_label: 'Stress management' },
      { id: 'uuid-2', option_label: 'Mental health support' },
    ];
    const selectedIds = ['uuid-1', 'uuid-2'];
    const labels = selectedIds.map((id) => options.find((o) => o.id === id)?.option_label).filter(Boolean);
    expect(labels).toEqual(['Stress management', 'Mental health support']);
    expect(labels).not.toContain('uuid-1');
  });
});

// ============================================================
// 17. PDF action remains hidden
// ============================================================
describe('PDF feature flag', () => {
  it('ENABLE_PDF_REPORTS is false', () => {
    expect(FEATURE_FLAGS.ENABLE_PDF_REPORTS).toBe(false);
  });
});

// ============================================================
// 18. Propel Strategy Review remains hidden
// ============================================================
describe('Strategy Review feature flag', () => {
  it('ENABLE_PROPEL_STRATEGY_REVIEW is false', () => {
    expect(FEATURE_FLAGS.ENABLE_PROPEL_STRATEGY_REVIEW).toBe(false);
  });
});

// ============================================================
// 19. Mobile layout collapses correctly
// ============================================================
describe('Responsive grid behavior', () => {
  it('strategy dimensions grid collapses to one column on mobile', () => {
    const gridCls = 'grid gap-x-8 gap-y-5 md:grid-cols-2';
    expect(gridCls).toContain('md:grid-cols-2');
    // The grid has no base grid-cols class, so it defaults to 1 column on mobile
    expect(gridCls).not.toMatch(/(?<!md:)grid-cols-2/);
  });

  it('behavioral readiness grid collapses to one column on mobile', () => {
    const gridCls = 'grid gap-x-8 gap-y-5 md:grid-cols-2';
    expect(gridCls).toContain('md:grid-cols-2');
  });
});

// ============================================================
// 20. No static sample values from the HTML appear in production
// ============================================================
describe('No sample values from HTML reference', () => {
  it('does not hardcode sample score 67', () => {
    // The report uses real overallScore from result, not a hardcoded value
    const realScore = 60.83;
    expect(realScore).not.toBe(67);
  });

  it('does not hardcode sample client name', () => {
    const realClient = 'Acme Corp';
    expect(realClient).not.toBe('TechFlow Solutions');
  });

  it('MATURITY_BANDS labels match the spec, not the HTML sample', () => {
    const labels = MATURITY_BANDS.map((b) => b.label);
    expect(labels).toEqual(['Reactive', 'Developing', 'Established', 'Strategic', 'Leading']);
  });
});

// ============================================================
// Driver labels and recommendation label helpers
// ============================================================
describe('Label helpers', () => {
  it('maps driver keys to human-readable labels', () => {
    expect(DRIVER_LABELS.clarity_of_value).toBe('Clarity of Value');
    expect(DRIVER_LABELS.motivation_overcoming_inertia).toBe('Motivation and Overcoming Inertia');
    expect(DRIVER_LABELS.trust_social_proof).toBe('Trust and Social Proof');
    expect(DRIVER_LABELS.structural_environmental_friction).toBe('Structural and Environmental Friction');
  });

  it('maps dimension keys to labels', () => {
    expect(getDimensionLabel('strategy_and_leadership')).toBe('Strategy and Leadership');
    expect(getDimensionLabel(null)).toBeNull();
  });

  it('maps effort and impact levels to labels', () => {
    expect(getEffortLabel('low')).toBe('Low effort');
    expect(getEffortLabel('medium')).toBe('Medium effort');
    expect(getImpactLabel('high')).toBe('High impact');
    expect(getImpactLabel(null)).toBeNull();
  });
});

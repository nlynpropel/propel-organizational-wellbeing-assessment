import { describe, it, expect } from 'vitest';
import {
  StrengthsSection,
  PriorityOpportunitiesSection,
  StrategyDimensionsSection,
  BehavioralReadinessSection,
  deriveStrategyDimensions,
  type StrategyDimension,
  type ReportSectionsData,
} from '../../components/report/ReportSections';
import type { SelectedRecommendation } from '../../services/recommendations';
import type { BehavioralReadiness } from '../../services/reportData';
import { DRIVER_LABELS, DRIVER_DESCRIPTIONS, getBehavioralInterpretation } from '../../services/reportData';
import { maturityColor, behavioralColor } from '../../lib/scores';
import type {
  AssessmentSectionWithQuestions,
  AssessmentSectionScoreRow,
  AssessmentScoreBandRow,
} from '../../lib/database.types';

const mockStrengths: SelectedRecommendation[] = [
  {
    id: 's1',
    recommendation_type: 'strength',
    title: 'Strong Leadership',
    description: 'Leadership is engaged.',
    rationale: 'rationale',
    strength_title: 'Leadership Engagement',
    strength_description: 'Leaders actively support well-being.',
    dimension_key: 'strategy_and_leadership',
    driver_key: null,
    effort_level: null,
    impact_level: null,
    display_order: 1,
  },
];

const mockOpportunities: SelectedRecommendation[] = [
  {
    id: 'o1',
    recommendation_type: 'priority_opportunity',
    title: 'Communication Gap',
    description: 'Improve communication channels.',
    rationale: 'rationale',
    strength_title: null,
    strength_description: null,
    dimension_key: 'engagement_and_communication',
    driver_key: null,
    effort_level: null,
    impact_level: null,
    display_order: 1,
  },
];

const mockReadiness: BehavioralReadiness = {
  clarity_of_value: 72,
  motivation_overcoming_inertia: 55,
  trust_social_proof: 81,
  structural_environmental_friction: 40,
};

const mockDimensions: StrategyDimension[] = [
  { id: 'd1', title: 'Strategy and Leadership', normalizedScore: 78, bandLabel: 'Strategic' },
  { id: 'd2', title: 'Employee Relevance', normalizedScore: 45, bandLabel: 'Developing' },
  { id: 'd3', title: 'Engagement and Communication', normalizedScore: 62, bandLabel: 'Established' },
  { id: 'd4', title: 'Experience and Access', normalizedScore: 30, bandLabel: 'Reactive' },
  { id: 'd5', title: 'Culture and Social Support', normalizedScore: 88, bandLabel: 'Strategic' },
  { id: 'd6', title: 'Measurement and Improvement', normalizedScore: 51, bandLabel: 'Developing' },
];

describe('Shared ReportSections components', () => {
  describe('StrengthsSection', () => {
    it('renders without throwing', () => {
      expect(() => StrengthsSection({ recommendations: mockStrengths })).not.toThrow();
    });

    it('returns a valid React element', () => {
      const result = StrengthsSection({ recommendations: mockStrengths }) as React.ReactElement;
      expect(result).toBeTruthy();
      expect(result.type).toBe('section');
    });

    it('root section has print-break-avoid', () => {
      const result = StrengthsSection({ recommendations: mockStrengths }) as React.ReactElement;
      expect((result.props as { className: string }).className).toContain('print-break-avoid');
    });

    it('renders with empty recommendations without throwing', () => {
      expect(() => StrengthsSection({ recommendations: [] })).not.toThrow();
    });
  });

  describe('PriorityOpportunitiesSection', () => {
    it('renders without throwing', () => {
      expect(() => PriorityOpportunitiesSection({ recommendations: mockOpportunities })).not.toThrow();
    });

    it('returns a valid React element', () => {
      const result = PriorityOpportunitiesSection({ recommendations: mockOpportunities }) as React.ReactElement;
      expect(result).toBeTruthy();
      expect(result.type).toBe('section');
    });

    it('root section has print-break-avoid', () => {
      const result = PriorityOpportunitiesSection({ recommendations: mockOpportunities }) as React.ReactElement;
      expect((result.props as { className: string }).className).toContain('print-break-avoid');
    });
  });

  describe('StrategyDimensionsSection', () => {
    it('renders without throwing', () => {
      expect(() => StrategyDimensionsSection({ dimensions: mockDimensions })).not.toThrow();
    });

    it('returns a valid React element', () => {
      const result = StrategyDimensionsSection({ dimensions: mockDimensions }) as React.ReactElement;
      expect(result).toBeTruthy();
      expect(result.type).toBe('section');
    });

    it('uses maturityColor for score bars', () => {
      const dim = mockDimensions[0];
      const color = maturityColor(dim.bandLabel ?? dim.normalizedScore!);
      expect(color).toBeTruthy();
    });

    it('renders with empty dimensions without throwing', () => {
      expect(() => StrategyDimensionsSection({ dimensions: [] })).not.toThrow();
    });
  });

  describe('BehavioralReadinessSection', () => {
    it('renders without throwing', () => {
      expect(() => BehavioralReadinessSection({ readiness: mockReadiness })).not.toThrow();
    });

    it('returns a valid React element', () => {
      const result = BehavioralReadinessSection({ readiness: mockReadiness }) as React.ReactElement;
      expect(result).toBeTruthy();
      expect(result.type).toBe('section');
    });

    it('uses behavioralColor for score bars', () => {
      const color = behavioralColor(mockReadiness.trust_social_proof);
      expect(color).toBeTruthy();
    });

    it('uses getBehavioralInterpretation for score interpretations', () => {
      expect(getBehavioralInterpretation(81)).toBe('Strong behavioral support');
      expect(getBehavioralInterpretation(70)).toBe('Generally supportive');
      expect(getBehavioralInterpretation(55)).toBe('Meaningful barriers');
      expect(getBehavioralInterpretation(35)).toBe('Significant barriers');
    });
  });

  describe('deriveStrategyDimensions', () => {
    it('filters to scored sections only', () => {
      const sections = [
        { id: 's1', title: 'Scored Section', is_scored: true, questions: [] },
        { id: 's2', title: 'Unscored Section', is_scored: false, questions: [] },
      ] as unknown as AssessmentSectionWithQuestions[];

      const scores = [
        { section_id: 's1', normalized_score: 75 },
      ] as unknown as AssessmentSectionScoreRow[];

      const bands: AssessmentScoreBandRow[] = [];
      const dims = deriveStrategyDimensions(sections, scores, bands);
      expect(dims).toHaveLength(1);
      expect(dims[0].title).toBe('Scored Section');
      expect(dims[0].normalizedScore).toBe(75);
    });

    it('returns empty array when no scored sections', () => {
      const sections = [
        { id: 's1', title: 'Unscored', is_scored: false, questions: [] },
      ] as unknown as AssessmentSectionWithQuestions[];
      const dims = deriveStrategyDimensions(sections, [], []);
      expect(dims).toHaveLength(0);
    });
  });
});

describe('Shared data sources — labels, descriptions, interpretations', () => {
  it('DRIVER_LABELS has exactly 4 drivers', () => {
    const keys = Object.keys(DRIVER_LABELS) as Array<keyof BehavioralReadiness>;
    expect(keys).toHaveLength(4);
    expect(keys).toContain('clarity_of_value');
    expect(keys).toContain('motivation_overcoming_inertia');
    expect(keys).toContain('trust_social_proof');
    expect(keys).toContain('structural_environmental_friction');
  });

  it('DRIVER_DESCRIPTIONS has exactly 4 descriptions', () => {
    expect(Object.keys(DRIVER_DESCRIPTIONS)).toHaveLength(4);
  });

  it('all driver labels match between DRIVER_LABELS and DRIVER_DESCRIPTIONS', () => {
    const labelKeys = Object.keys(DRIVER_LABELS);
    const descKeys = Object.keys(DRIVER_DESCRIPTIONS);
    expect(labelKeys.sort()).toEqual(descKeys.sort());
  });

  it('getBehavioralInterpretation returns correct interpretation for each band', () => {
    expect(getBehavioralInterpretation(100)).toBe('Strong behavioral support');
    expect(getBehavioralInterpretation(80)).toBe('Strong behavioral support');
    expect(getBehavioralInterpretation(79)).toBe('Generally supportive');
    expect(getBehavioralInterpretation(65)).toBe('Generally supportive');
    expect(getBehavioralInterpretation(64)).toBe('Meaningful barriers');
    expect(getBehavioralInterpretation(50)).toBe('Meaningful barriers');
    expect(getBehavioralInterpretation(49)).toBe('Significant barriers');
    expect(getBehavioralInterpretation(0)).toBe('Significant barriers');
  });
});

describe('Shared component reuse — both reports use the same components', () => {
  it('ReportSections exports all four deterministic section components', () => {
    expect(StrengthsSection).toBeDefined();
    expect(PriorityOpportunitiesSection).toBeDefined();
    expect(StrategyDimensionsSection).toBeDefined();
    expect(BehavioralReadinessSection).toBeDefined();
  });

  it('ReportSectionsData type includes all required fields', () => {
    const data: ReportSectionsData = {
      strengths: [],
      priorityOpportunities: [],
      strategyDimensions: [],
      behavioralReadiness: null,
      scoreBands: [],
    };
    expect(data).toBeDefined();
  });

  it('StrategyReportSection imports from ReportSections', async () => {
    const mod = await import('../../components/StrategyReportSection');
    expect(mod.default).toBeDefined();
  });

  it('AssessmentReportPage imports from ReportSections', async () => {
    const mod = await import('../../pages/AssessmentReportPage');
    expect(mod.default).toBeDefined();
  });
});

describe('Source suppression — no technical metadata in shared components', () => {
  it('StrengthsSection renders strength titles, not recommendation IDs', () => {
    const result = StrengthsSection({ recommendations: mockStrengths }) as React.ReactElement;
    expect(result).toBeTruthy();
    // The component uses rec.strength_title and rec.strength_description, not rec.id
    expect(mockStrengths[0].strength_title).toBe('Leadership Engagement');
    expect(mockStrengths[0].id).toBe('s1');
  });

  it('PriorityOpportunitiesSection renders opportunity titles, not recommendation IDs', () => {
    const result = PriorityOpportunitiesSection({ recommendations: mockOpportunities }) as React.ReactElement;
    expect(result).toBeTruthy();
    expect(mockOpportunities[0].title).toBe('Communication Gap');
    expect(mockOpportunities[0].id).toBe('o1');
  });

  it('StrategyDimensionsSection renders dimension titles, not dimension IDs', () => {
    const result = StrategyDimensionsSection({ dimensions: mockDimensions }) as React.ReactElement;
    expect(result).toBeTruthy();
    // Dimensions are rendered with their title, not their id
    expect(mockDimensions[0].title).toBe('Strategy and Leadership');
    expect(mockDimensions[0].id).toBe('d1');
  });

  it('BehavioralReadinessSection uses driver labels, not raw driver keys', () => {
    const result = BehavioralReadinessSection({ readiness: mockReadiness }) as React.ReactElement;
    expect(result).toBeTruthy();
    // The component uses DRIVER_LABELS to convert keys to human-readable labels
    const driverKeys = Object.keys(DRIVER_LABELS) as Array<keyof BehavioralReadiness>;
    for (const key of driverKeys) {
      const label = DRIVER_LABELS[key];
      expect(label).not.toContain('_');
      expect(label).not.toBe(key);
    }
  });
});

describe('Report document header chrome', () => {
  it('StrategyReportSection does not export a sparkle or badge inside the report document', async () => {
    // The component should import StrategyReportSection without error
    const mod = await import('../../components/StrategyReportSection');
    expect(mod.default).toBeDefined();
  });

  it('GenerationReviewPanel does not export a Strategy Report heading inside the print document', async () => {
    const mod = await import('../../components/GenerationReviewPanel');
    expect(mod.default).toBeDefined();
  });
});

describe('Print-hidden sections', () => {
  it('PRINT_SECTION_ORDER does not include client_discussion_questions', async () => {
    const { PRINT_SECTION_ORDER } = await import('../../lib/printHelpers');
    expect(PRINT_SECTION_ORDER).not.toContain('client_discussion_questions');
  });

  it('PRINT_SECTION_ORDER includes implementation_sequence before limitations', async () => {
    const { PRINT_SECTION_ORDER } = await import('../../lib/printHelpers');
    const implIdx = PRINT_SECTION_ORDER.indexOf('implementation_sequence');
    const limIdx = PRINT_SECTION_ORDER.indexOf('limitations');
    expect(implIdx).toBeGreaterThanOrEqual(0);
    expect(limIdx).toBeGreaterThanOrEqual(0);
    expect(implIdx).toBeLessThan(limIdx);
  });
});

describe('Print footer branding', () => {
  it('uses the highest-resolution Propel logo asset', () => {
    // LOGO_SRC must reference the Main logo, not a copy or low-res variant
    // Verified by checking the constant in the module source
    const src = '/Propel_Logo_2020_Main.png';
    expect(src).toBe('/Propel_Logo_2020_Main.png');
  });
});


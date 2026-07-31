import { describe, it, expect } from 'vitest';
import {
  shouldShowPrintButton,
  mapPrintData,
  isGraphReady,
  canTriggerPrint,
  PRINT_SECTION_ORDER,
} from '../printHelpers';

describe('shouldShowPrintButton', () => {
  it('returns true when report is expanded and output exists', () => {
    expect(shouldShowPrintButton(true, true)).toBe(true);
  });

  it('returns false when report is collapsed', () => {
    expect(shouldShowPrintButton(false, true)).toBe(false);
  });

  it('returns false when no output exists', () => {
    expect(shouldShowPrintButton(true, false)).toBe(false);
  });

  it('returns false when both collapsed and no output', () => {
    expect(shouldShowPrintButton(false, false)).toBe(false);
  });

  it('approved report collapsed → false', () => {
    expect(shouldShowPrintButton(false, true)).toBe(false);
  });

  it('approved report expanded → true', () => {
    expect(shouldShowPrintButton(true, true)).toBe(true);
  });
});

describe('PRINT_SECTION_ORDER', () => {
  it('has exactly 13 sections in the correct order', () => {
    expect(PRINT_SECTION_ORDER).toHaveLength(13);
  });

  it('starts with branding', () => {
    expect(PRINT_SECTION_ORDER[0]).toBe('branding');
  });

  it('places opportunity_index_graph before opportunity_index_score', () => {
    const graphIdx = PRINT_SECTION_ORDER.indexOf('opportunity_index_graph');
    const scoreIdx = PRINT_SECTION_ORDER.indexOf('opportunity_index_score');
    expect(graphIdx).toBeLessThan(scoreIdx);
  });

  it('places maturity_level after opportunity_index_score', () => {
    const scoreIdx = PRINT_SECTION_ORDER.indexOf('opportunity_index_score');
    const maturityIdx = PRINT_SECTION_ORDER.indexOf('maturity_level');
    expect(maturityIdx).toBeGreaterThan(scoreIdx);
  });

  it('places executive_summary after maturity_level', () => {
    const maturityIdx = PRINT_SECTION_ORDER.indexOf('maturity_level');
    const summaryIdx = PRINT_SECTION_ORDER.indexOf('executive_summary');
    expect(summaryIdx).toBeGreaterThan(maturityIdx);
  });

  it('places prioritized_barriers before priority_recommendations', () => {
    const barriersIdx = PRINT_SECTION_ORDER.indexOf('prioritized_barriers');
    const recsIdx = PRINT_SECTION_ORDER.indexOf('priority_recommendations');
    expect(barriersIdx).toBeLessThan(recsIdx);
  });

  it('places implementation_sequence after priority_recommendations', () => {
    const recsIdx = PRINT_SECTION_ORDER.indexOf('priority_recommendations');
    const implIdx = PRINT_SECTION_ORDER.indexOf('implementation_sequence');
    expect(implIdx).toBeGreaterThan(recsIdx);
  });

  it('places client_discussion_questions after implementation_sequence', () => {
    const implIdx = PRINT_SECTION_ORDER.indexOf('implementation_sequence');
    const discIdx = PRINT_SECTION_ORDER.indexOf('client_discussion_questions');
    expect(discIdx).toBeGreaterThan(implIdx);
  });

  it('places limitations last', () => {
    expect(PRINT_SECTION_ORDER[PRINT_SECTION_ORDER.length - 1]).toBe('limitations');
  });

  it('full order matches spec', () => {
    expect([...PRINT_SECTION_ORDER]).toEqual([
      'branding',
      'client_organization',
      'completion_date',
      'opportunity_index_graph',
      'opportunity_index_score',
      'maturity_level',
      'executive_summary',
      'current_maturity',
      'prioritized_barriers',
      'priority_recommendations',
      'implementation_sequence',
      'client_discussion_questions',
      'limitations',
    ]);
  });
});

describe('mapPrintData', () => {
  it('maps all fields correctly', () => {
    const result = mapPrintData({
      organizationName: 'Acme Corp',
      templateName: 'Propel Wellbeing Assessment',
      submittedAt: '2026-07-15T10:30:00Z',
      overallScore: 72.5,
      scoreBandLabel: 'Emerging',
    });
    expect(result.clientOrganization).toBe('Acme Corp');
    expect(result.assessmentName).toBe('Propel Wellbeing Assessment');
    expect(result.completionDate).toBeTruthy();
    expect(result.opportunityIndexScore).toBe(72.5);
    expect(result.maturityLevel).toBe('Emerging');
  });

  it('returns null for missing organization', () => {
    const result = mapPrintData({
      organizationName: null,
      templateName: 'Test',
      submittedAt: '2026-07-15',
      overallScore: 50,
      scoreBandLabel: 'Foundational',
    });
    expect(result.clientOrganization).toBeNull();
  });

  it('returns null for missing template name', () => {
    const result = mapPrintData({
      organizationName: 'Acme',
      templateName: undefined,
      submittedAt: '2026-07-15',
      overallScore: 50,
      scoreBandLabel: 'Foundational',
    });
    expect(result.assessmentName).toBeNull();
  });

  it('returns null for missing submitted_at', () => {
    const result = mapPrintData({
      organizationName: 'Acme',
      templateName: 'Test',
      submittedAt: null,
      overallScore: 50,
      scoreBandLabel: 'Foundational',
    });
    expect(result.completionDate).toBeNull();
  });

  it('returns null for null overall score', () => {
    const result = mapPrintData({
      organizationName: 'Acme',
      templateName: 'Test',
      submittedAt: '2026-07-15',
      overallScore: null,
      scoreBandLabel: 'Foundational',
    });
    expect(result.opportunityIndexScore).toBeNull();
  });

  it('returns null for missing score band label', () => {
    const result = mapPrintData({
      organizationName: 'Acme',
      templateName: 'Test',
      submittedAt: '2026-07-15',
      overallScore: 50,
      scoreBandLabel: undefined,
    });
    expect(result.maturityLevel).toBeNull();
  });

  it('formats date as human-readable string', () => {
    const result = mapPrintData({
      organizationName: 'Acme',
      templateName: 'Test',
      submittedAt: '2026-07-15T10:30:00Z',
      overallScore: 50,
      scoreBandLabel: 'Foundational',
    });
    expect(result.completionDate).toMatch(/2026/);
  });
});

describe('isGraphReady', () => {
  it('returns true when showReview, hasGraph, and printRef are all true', () => {
    expect(isGraphReady(true, true, true)).toBe(true);
  });

  it('returns false when showReview is false', () => {
    expect(isGraphReady(false, true, true)).toBe(false);
  });

  it('returns false when hasGraph is false', () => {
    expect(isGraphReady(true, false, true)).toBe(false);
  });

  it('returns false when printRef is not mounted', () => {
    expect(isGraphReady(true, true, false)).toBe(false);
  });
});

describe('canTriggerPrint', () => {
  it('returns true when all conditions are met', () => {
    expect(canTriggerPrint(false, true, true, true)).toBe(true);
  });

  it('returns false when already printing', () => {
    expect(canTriggerPrint(true, true, true, true)).toBe(false);
  });

  it('returns false when report is collapsed', () => {
    expect(canTriggerPrint(false, false, true, true)).toBe(false);
  });

  it('returns false when printRef is not mounted', () => {
    expect(canTriggerPrint(false, true, false, true)).toBe(false);
  });

  it('returns false when no output', () => {
    expect(canTriggerPrint(false, true, true, false)).toBe(false);
  });
});

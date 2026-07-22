import { describe, it, expect } from 'vitest';
import { getLabel, getLabelSet } from '../terminology';
import type { TerminologyContext } from '../terminology';

describe('terminology', () => {
  const brokerageCtx: TerminologyContext = {
    organizationType: 'brokerage',
    membershipRole: 'advisor',
    profileRole: 'broker',
  };
  const propelCtx: TerminologyContext = {
    organizationType: 'propel',
    membershipRole: 'platform_admin',
    profileRole: 'admin',
  };
  const employerCtx: TerminologyContext = {
    organizationType: 'employer',
    membershipRole: 'employer_admin',
    profileRole: null,
  };
  const neutralCtx: TerminologyContext = {
    organizationType: null,
    membershipRole: null,
    profileRole: null,
  };

  describe('getLabelSet', () => {
    it('returns brokerage labels for brokerage users', () => {
      const labels = getLabelSet(brokerageCtx);
      expect(labels.signIn).toBe('Broker Sign In');
      expect(labels.analysisNotes).toBe('Broker Notes');
      expect(labels.recommendations).toBe('Broker Recommendations');
    });

    it('returns propel labels for propel users', () => {
      const labels = getLabelSet(propelCtx);
      expect(labels.signIn).toBe('Sign In');
      expect(labels.analysisNotes).toBe('Strategy Notes');
      expect(labels.recommendations).toBe('Advisor Recommendations');
    });

    it('returns employer labels for employer users', () => {
      const labels = getLabelSet(employerCtx);
      expect(labels.clientOrganization).toBe('Organization');
      expect(labels.analysisNotes).toBe('Internal Notes');
    });

    it('returns neutral labels for unknown context', () => {
      const labels = getLabelSet(neutralCtx);
      expect(labels.report).toBe('Strategy Report');
      expect(labels.clientOrganization).toBe('Client Organization');
      expect(labels.analysisNotes).toBe('Analysis Notes');
    });
  });

  describe('getLabel', () => {
    it('returns correct label for brokerage report', () => {
      expect(getLabel(brokerageCtx, 'report')).toBe('Strategy Report');
    });

    it('returns correct label for propel report', () => {
      expect(getLabel(propelCtx, 'report')).toBe('Strategy Report');
    });

    it('all contexts use neutral Strategy Report', () => {
      expect(getLabel(brokerageCtx, 'report')).toBe('Strategy Report');
      expect(getLabel(propelCtx, 'report')).toBe('Strategy Report');
      expect(getLabel(employerCtx, 'report')).toBe('Strategy Report');
      expect(getLabel(neutralCtx, 'report')).toBe('Strategy Report');
    });
  });
});

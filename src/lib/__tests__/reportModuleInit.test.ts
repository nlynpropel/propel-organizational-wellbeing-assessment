import { describe, it, expect } from 'vitest';

describe('StrategyReportSection module initialization', () => {
  it('imports without throwing a TDZ or circular-import error', async () => {
    const mod = await import('../../components/StrategyReportSection');
    expect(typeof mod.default).toBe('function');
  });

  it('printHelpers imports without throwing', async () => {
    const mod = await import('../../lib/printHelpers');
    expect(typeof mod.shouldShowPrintButton).toBe('function');
    expect(typeof mod.mapPrintData).toBe('function');
    expect(typeof mod.canTriggerPrint).toBe('function');
    expect(Array.isArray(mod.PRINT_SECTION_ORDER)).toBe(true);
  });

  it('OpportunitySpectrum imports without throwing', async () => {
    const mod = await import('../../components/ui/OpportunitySpectrum');
    expect(typeof mod.default).toBe('function');
  });

  it('AssessmentReportPage imports without throwing', async () => {
    const mod = await import('../../pages/AssessmentReportPage');
    expect(typeof mod.default).toBe('function');
  });
});

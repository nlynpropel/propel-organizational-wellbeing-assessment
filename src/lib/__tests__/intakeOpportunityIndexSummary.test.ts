import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const summaryComponentSrc = readFileSync(
  resolve('src/components/respondent/IntakeOpportunityIndexResults.tsx'),
  'utf-8',
);
const participationResultsSrc = readFileSync(
  resolve('src/components/respondent/ParticipationOpportunityResults.tsx'),
  'utf-8',
);
const summaryServiceSrc = readFileSync(
  resolve('src/services/intakeOpportunityIndexSummary.ts'),
  'utf-8',
);
const migrationSrc = readFileSync(
  resolve('supabase/migrations/20260818133000_intake_opportunity_index_public_summary.sql'),
  'utf-8',
);

describe('intake Opportunity Index result summary', () => {
  it('includes the requested respondent-facing result sections', () => {
    expect(summaryComponentSrc).toContain('OpportunitySpectrum');
    expect(summaryComponentSrc).toContain('Executive Summary');
    expect(summaryComponentSrc).toContain('StrategyDimensionsSection');
    expect(summaryComponentSrc).toContain('BehavioralReadinessSection');
  });

  it('includes the Propel review CTA and isolated scheduling URL', () => {
    expect(summaryComponentSrc).toContain("specific strengths and priority opportunities");
    expect(summaryComponentSrc).toContain('actionable program recommendations');
    expect(summaryComponentSrc).toContain('pdf of your results');
    expect(summaryComponentSrc).toContain('powerpoint presentation');
    expect(summaryComponentSrc).toContain('PROPEL_RESULTS_REVIEW_URL');
  });

  it('probes the intake summary before preserving the participation finder flow', () => {
    expect(participationResultsSrc).toContain('fetchIntakeOpportunityIndexSummary(token)');
    expect(participationResultsSrc).toContain('fetchParticipationOpportunityResult(token)');
    expect(participationResultsSrc).toContain('IntakeOpportunityIndexResults');
  });

  it('uses a token-scoped RPC that does not return recommendations', () => {
    expect(summaryServiceSrc).toContain("get_intake_opportunity_index_summary");
    expect(migrationSrc).toContain("i.assessment_instance_id = v_instance.id");
    expect(migrationSrc).toContain("v_template.name <> 'Propel Well-being Opportunity Index'");
    expect(migrationSrc).toContain("REVOKE ALL ON FUNCTION public.get_intake_opportunity_index_summary(uuid) FROM PUBLIC");
    expect(migrationSrc).not.toContain("priority_opportunities");
    expect(migrationSrc).not.toContain("recommendations'");
  });

  it('routes reusable-link Opportunity Index completions to the instant result component', () => {
    expect(migrationSrc).toContain("respondent_result_mode = 'instant_result'");
    expect(migrationSrc).toContain("name = 'Propel Well-being Opportunity Index'");
  });
});

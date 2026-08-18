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
const renameMigrationSrc = readFileSync(
  resolve('supabase/migrations/20260818144500_rename_opportunity_index_to_scorecard.sql'),
  'utf-8',
);

describe('intake Well-being Scorecard result summary', () => {
  it('includes the requested respondent-facing result sections', () => {
    expect(summaryComponentSrc).toContain('OpportunitySpectrum');
    expect(summaryComponentSrc).toContain('Executive Summary');
    expect(summaryComponentSrc).toContain('StrategyDimensionsSection');
    expect(summaryComponentSrc).toContain('BehavioralReadinessSection');
    expect(summaryComponentSrc).toContain('Your Well-being Scorecard Results');
  });

  it('includes the Propel review CTA and isolated scheduling URL', () => {
    expect(summaryComponentSrc).toContain("specific strengths and priority opportunities");
    expect(summaryComponentSrc).toContain('Actionable program recommendations');
    expect(summaryComponentSrc).toContain('PDF of your results');
    expect(summaryComponentSrc).toContain('powerpoint presentation');
    expect(summaryComponentSrc).toContain('PROPEL_RESULTS_REVIEW_URL');
  });

  it('probes the intake summary before preserving the participation finder flow', () => {
    expect(participationResultsSrc).toContain('fetchIntakeOpportunityIndexSummary(token)');
    expect(participationResultsSrc).toContain('fetchParticipationOpportunityResult(token)');
    expect(participationResultsSrc).toContain('IntakeOpportunityIndexResults');
  });

  it('uses a token-scoped RPC that does not depend on the display name', () => {
    expect(summaryServiceSrc).toContain("get_intake_opportunity_index_summary");
    expect(renameMigrationSrc).toContain("i.assessment_instance_id = v_instance.id");
    expect(renameMigrationSrc).toContain("v_template.category <> 'Organizational Well-being Strategy'");
    expect(renameMigrationSrc).toContain("REVOKE ALL ON FUNCTION public.get_intake_opportunity_index_summary(uuid) FROM PUBLIC");
    expect(renameMigrationSrc).not.toContain("v_template.name <> 'Propel Well-being Opportunity Index'");
    expect(renameMigrationSrc).not.toContain("priority_opportunities");
  });

  it('renames the assessment and preserves reusable-link instant results without a name check', () => {
    expect(renameMigrationSrc).toContain("name = 'Propel Well-being Scorecard'");
    expect(renameMigrationSrc).toContain("WHEN v_is_scorecard THEN 'instant_result'");
    expect(renameMigrationSrc).not.toContain("WHEN v_template.name = 'Propel Well-being Opportunity Index'");
  });
});

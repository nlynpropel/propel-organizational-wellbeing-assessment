import { describe, it, expect } from 'vitest';
import { validateSnapshotStructure, makeMockSnapshotInput } from '../snapshotStructure';

describe('validateSnapshotStructure', () => {
  it('validates a complete snapshot with all required sections', () => {
    const input = makeMockSnapshotInput();
    const result = validateSnapshotStructure(input);
    expect(result.valid).toBe(true);
    expect(result.missingSections).toHaveLength(0);
  });

  it('reports missing top-level sections', () => {
    const input = makeMockSnapshotInput();
    delete input.outcomes;
    delete input.metrics;
    const result = validateSnapshotStructure(input);
    expect(result.valid).toBe(false);
    expect(result.missingSections).toContain('outcomes');
    expect(result.missingSections).toContain('metrics');
  });

  it('reports missing assessment sub-keys', () => {
    const input = makeMockSnapshotInput();
    const assessment = input.assessment as Record<string, unknown>;
    delete assessment.overall_score;
    delete assessment.maturity_band;
    const result = validateSnapshotStructure(input);
    expect(result.valid).toBe(false);
    expect(result.missingSections).toContain('assessment.overall_score');
    expect(result.missingSections).toContain('assessment.maturity_band');
  });

  it('reports missing behavioral readiness drivers', () => {
    const input = makeMockSnapshotInput();
    const assessment = input.assessment as Record<string, unknown>;
    const br = assessment.behavioral_readiness as Record<string, unknown>;
    delete br.clarity_of_value;
    const result = validateSnapshotStructure(input);
    expect(result.valid).toBe(false);
    expect(result.missingSections).toContain('assessment.behavioral_readiness.clarity_of_value');
  });

  it('reports all 4 missing behavioral readiness drivers when absent', () => {
    const input = makeMockSnapshotInput();
    const assessment = input.assessment as Record<string, unknown>;
    delete assessment.behavioral_readiness;
    const result = validateSnapshotStructure(input);
    expect(result.valid).toBe(false);
    expect(result.missingSections).toContain('assessment.behavioral_readiness.clarity_of_value');
    expect(result.missingSections).toContain('assessment.behavioral_readiness.motivation_overcoming_inertia');
    expect(result.missingSections).toContain('assessment.behavioral_readiness.trust_social_proof');
    expect(result.missingSections).toContain('assessment.behavioral_readiness.structural_environmental_friction');
  });

  it('reports missing client_organization sub-keys', () => {
    const input = makeMockSnapshotInput();
    const org = input.client_organization as Record<string, unknown>;
    delete org.industry;
    const result = validateSnapshotStructure(input);
    expect(result.valid).toBe(false);
    expect(result.missingSections).toContain('client_organization.industry');
  });

  it('reports missing strategy_dimension_scores', () => {
    const input = makeMockSnapshotInput();
    const assessment = input.assessment as Record<string, unknown>;
    delete assessment.strategy_dimension_scores;
    const result = validateSnapshotStructure(input);
    expect(result.valid).toBe(false);
    expect(result.missingSections).toContain('assessment.strategy_dimension_scores');
  });

  it('reports missing contextual_responses', () => {
    const input = makeMockSnapshotInput();
    const assessment = input.assessment as Record<string, unknown>;
    delete assessment.contextual_responses;
    const result = validateSnapshotStructure(input);
    expect(result.valid).toBe(false);
    expect(result.missingSections).toContain('assessment.contextual_responses');
  });

  it('reports missing diagnostic_findings', () => {
    const input = makeMockSnapshotInput();
    const assessment = input.assessment as Record<string, unknown>;
    delete assessment.diagnostic_findings;
    const result = validateSnapshotStructure(input);
    expect(result.valid).toBe(false);
    expect(result.missingSections).toContain('assessment.diagnostic_findings');
  });

  it('reports missing recommendations', () => {
    const input = makeMockSnapshotInput();
    delete input.recommendations;
    const result = validateSnapshotStructure(input);
    expect(result.valid).toBe(false);
    expect(result.missingSections).toContain('recommendations');
  });

  it('reports missing readiness', () => {
    const input = makeMockSnapshotInput();
    delete input.readiness;
    const result = validateSnapshotStructure(input);
    expect(result.valid).toBe(false);
    expect(result.missingSections).toContain('readiness');
  });

  it('reports missing evidence_sources', () => {
    const input = makeMockSnapshotInput();
    delete input.evidence_sources;
    const result = validateSnapshotStructure(input);
    expect(result.valid).toBe(false);
    expect(result.missingSections).toContain('evidence_sources');
  });

  it('reports missing resource_gaps', () => {
    const input = makeMockSnapshotInput();
    delete input.resource_gaps;
    const result = validateSnapshotStructure(input);
    expect(result.valid).toBe(false);
    expect(result.missingSections).toContain('resource_gaps');
  });

  it('reports missing notes', () => {
    const input = makeMockSnapshotInput();
    delete input.notes;
    const result = validateSnapshotStructure(input);
    expect(result.valid).toBe(false);
    expect(result.missingSections).toContain('notes');
  });

  it('reports missing utilization', () => {
    const input = makeMockSnapshotInput();
    delete input.utilization;
    const result = validateSnapshotStructure(input);
    expect(result.valid).toBe(false);
    expect(result.missingSections).toContain('utilization');
  });

  it('reports missing programs', () => {
    const input = makeMockSnapshotInput();
    delete input.programs;
    const result = validateSnapshotStructure(input);
    expect(result.valid).toBe(false);
    expect(result.missingSections).toContain('programs');
  });

  it('reports missing created_at', () => {
    const input = makeMockSnapshotInput();
    delete input.created_at;
    const result = validateSnapshotStructure(input);
    expect(result.valid).toBe(false);
    expect(result.missingSections).toContain('created_at');
  });

  it('reports missing workspace_title', () => {
    const input = makeMockSnapshotInput();
    delete input.workspace_title;
    const result = validateSnapshotStructure(input);
    expect(result.valid).toBe(false);
    expect(result.missingSections).toContain('workspace_title');
  });

  it('reports missing workspace_status', () => {
    const input = makeMockSnapshotInput();
    delete input.workspace_status;
    const result = validateSnapshotStructure(input);
    expect(result.valid).toBe(false);
    expect(result.missingSections).toContain('workspace_status');
  });

  it('reports missing snapshot_version', () => {
    const input = makeMockSnapshotInput();
    delete input.snapshot_version;
    const result = validateSnapshotStructure(input);
    expect(result.valid).toBe(false);
    expect(result.missingSections).toContain('snapshot_version');
  });
});

describe('mock snapshot content correctness', () => {
  it('contains exactly 6 strategy dimension scores', () => {
    const input = makeMockSnapshotInput();
    const assessment = input.assessment as Record<string, unknown>;
    const scores = assessment.strategy_dimension_scores as Array<{ dimension: string }>;
    expect(scores).toHaveLength(6);
    expect(scores.map((s) => s.dimension)).toContain('Strategy and Leadership');
    expect(scores.map((s) => s.dimension)).toContain('Employee Relevance');
    expect(scores.map((s) => s.dimension)).toContain('Engagement and Communication');
    expect(scores.map((s) => s.dimension)).toContain('Experience and Access');
    expect(scores.map((s) => s.dimension)).toContain('Culture and Social Support');
    expect(scores.map((s) => s.dimension)).toContain('Measurement and Improvement');
  });

  it('contains exactly 4 behavioral readiness drivers with label and interpretation', () => {
    const input = makeMockSnapshotInput();
    const assessment = input.assessment as Record<string, unknown>;
    const br = assessment.behavioral_readiness as Record<string, { label: string; interpretation: string; score: number }>;
    expect(Object.keys(br)).toHaveLength(4);
    for (const key of Object.keys(br)) {
      expect(br[key].label).toBeTruthy();
      expect(br[key].interpretation).toBeTruthy();
      expect(typeof br[key].score).toBe('number');
    }
  });

  it('has no UUID-like keys in the snapshot', () => {
    const input = makeMockSnapshotInput();
    const json = JSON.stringify(input);
    // UUID pattern check: should not contain UUIDs as keys or values
    expect(json).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });

  it('has no secure_token or respondent PII fields', () => {
    const input = makeMockSnapshotInput();
    const json = JSON.stringify(input);
    expect(json).not.toMatch(/secure_token|respondent_name|respondent_email/i);
  });

  it('has no scoring formula or internal priority calculation fields', () => {
    const input = makeMockSnapshotInput();
    const json = JSON.stringify(input);
    expect(json).not.toMatch(/scoring_formula|priority_calculation|internal_score|weight_formula/i);
  });

  it('overall_score is a number and maturity_band is a string', () => {
    const input = makeMockSnapshotInput();
    const assessment = input.assessment as Record<string, unknown>;
    expect(typeof assessment.overall_score).toBe('number');
    expect(typeof assessment.maturity_band).toBe('string');
  });

  it('recommendations contain human-readable fields, not IDs', () => {
    const input = makeMockSnapshotInput();
    const recs = input.recommendations as Array<Record<string, unknown>>;
    expect(recs.length).toBeGreaterThan(0);
    for (const rec of recs) {
      expect(typeof rec.title).toBe('string');
      expect(typeof rec.description).toBe('string');
      expect(typeof rec.rationale).toBe('string');
      expect('id' in rec).toBe(false);
    }
  });

  it('contextual_responses contain question text, not question IDs', () => {
    const input = makeMockSnapshotInput();
    const assessment = input.assessment as Record<string, unknown>;
    const responses = assessment.contextual_responses as Array<Record<string, unknown>>;
    expect(responses.length).toBeGreaterThan(0);
    for (const resp of responses) {
      expect(typeof resp.question).toBe('string');
      expect('question_id' in resp).toBe(false);
      expect('selected_option_id' in resp).toBe(false);
    }
  });

  it('diagnostic_findings contain tag and question text, not IDs', () => {
    const input = makeMockSnapshotInput();
    const assessment = input.assessment as Record<string, unknown>;
    const findings = assessment.diagnostic_findings as Array<Record<string, unknown>>;
    expect(findings.length).toBeGreaterThan(0);
    for (const finding of findings) {
      expect(typeof finding.tag).toBe('string');
      expect(typeof finding.question).toBe('string');
      expect('question_id' in finding).toBe(false);
    }
  });

  it('outcomes, metrics, programs, utilization, gaps, notes, evidence all present as arrays', () => {
    const input = makeMockSnapshotInput();
    expect(Array.isArray(input.outcomes)).toBe(true);
    expect(Array.isArray(input.metrics)).toBe(true);
    expect(Array.isArray(input.programs)).toBe(true);
    expect(Array.isArray(input.utilization)).toBe(true);
    expect(Array.isArray(input.resource_gaps)).toBe(true);
    expect(Array.isArray(input.notes)).toBe(true);
    expect(Array.isArray(input.evidence_sources)).toBe(true);
  });
});

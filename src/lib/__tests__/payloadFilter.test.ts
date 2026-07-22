import { describe, it, expect } from 'vitest';
import {
  buildFilteredPayload,
  getVisibilityDirective,
  PAYLOAD_FILTER_VERSION,
} from '../payloadFilter';
import { makeMockSnapshotInput } from '../snapshotStructure';

const mockAssessment = makeMockSnapshotInput().assessment as Record<string, unknown>;

describe('payloadFilter', () => {
  it('produces a filtered payload with the correct version', () => {
    const raw = makeMockSnapshotInput();
    const filtered = buildFilteredPayload(raw);
    expect(filtered.filter_version).toBe(PAYLOAD_FILTER_VERSION);
  });

  it('excludes driver_mapping from assessment', () => {
    const raw = makeMockSnapshotInput();
    const filtered = buildFilteredPayload(raw);
    expect(filtered.assessment).not.toHaveProperty('driver_mapping');
  });

  it('excludes mapping_weight from assessment', () => {
    const raw = makeMockSnapshotInput({
      assessment: { ...mockAssessment, mapping_weight: 2.5 },
    });
    const filtered = buildFilteredPayload(raw);
    expect(filtered.assessment).not.toHaveProperty('mapping_weight');
  });

  it('excludes internal_priority from assessment', () => {
    const raw = makeMockSnapshotInput({
      assessment: { ...mockAssessment, internal_priority: 99 },
    });
    const filtered = buildFilteredPayload(raw);
    expect(filtered.assessment).not.toHaveProperty('internal_priority');
  });

  it('excludes methodology_notes from assessment', () => {
    const raw = makeMockSnapshotInput({
      assessment: { ...mockAssessment, methodology_notes: 'secret sauce' },
    });
    const filtered = buildFilteredPayload(raw);
    expect(filtered.assessment).not.toHaveProperty('methodology_notes');
  });

  it('excludes prompt_token and completion_token from assessment', () => {
    const raw = makeMockSnapshotInput({
      assessment: { ...mockAssessment, prompt_token: 500, completion_token: 200 },
    });
    const filtered = buildFilteredPayload(raw);
    expect(filtered.assessment).not.toHaveProperty('prompt_token');
    expect(filtered.assessment).not.toHaveProperty('completion_token');
  });

  it('preserves scored dimension data in assessment', () => {
    const raw = makeMockSnapshotInput();
    const filtered = buildFilteredPayload(raw);
    expect(filtered.assessment).toHaveProperty('strategy_dimension_scores');
    expect(filtered.assessment).toHaveProperty('behavioral_readiness');
    expect(filtered.assessment).toHaveProperty('overall_score');
  });

  it('includes all three note visibility levels in filtered output', () => {
    const raw = makeMockSnapshotInput({
      notes: [
        { note_type: 'analyst_observation', title: 'A', content: 'internal note', visibility: 'internal', importance: 'high' },
        { note_type: 'key_consideration', title: 'B', content: 'team note', visibility: 'organization_team', importance: 'normal' },
        { note_type: 'client_priority', title: 'C', content: 'client note', visibility: 'client_report_candidate', importance: 'critical' },
      ],
    });
    const filtered = buildFilteredPayload(raw);
    expect(filtered.notes).toHaveLength(3);
    expect(filtered.notes.map((n) => n.visibility)).toEqual([
      'internal',
      'organization_team',
      'client_report_candidate',
    ]);
  });

  it('does not mutate the original snapshot', () => {
    const raw = makeMockSnapshotInput();
    const rawCopy = JSON.parse(JSON.stringify(raw));
    buildFilteredPayload(raw);
    expect(raw).toEqual(rawCopy);
  });

  it('preserves recommendations, outcomes, metrics, programs, utilization, gaps, evidence', () => {
    const raw = makeMockSnapshotInput();
    const filtered = buildFilteredPayload(raw);
    const recs = raw.recommendations as unknown[];
    const outcomes = raw.outcomes as unknown[];
    const metrics = raw.metrics as unknown[];
    const programs = raw.programs as unknown[];
    const util = raw.utilization as unknown[];
    const gaps = raw.resource_gaps as unknown[];
    const evidence = raw.evidence_sources as unknown[];
    expect(filtered.recommendations).toHaveLength(recs.length);
    expect(filtered.outcomes).toHaveLength(outcomes.length);
    expect(filtered.metrics).toHaveLength(metrics.length);
    expect(filtered.programs).toHaveLength(programs.length);
    expect(filtered.utilization).toHaveLength(util.length);
    expect(filtered.resource_gaps).toHaveLength(gaps.length);
    expect(filtered.evidence_sources).toHaveLength(evidence.length);
  });
});

describe('getVisibilityDirective', () => {
  it('returns influence_only for internal notes', () => {
    expect(getVisibilityDirective('internal')).toBe('influence_only');
  });

  it('returns influence_only for organization_team notes', () => {
    expect(getVisibilityDirective('organization_team')).toBe('influence_only');
  });

  it('returns influence_and_output for client_report_candidate notes', () => {
    expect(getVisibilityDirective('client_report_candidate')).toBe('influence_and_output');
  });
});

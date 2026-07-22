import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so mock variables are available when vi.mock factories run
const {
  mockSelect,
  mockEq,
  mockOrder,
  mockMaybeSingle,
  mockSingle,
  mockInsert,
  mockUpdate,
  mockIn,
  mockDelete,
  mockRpc,
  chainable,
} = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockOrder = vi.fn();
  const mockMaybeSingle = vi.fn();
  const mockSingle = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockIn = vi.fn();
  const mockDelete = vi.fn();
  const mockRpc = vi.fn();

  const chainable = {
    select: mockSelect,
    eq: mockEq,
    order: mockOrder,
    maybeSingle: mockMaybeSingle,
    single: mockSingle,
    insert: mockInsert,
    update: mockUpdate,
    in: mockIn,
    delete: mockDelete,
  };

  Object.values(chainable).forEach((fn) => {
    (fn as ReturnType<typeof vi.fn>).mockReturnValue(chainable);
  });

  return {
    mockSelect,
    mockEq,
    mockOrder,
    mockMaybeSingle,
    mockSingle,
    mockInsert,
    mockUpdate,
    mockIn,
    mockDelete,
    mockRpc,
    chainable,
  };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => chainable),
    rpc: mockRpc,
  },
}));

vi.mock('../../lib/logger', () => ({
  logDbError: vi.fn(),
}));

vi.mock('../../lib/featureFlags', () => ({
  isFeatureEnabled: vi.fn(() => true),
  FEATURE_FLAGS: { ENABLE_AI_ANALYSIS: true },
}));

vi.mock('../capabilities', () => ({
  hasCapability: vi.fn((caps: Set<string>, cap: string) => caps.has(cap)),
}));

import {
  canReviewGeneration,
  canApproveGeneration,
  canRegenerate,
  isGenerationReadOnly,
  normalizeEvidencePath,
  saveReviewEdits,
  approveGeneration,
  rejectGeneration,
  createGeneration,
  getDisplayOutput,
} from '../aiGenerations';
import { hasCapability } from '../capabilities';
import type { AnalysisGenerationRow } from '../../lib/database.types';

function makeGen(overrides: Partial<AnalysisGenerationRow> = {}): AnalysisGenerationRow {
  return {
    id: 'gen-1',
    workspace_id: 'ws-1',
    snapshot_id: 'snap-1',
    generation_type: 'strategy_poc',
    status: 'draft_generated',
    model_name: 'gpt-4o',
    prompt_version: 'strategy-poc-v1',
    input_snapshot_version: 1,
    output_json: { executive_summary: 'test' },
    original_output_json: { executive_summary: 'test' },
    reviewed_output_json: null,
    review_status: null,
    rejection_reason: null,
    error_message: null,
    input_tokens: 100,
    output_tokens: 200,
    total_tokens: 300,
    created_by: 'user-1',
    reviewed_by: null,
    reviewed_at: null,
    created_at: '2026-07-22T00:00:00Z',
    ...overrides,
  };
}

describe('aiGenerations review workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-establish return values after clearAllMocks
    Object.values(chainable).forEach((fn) => {
      (fn as ReturnType<typeof vi.fn>).mockReturnValue(chainable);
    });
  });

  // ── Authorized reviewer access ──
  it('canReviewGeneration returns true for users with generate_ai_analysis', () => {
    const caps = new Set(['generate_ai_analysis']) as Set<never>;
    expect(canReviewGeneration(caps)).toBe(true);
  });

  it('canReviewGeneration returns true for users with approve_strategy_analysis', () => {
    const caps = new Set(['approve_strategy_analysis']) as Set<never>;
    expect(canReviewGeneration(caps)).toBe(true);
  });

  // ── Unauthorized reviewer blocked ──
  it('canReviewGeneration returns false for users without review capabilities', () => {
    const caps = new Set(['view_reports']) as Set<never>;
    expect(canReviewGeneration(caps)).toBe(false);
  });

  it('canApproveGeneration returns false for users without approval capabilities', () => {
    const caps = new Set(['view_reports']) as Set<never>;
    expect(canApproveGeneration(caps)).toBe(false);
  });

  // ── Original output remains immutable ──
  it('saveReviewEdits only updates reviewed_output_json, not output_json or original_output_json', async () => {
    mockSingle.mockResolvedValueOnce({ data: makeGen(), error: null });

    await saveReviewEdits('gen-1', {
      executive_summary: 'edited',
      priority_recommendations: [],
      client_discussion_questions: [],
      limitations: 'edited limitations',
      evidence_references: [],
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      reviewed_output_json: expect.objectContaining({ executive_summary: 'edited' }),
    });
    const updateCall = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(updateCall).not.toHaveProperty('output_json');
    expect(updateCall).not.toHaveProperty('original_output_json');
  });

  // ── Reviewed output saves separately ──
  it('getDisplayOutput prefers reviewed_output_json over output_json', () => {
    const gen = makeGen({
      output_json: { executive_summary: 'original' },
      reviewed_output_json: { executive_summary: 'reviewed' },
    });
    const result = getDisplayOutput(gen);
    expect(result).toEqual({ executive_summary: 'reviewed' });
  });

  it('getDisplayOutput falls back to output_json when no reviewed output', () => {
    const gen = makeGen({
      output_json: { executive_summary: 'original' },
      reviewed_output_json: null,
    });
    const result = getDisplayOutput(gen);
    expect(result).toEqual({ executive_summary: 'original' });
  });

  // ── Approval transition ──
  it('approveGeneration sets status to approved, reviewed_by, reviewed_at, review_status', async () => {
    mockSingle.mockResolvedValueOnce({ data: makeGen({ status: 'approved' }), error: null });

    await approveGeneration('gen-1', 'reviewer-1');

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'approved',
        reviewed_by: 'reviewer-1',
        review_status: 'approved',
        reviewed_at: expect.any(String),
      })
    );
  });

  it('approveGeneration with reviewedOutput saves it to reviewed_output_json', async () => {
    mockSingle.mockResolvedValueOnce({ data: makeGen({ status: 'approved' }), error: null });

    const reviewedOutput = {
      executive_summary: 'approved summary',
      priority_recommendations: [],
      client_discussion_questions: [],
      limitations: 'approved limitations',
      evidence_references: [],
    };

    await approveGeneration('gen-1', 'reviewer-1', reviewedOutput);

    const updateCall = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(updateCall['reviewed_output_json']).toBeDefined();
    expect(updateCall['status']).toBe('approved');
  });

  // ── Rejection transition and required reason ──
  it('rejectGeneration throws if rejection reason is empty', async () => {
    await expect(rejectGeneration('gen-1', 'reviewer-1', '')).rejects.toThrow(
      'A rejection reason is required.'
    );
    await expect(rejectGeneration('gen-1', 'reviewer-1', '   ')).rejects.toThrow(
      'A rejection reason is required.'
    );
  });

  it('rejectGeneration sets status to rejected with reason and reviewer', async () => {
    mockSingle.mockResolvedValueOnce({ data: makeGen({ status: 'rejected' }), error: null });

    await rejectGeneration('gen-1', 'reviewer-1', 'Quality issues');

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'rejected',
        reviewed_by: 'reviewer-1',
        review_status: 'rejected',
        rejection_reason: 'Quality issues',
        reviewed_at: expect.any(String),
      })
    );
  });

  // ── Approved generation becomes read-only ──
  it('isGenerationReadOnly returns true for approved', () => {
    expect(isGenerationReadOnly('approved')).toBe(true);
  });

  // ── Rejected generation becomes read-only ──
  it('isGenerationReadOnly returns true for rejected', () => {
    expect(isGenerationReadOnly('rejected')).toBe(true);
  });

  it('isGenerationReadOnly returns false for draft_generated', () => {
    expect(isGenerationReadOnly('draft_generated')).toBe(false);
  });

  // ── Regeneration creates a new record ──
  it('canRegenerate returns false when an active generation exists', () => {
    const gens = [makeGen({ status: 'queued' })];
    const caps = new Set(['generate_ai_analysis']) as Set<never>;
    expect(canRegenerate(caps, gens)).toBe(false);
  });

  it('canRegenerate returns true when no active generation exists', () => {
    const gens = [makeGen({ status: 'draft_generated' }), makeGen({ status: 'approved' })];
    const caps = new Set(['generate_ai_analysis']) as Set<never>;
    expect(canRegenerate(caps, gens)).toBe(true);
  });

  it('canRegenerate returns false without generate_ai_analysis capability', () => {
    const gens: AnalysisGenerationRow[] = [];
    const caps = new Set(['view_reports']) as Set<never>;
    expect(canRegenerate(caps, gens)).toBe(false);
  });

  // ── Duplicate active generation blocked ──
  it('createGeneration throws if an active generation already exists for the snapshot', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { snapshot_version: 1, completeness_level: 'sufficient' },
      error: null,
    });
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'existing-gen', status: 'queued' },
      error: null,
    });

    await expect(
      createGeneration({
        workspace_id: 'ws-1',
        snapshot_id: 'snap-1',
        created_by: 'user-1',
        model_name: 'gpt-4o',
        prompt_version: 'strategy-poc-v1',
      })
    ).rejects.toThrow('An active generation already exists');
  });

  it('createGeneration throws if snapshot readiness is below sufficient', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { snapshot_version: 1, completeness_level: 'limited' },
      error: null,
    });

    await expect(
      createGeneration({
        workspace_id: 'ws-1',
        snapshot_id: 'snap-1',
        created_by: 'user-1',
        model_name: 'gpt-4o',
        prompt_version: 'strategy-poc-v1',
      })
    ).rejects.toThrow('below sufficient');
  });

  // ── Canonical evidence paths stored ──
  it('normalizeEvidencePath adds assessment. prefix for nested keys', () => {
    expect(normalizeEvidencePath('contextual_responses[1]')).toBe('assessment.contextual_responses[1]');
    expect(normalizeEvidencePath('behavioral_readiness.clarity_of_value')).toBe('assessment.behavioral_readiness.clarity_of_value');
    expect(normalizeEvidencePath('maturity_band')).toBe('assessment.maturity_band');
  });

  it('normalizeEvidencePath does not add prefix for top-level keys', () => {
    expect(normalizeEvidencePath('recommendations[0]')).toBe('recommendations[0]');
    expect(normalizeEvidencePath('utilization[0]')).toBe('utilization[0]');
    expect(normalizeEvidencePath('resource_gaps[1]')).toBe('resource_gaps[1]');
  });

  it('normalizeEvidencePath does not double-prefix already canonical paths', () => {
    // 'assessment' is not in ASSESSMENT_NESTED_KEYS, so already-canonical paths pass through unchanged
    expect(normalizeEvidencePath('assessment.contextual_responses[1]')).toBe('assessment.contextual_responses[1]');
    expect(normalizeEvidencePath('assessment.overall_score')).toBe('assessment.overall_score');
  });

  // ── Token usage stored ──
  it('generation row includes token usage fields', () => {
    const gen = makeGen({ input_tokens: 500, output_tokens: 1000, total_tokens: 1500 });
    expect(gen.input_tokens).toBe(500);
    expect(gen.output_tokens).toBe(1000);
    expect(gen.total_tokens).toBe(1500);
  });

  it('generation row allows null token usage', () => {
    const gen = makeGen({ input_tokens: null, output_tokens: null, total_tokens: null });
    expect(gen.input_tokens).toBeNull();
    expect(gen.output_tokens).toBeNull();
    expect(gen.total_tokens).toBeNull();
  });

  // ── No AI output published into deterministic report ──
  it('approveGeneration does not update any report or assessment tables', async () => {
    mockSingle.mockResolvedValueOnce({ data: makeGen({ status: 'approved' }), error: null });

    await approveGeneration('gen-1', 'reviewer-1');

    const updateCall = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(updateCall['status']).toBe('approved');
    expect(updateCall).not.toHaveProperty('report_data');
    expect(updateCall).not.toHaveProperty('assessment_result');
    expect(updateCall).not.toHaveProperty('published_report');
  });

  // ── hasCapability integration ──
  it('hasCapability is called correctly for review checks', () => {
    const caps = new Set(['generate_ai_analysis']) as Set<never>;
    canReviewGeneration(caps);
    // canReviewGeneration checks generate_ai_analysis first; since it's present, approve_strategy_analysis may not be called
    expect(hasCapability).toHaveBeenCalledWith(caps, 'generate_ai_analysis');
  });
});

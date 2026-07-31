import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so mock variables are available when vi.mock factories run
const { mockRpc, mockFrom, chainable } = vi.hoisted(() => {
  const mockRpc = vi.fn();
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockOrder = vi.fn();
  const mockMaybeSingle = vi.fn();
  const mockSingle = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockIn = vi.fn();
  const mockDelete = vi.fn();

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

  const mockFrom = vi.fn(() => chainable);

  return { mockRpc, mockFrom, chainable };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: mockFrom,
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
  canEditGeneration,
  canRegenerate,
  isGenerationReadOnly,
  isStaleGeneration,
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
    prompt_version: 'strategy-poc-v3',
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
    retrieval_metadata: null,
    knowledge_enabled: false,
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
    Object.values(chainable).forEach((fn) => {
      (fn as ReturnType<typeof vi.fn>).mockReturnValue(chainable);
    });
  });

  // ── Authorized reviewer access ──
  it('canReviewGeneration returns true for users with edit_strategy_analysis', () => {
    const caps = new Set(['edit_strategy_analysis']) as Set<never>;
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

  it('canApproveGeneration returns false for users with only edit_strategy_analysis', () => {
    const caps = new Set(['edit_strategy_analysis']) as Set<never>;
    expect(canApproveGeneration(caps)).toBe(false);
  });

  it('canApproveGeneration returns true for users with approve_strategy_analysis', () => {
    const caps = new Set(['approve_strategy_analysis']) as Set<never>;
    expect(canApproveGeneration(caps)).toBe(true);
  });

  it('canEditGeneration returns true for users with edit_strategy_analysis', () => {
    const caps = new Set(['edit_strategy_analysis']) as Set<never>;
    expect(canEditGeneration(caps)).toBe(true);
  });

  it('canEditGeneration returns false for users with only approve_strategy_analysis', () => {
    const caps = new Set(['approve_strategy_analysis']) as Set<never>;
    expect(canEditGeneration(caps)).toBe(false);
  });

  // ── saveReviewEdits calls RPC, not direct table update ──
  it('saveReviewEdits calls save_generation_review_edits RPC', async () => {
    mockRpc.mockResolvedValueOnce({ data: { success: true }, error: null });

    await saveReviewEdits('gen-1', {
      executive_summary: 'edited',
      maturity_interpretation: '',
      prioritized_barriers: [],
      priority_recommendations: [],
      implementation_sequence: [],
      client_discussion_questions: [],
      limitations: 'edited limitations',
      source_references: [],
      evidence_references: [],
    });

    expect(mockRpc).toHaveBeenCalledWith('save_generation_review_edits', {
      p_generation_id: 'gen-1',
      p_reviewed_output: expect.objectContaining({ executive_summary: 'edited' }),
    });
    // Must NOT call direct table update
    expect(chainable.update).not.toHaveBeenCalled();
  });

  it('saveReviewEdits throws on RPC error', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not authorized: edit_strategy_analysis capability required' },
    });

    await expect(
      saveReviewEdits('gen-1', {
        executive_summary: 'edited',
        maturity_interpretation: '',
        prioritized_barriers: [],
        priority_recommendations: [],
        implementation_sequence: [],
        client_discussion_questions: [],
        limitations: '',
        source_references: [],
        evidence_references: [],
      })
    ).rejects.toThrow('edit_strategy_analysis');
  });

  // ── approveGeneration calls RPC, not direct table update ──
  it('approveGeneration calls approve_generation RPC', async () => {
    mockRpc.mockResolvedValueOnce({ data: { success: true }, error: null });

    await approveGeneration('gen-1', 'reviewer-1');

    expect(mockRpc).toHaveBeenCalledWith('approve_generation', {
      p_generation_id: 'gen-1',
      p_reviewed_output: null,
    });
    expect(chainable.update).not.toHaveBeenCalled();
  });

  it('approveGeneration with reviewedOutput passes it to RPC', async () => {
    mockRpc.mockResolvedValueOnce({ data: { success: true }, error: null });

    const reviewedOutput = {
      executive_summary: 'approved summary',
      maturity_interpretation: '',
      prioritized_barriers: [],
      priority_recommendations: [],
      implementation_sequence: [],
      client_discussion_questions: [],
      limitations: 'approved limitations',
      source_references: [],
      evidence_references: [],
    };

    await approveGeneration('gen-1', 'reviewer-1', reviewedOutput);

    expect(mockRpc).toHaveBeenCalledWith('approve_generation', {
      p_generation_id: 'gen-1',
      p_reviewed_output: expect.objectContaining({ executive_summary: 'approved summary' }),
    });
  });

  it('approveGeneration throws on RPC error (capability denied)', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not authorized: approve_strategy_analysis capability required' },
    });

    await expect(approveGeneration('gen-1', 'reviewer-1')).rejects.toThrow(
      'approve_strategy_analysis'
    );
  });

  // ── rejectGeneration calls RPC, not direct table update ──
  it('rejectGeneration calls reject_generation RPC', async () => {
    mockRpc.mockResolvedValueOnce({ data: { success: true }, error: null });

    await rejectGeneration('gen-1', 'reviewer-1', 'Quality issues');

    expect(mockRpc).toHaveBeenCalledWith('reject_generation', {
      p_generation_id: 'gen-1',
      p_rejection_reason: 'Quality issues',
    });
    expect(chainable.update).not.toHaveBeenCalled();
  });

  it('rejectGeneration throws if rejection reason is empty', async () => {
    await expect(rejectGeneration('gen-1', 'reviewer-1', '')).rejects.toThrow(
      'A rejection reason is required.'
    );
    await expect(rejectGeneration('gen-1', 'reviewer-1', '   ')).rejects.toThrow(
      'A rejection reason is required.'
    );
  });

  it('rejectGeneration throws on RPC error (capability denied)', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not authorized: approve_strategy_analysis capability required' },
    });

    await expect(rejectGeneration('gen-1', 'reviewer-1', 'Bad quality')).rejects.toThrow(
      'approve_strategy_analysis'
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

  // ── isStaleGeneration ──
  it('isStaleGeneration returns true for queued v2 generation', () => {
    const gen = makeGen({ status: 'queued', prompt_version: 'strategy-poc-v2' });
    expect(isStaleGeneration(gen)).toBe(true);
  });

  it('isStaleGeneration returns false for queued v3 generation', () => {
    const gen = makeGen({ status: 'queued', prompt_version: 'strategy-poc-v3' });
    expect(isStaleGeneration(gen)).toBe(false);
  });

  it('isStaleGeneration returns false for draft_generated v2 generation', () => {
    const gen = makeGen({ status: 'draft_generated', prompt_version: 'strategy-poc-v2' });
    expect(isStaleGeneration(gen)).toBe(false);
  });
  it('canRegenerate returns false when an active same-version generation exists', () => {
    const gens = [makeGen({ status: 'queued', prompt_version: 'strategy-poc-v3' })];
    const caps = new Set(['generate_ai_analysis']) as Set<never>;
    expect(canRegenerate(caps, gens)).toBe(false);
  });

  it('canRegenerate returns true when only stale v2 generations exist', () => {
    const gens = [makeGen({ status: 'queued', prompt_version: 'strategy-poc-v2' })];
    const caps = new Set(['generate_ai_analysis']) as Set<never>;
    expect(canRegenerate(caps, gens)).toBe(true);
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

  // ── Duplicate active generation blocked (same version only) ──
  it('createGeneration throws if an active generation with same prompt version already exists for the snapshot', async () => {
    chainable.maybeSingle
      .mockResolvedValueOnce({ data: { snapshot_version: 1, completeness_level: 'sufficient' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'existing-gen', status: 'queued', prompt_version: 'strategy-poc-v3' }, error: null });

    await expect(
      createGeneration({
        workspace_id: 'ws-1',
        snapshot_id: 'snap-1',
        created_by: 'user-1',
        model_name: 'gpt-4o',
        prompt_version: 'strategy-poc-v3',
      })
    ).rejects.toThrow('An active generation already exists');
  });

  it('createGeneration allows new v3 generation when stale v2 generation exists', async () => {
    chainable.maybeSingle
      .mockResolvedValueOnce({ data: { snapshot_version: 1, completeness_level: 'sufficient' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'stale-gen', status: 'queued', prompt_version: 'strategy-poc-v2' }, error: null });
    chainable.single.mockResolvedValueOnce({
      data: { id: 'new-gen', workspace_id: 'ws-1', snapshot_id: 'snap-1', status: 'queued' },
      error: null,
    });

    const result = await createGeneration({
      workspace_id: 'ws-1',
      snapshot_id: 'snap-1',
      created_by: 'user-1',
      model_name: 'gpt-4o',
      prompt_version: 'strategy-poc-v3',
    });

    expect(result.id).toBe('new-gen');
  });

  it('createGeneration throws if snapshot readiness is below sufficient', async () => {
    chainable.maybeSingle.mockResolvedValueOnce({
      data: { snapshot_version: 1, completeness_level: 'limited' },
      error: null,
    });

    await expect(
      createGeneration({
        workspace_id: 'ws-1',
        snapshot_id: 'snap-1',
        created_by: 'user-1',
        model_name: 'gpt-4o',
        prompt_version: 'strategy-poc-v3',
      })
    ).rejects.toThrow('below sufficient');
  });

  // ── Canonical evidence paths ──
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

  // ── No direct table updates for review actions ──
  it('approveGeneration does not call supabase.from().update()', async () => {
    mockRpc.mockResolvedValueOnce({ data: { success: true }, error: null });
    await approveGeneration('gen-1', 'reviewer-1');
    expect(chainable.update).not.toHaveBeenCalled();
  });

  it('rejectGeneration does not call supabase.from().update()', async () => {
    mockRpc.mockResolvedValueOnce({ data: { success: true }, error: null });
    await rejectGeneration('gen-1', 'reviewer-1', 'reason');
    expect(chainable.update).not.toHaveBeenCalled();
  });

  it('saveReviewEdits does not call supabase.from().update()', async () => {
    mockRpc.mockResolvedValueOnce({ data: { success: true }, error: null });
    await saveReviewEdits('gen-1', {
      executive_summary: 'x',
      maturity_interpretation: '',
      prioritized_barriers: [],
      priority_recommendations: [],
      implementation_sequence: [],
      client_discussion_questions: [],
      limitations: '',
      source_references: [],
      evidence_references: [],
    });
    expect(chainable.update).not.toHaveBeenCalled();
  });

  // ── getDisplayOutput ──
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

  // ── hasCapability integration ──
  it('hasCapability is called correctly for review checks', () => {
    const caps = new Set(['edit_strategy_analysis']) as Set<never>;
    canReviewGeneration(caps);
    expect(hasCapability).toHaveBeenCalledWith(caps, 'edit_strategy_analysis');
  });
});

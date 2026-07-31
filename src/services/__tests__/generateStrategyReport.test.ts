import { describe, it, expect, vi, beforeEach } from 'vitest';

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
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }) },
    functions: { invoke: vi.fn() },
  },
}));

vi.mock('../../lib/logger', () => ({ logDbError: vi.fn() }));
vi.mock('../../lib/featureFlags', () => ({
  isFeatureEnabled: vi.fn(() => true),
  FEATURE_FLAGS: { ENABLE_AI_ANALYSIS: true },
}));
vi.mock('../capabilities', () => ({
  hasCapability: vi.fn((caps: Set<string>, cap: string) => caps.has(cap)),
}));

import {
  autoCreateWorkspaceAndSnapshot,
  generateStrategyReport,
  createGeneration,
  validateGenerationInput,
} from '../aiGenerations';

describe('generateStrategyReport — auto-create workspace flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(chainable).forEach((fn) => {
      (fn as ReturnType<typeof vi.fn>).mockReturnValue(chainable);
    });
  });

  // ── RPC returns array (RETURNS TABLE) — must extract first row ──
  it('autoCreateWorkspaceAndSnapshot extracts first row from array response', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ workspace_id: 'ws-1', snapshot_id: 'snap-1', snapshot_version: 1 }],
      error: null,
    });

    const result = await autoCreateWorkspaceAndSnapshot('inst-1');

    expect(mockRpc).toHaveBeenCalledWith('auto_create_workspace_and_snapshot', {
      p_assessment_instance_id: 'inst-1',
    });
    expect(result.workspace_id).toBe('ws-1');
    expect(result.snapshot_id).toBe('snap-1');
    expect(result.snapshot_version).toBe(1);
  });

  it('autoCreateWorkspaceAndSnapshot throws if RPC returns error', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Assessment must be submitted' },
    });

    await expect(autoCreateWorkspaceAndSnapshot('inst-1')).rejects.toThrow(
      'Assessment must be submitted'
    );
  });

  it('autoCreateWorkspaceAndSnapshot throws if workspace_id missing from response', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ workspace_id: null, snapshot_id: 'snap-1', snapshot_version: 1 }],
      error: null,
    });

    await expect(autoCreateWorkspaceAndSnapshot('inst-1')).rejects.toThrow(
      'workspace or snapshot missing'
    );
  });

  it('autoCreateWorkspaceAndSnapshot throws if snapshot_id missing from response', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ workspace_id: 'ws-1', snapshot_id: null, snapshot_version: 1 }],
      error: null,
    });

    await expect(autoCreateWorkspaceAndSnapshot('inst-1')).rejects.toThrow(
      'workspace or snapshot missing'
    );
  });

  // ── generateStrategyReport calls auto-create BEFORE createGeneration ──
  it('generateStrategyReport calls autoCreateWorkspaceAndSnapshot before createGeneration', async () => {
    // RPC for auto-create returns array
    mockRpc.mockResolvedValueOnce({
      data: [{ workspace_id: 'ws-1', snapshot_id: 'snap-1', snapshot_version: 1 }],
      error: null,
    });

    // createGeneration: snapshot lookup
    chainable.maybeSingle
      .mockResolvedValueOnce({ data: { snapshot_version: 1, completeness_level: 'sufficient' }, error: null })
      // active generation check
      .mockResolvedValueOnce({ data: null, error: null });

    // createGeneration insert
    chainable.single.mockResolvedValueOnce({
      data: { id: 'gen-1', workspace_id: 'ws-1', snapshot_id: 'snap-1', status: 'queued' },
      error: null,
    });

    // fetchGenerationById
    chainable.maybeSingle.mockResolvedValueOnce({
      data: { id: 'gen-1', workspace_id: 'ws-1', status: 'draft_generated', output_json: {} },
      error: null,
    });

    // Mock fetch for edge function invocation
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ generation_id: 'gen-1', status: 'draft_generated' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await generateStrategyReport('inst-1', 'user-1');

    // Verify auto-create was called first
    expect(mockRpc).toHaveBeenCalledWith('auto_create_workspace_and_snapshot', {
      p_assessment_instance_id: 'inst-1',
    });

    // Verify createGeneration received the workspace_id and snapshot_id from auto-create
    expect(chainable.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace_id: 'ws-1',
        snapshot_id: 'snap-1',
      })
    );

    // Verify edge function was invoked with correct IDs
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/generate-strategy-poc'),
      expect.objectContaining({
        body: expect.stringContaining('"workspace_id":"ws-1"'),
      })
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"snapshot_id":"snap-1"'),
      })
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"generation_id":"gen-1"'),
      })
    );

    expect(result.id).toBe('gen-1');
    vi.unstubAllGlobals();
  });

  // ── No workspaceId prop required — only assessmentInstanceId ──
  it('generateStrategyReport works with only assessmentInstanceId and createdBy', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ workspace_id: 'ws-auto', snapshot_id: 'snap-auto', snapshot_version: 1 }],
      error: null,
    });

    chainable.maybeSingle
      .mockResolvedValueOnce({ data: { snapshot_version: 1, completeness_level: 'sufficient' }, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: 'gen-2', status: 'draft_generated' }, error: null });

    chainable.single.mockResolvedValueOnce({
      data: { id: 'gen-2', workspace_id: 'ws-auto', snapshot_id: 'snap-auto', status: 'queued' },
      error: null,
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }));

    const result = await generateStrategyReport('inst-2', 'user-2');

    expect(result.id).toBe('gen-2');
    vi.unstubAllGlobals();
  });

  // ── Missing assessmentInstanceId fails safely ──
  it('validateGenerationInput rejects missing workspace_id', () => {
    const error = validateGenerationInput({
      workspace_id: '',
      snapshot_id: 'snap-1',
      model_name: 'gpt-4o',
      prompt_version: 'strategy-poc-v3',
      created_by: 'user-1',
    });
    expect(error).toBe('Workspace ID is required');
  });

  it('validateGenerationInput rejects missing snapshot_id', () => {
    const error = validateGenerationInput({
      workspace_id: 'ws-1',
      snapshot_id: '',
      model_name: 'gpt-4o',
      prompt_version: 'strategy-poc-v3',
      created_by: 'user-1',
    });
    expect(error).toBe('Snapshot ID is required');
  });

  // ── Duplicate active generation blocked ──
  it('createGeneration blocks duplicate active generation for same snapshot', async () => {
    chainable.maybeSingle
      .mockResolvedValueOnce({ data: { snapshot_version: 1, completeness_level: 'sufficient' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'existing', status: 'queued', prompt_version: 'strategy-poc-v3' }, error: null });

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

  // ── No manually created workspace required ──
  it('autoCreateWorkspaceAndSnapshot does not require pre-existing workspace', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ workspace_id: 'ws-new', snapshot_id: 'snap-new', snapshot_version: 1 }],
      error: null,
    });

    const result = await autoCreateWorkspaceAndSnapshot('inst-new');

    // Only one RPC call — no separate workspace creation needed
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(result.workspace_id).toBe('ws-new');
  });
});

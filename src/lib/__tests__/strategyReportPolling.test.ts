import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AnalysisGenerationRow } from '../../lib/database.types';

// Mock the service functions
const { mockFetchGenerationById, mockFetchGenerationsForAssessmentInstance, mockGenerateStrategyReport } = vi.hoisted(() => ({
  mockFetchGenerationById: vi.fn(),
  mockFetchGenerationsForAssessmentInstance: vi.fn(),
  mockGenerateStrategyReport: vi.fn(),
}));

vi.mock('../../services/aiGenerations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/aiGenerations')>();
  return {
    ...actual,
    fetchGenerationById: mockFetchGenerationById,
    fetchGenerationsForAssessmentInstance: mockFetchGenerationsForAssessmentInstance,
    generateStrategyReport: mockGenerateStrategyReport,
  };
});

vi.mock('../../lib/featureFlags', () => ({
  FEATURE_FLAGS: { ENABLE_AI_ANALYSIS: true, ENABLE_PROPEL_STRATEGY_REVIEW: false },
  isFeatureEnabled: () => true,
}));

vi.mock('../../lib/logger', () => ({ logDbError: vi.fn() }));

import {
  fetchGenerationById,
  fetchGenerationsForAssessmentInstance,
  generateStrategyReport,
  isGenerationReadOnly,
  GENERATION_STATUS_LABELS,
} from '../../services/aiGenerations';

function makeGen(overrides: Partial<AnalysisGenerationRow> = {}): AnalysisGenerationRow {
  return {
    id: 'gen-1',
    workspace_id: 'ws-1',
    snapshot_id: 'snap-1',
    generation_type: 'strategy_poc',
    status: 'queued',
    model_name: 'gpt-4o',
    prompt_version: 'strategy-poc-v3',
    input_snapshot_version: 1,
    output_json: null,
    original_output_json: null,
    reviewed_output_json: null,
    review_status: null,
    rejection_reason: null,
    error_message: null,
    input_tokens: null,
    output_tokens: null,
    total_tokens: null,
    retrieval_metadata: null,
    knowledge_enabled: false,
    created_by: 'user-1',
    reviewed_by: null,
    reviewed_at: null,
    created_at: '2026-07-22T00:00:00Z',
    ...overrides,
  };
}

const POLL_INTERVAL = 4000;
const TERMINAL_STATUSES = new Set(['draft_generated', 'approved', 'failed', 'rejected']);

// Pure polling controller — extracted from StrategyReportSection for testability.
// This mirrors the exact state machine logic without React rendering.
type PollingState = {
  generations: AnalysisGenerationRow[];
  generating: boolean;
  error: string | null;
  pollRef: ReturnType<typeof setInterval> | null;
  pollingGenId: string | null;
};

function createPollingController() {
  const state: PollingState = {
    generations: [],
    generating: false,
    error: null,
    pollRef: null,
    pollingGenId: null,
  };

  function clearPolling() {
    if (state.pollRef) {
      clearInterval(state.pollRef);
      state.pollRef = null;
    }
    state.pollingGenId = null;
  }

  function startPolling(generationId: string) {
    if (state.pollingGenId === generationId && state.pollRef) return;
    clearPolling();
    state.pollingGenId = generationId;

    state.pollRef = setInterval(async () => {
      try {
        const gen = await fetchGenerationById(generationId);
        if (!gen) {
          clearPolling();
          state.generating = false;
          state.error = 'Generation not found. Please try again.';
          return;
        }
        const idx = state.generations.findIndex(g => g.id === generationId);
        if (idx === -1) {
          state.generations = [gen, ...state.generations];
        } else {
          const next = [...state.generations];
          next[idx] = gen;
          state.generations = next;
        }
        if (TERMINAL_STATUSES.has(gen.status)) {
          clearPolling();
          state.generating = false;
        }
      } catch {
        // Keep polling on network errors
      }
    }, POLL_INTERVAL);
  }

  async function load(assessmentInstanceId: string) {
    if (!assessmentInstanceId) return;
    try {
      const gens = await fetchGenerationsForAssessmentInstance(assessmentInstanceId);
      state.generations = gens;
      const latest = gens[0];
      if (latest && (latest.status === 'queued' || latest.status === 'generating')) {
        state.generating = true;
        startPolling(latest.id);
      } else {
        state.generating = false;
      }
    } catch {
      state.error = 'Failed to load.';
    }
  }

  async function handleGenerate(assessmentInstanceId: string, _userId: string) {
    if (state.generating) return;
    state.generating = true;
    state.error = null;
    try {
      const result = await generateStrategyReport(assessmentInstanceId, _userId);
      const gen = await fetchGenerationById(result.id);
      if (gen) {
        const idx = state.generations.findIndex(g => g.id === gen.id);
        if (idx === -1) {
          state.generations = [gen, ...state.generations];
        } else {
          const next = [...state.generations];
          next[idx] = gen;
          state.generations = next;
        }
        if (TERMINAL_STATUSES.has(gen.status)) {
          state.generating = false;
        } else {
          startPolling(gen.id);
        }
      } else {
        startPolling(result.id);
      }
    } catch (err) {
      try {
        const gens = await fetchGenerationsForAssessmentInstance(assessmentInstanceId);
        const latest = gens[0];
        if (latest && !TERMINAL_STATUSES.has(latest.status)) {
          state.generations = gens;
          startPolling(latest.id);
        } else if (latest && latest.status === 'draft_generated') {
          state.generations = gens;
          state.generating = false;
        } else if (latest && latest.status === 'failed') {
          state.generations = gens;
          state.generating = false;
          state.error = latest.error_message ?? 'Generation failed.';
        } else {
          state.generating = false;
          state.error = (err as Error).message;
        }
      } catch {
        state.generating = false;
        state.error = (err as Error).message;
      }
    }
  }

  return { state, clearPolling, startPolling, load, handleGenerate };
}

describe('Strategy Report polling — stale state fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 1. Polling begins after generation creation
  it('starts polling after generation creation', async () => {
    mockFetchGenerationsForAssessmentInstance.mockResolvedValue([]);
    mockGenerateStrategyReport.mockResolvedValue(makeGen({ id: 'gen-new', status: 'queued' }));
    mockFetchGenerationById.mockResolvedValue(makeGen({ id: 'gen-new', status: 'queued' }));

    const ctrl = createPollingController();

    await ctrl.handleGenerate('inst-1', 'user-1');

    expect(ctrl.state.generating).toBe(true);
    expect(ctrl.state.pollRef).not.toBeNull();
    expect(ctrl.state.pollingGenId).toBe('gen-new');
    expect(fetchGenerationById).toHaveBeenCalledWith('gen-new');

    // Advance past one poll interval
    mockFetchGenerationById.mockResolvedValue(makeGen({ id: 'gen-new', status: 'generating' }));
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL + 100);

    expect(fetchGenerationById).toHaveBeenCalledTimes(2);
    ctrl.clearPolling();
  });

  // 2. Exact generation ID is polled
  it('polls the exact generation ID, not a stale one', async () => {
    mockFetchGenerationsForAssessmentInstance.mockResolvedValue([]);
    mockGenerateStrategyReport.mockResolvedValue(makeGen({ id: 'gen-exact', status: 'queued' }));
    mockFetchGenerationById.mockResolvedValue(makeGen({ id: 'gen-exact', status: 'queued' }));

    const ctrl = createPollingController();
    await ctrl.handleGenerate('inst-1', 'user-1');

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL + 100);

    for (const call of mockFetchGenerationById.mock.calls) {
      expect(call[0]).toBe('gen-exact');
    }
    ctrl.clearPolling();
  });

  // 3. draft_generated updates the state without navigation
  it('updates generations state to draft_generated without navigation', async () => {
    mockFetchGenerationsForAssessmentInstance.mockResolvedValue([]);
    mockGenerateStrategyReport.mockResolvedValue(makeGen({ id: 'gen-1', status: 'queued' }));
    mockFetchGenerationById.mockResolvedValue(makeGen({ id: 'gen-1', status: 'queued' }));

    const ctrl = createPollingController();
    await ctrl.handleGenerate('inst-1', 'user-1');

    expect(ctrl.state.generating).toBe(true);

    mockFetchGenerationById.mockResolvedValue(makeGen({ id: 'gen-1', status: 'draft_generated', output_json: { executive_summary: 'done' } }));
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL + 100);

    expect(ctrl.state.generations[0].status).toBe('draft_generated');
    expect(ctrl.state.generating).toBe(false);
    expect(ctrl.state.pollRef).toBeNull();
  });

  // 4. Loading state clears automatically
  it('clears generating state automatically on terminal status', async () => {
    mockFetchGenerationsForAssessmentInstance.mockResolvedValue([]);
    mockGenerateStrategyReport.mockResolvedValue(makeGen({ id: 'gen-1', status: 'queued' }));
    mockFetchGenerationById.mockResolvedValue(makeGen({ id: 'gen-1', status: 'queued' }));

    const ctrl = createPollingController();
    await ctrl.handleGenerate('inst-1', 'user-1');

    expect(ctrl.state.generating).toBe(true);

    mockFetchGenerationById.mockResolvedValue(makeGen({ id: 'gen-1', status: 'approved' }));
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL + 100);

    expect(ctrl.state.generating).toBe(false);
    expect(ctrl.state.pollRef).toBeNull();
  });

  // 5. Page reload resumes polling for queued/generating rows
  it('resumes polling on page load when generation is queued', async () => {
    mockFetchGenerationsForAssessmentInstance.mockResolvedValue([
      makeGen({ id: 'gen-existing', status: 'queued' }),
    ]);
    mockFetchGenerationById.mockResolvedValue(makeGen({ id: 'gen-existing', status: 'queued' }));

    const ctrl = createPollingController();
    await ctrl.load('inst-1');

    expect(ctrl.state.generating).toBe(true);
    expect(ctrl.state.generations[0].id).toBe('gen-existing');
    expect(ctrl.state.pollRef).not.toBeNull();

    mockFetchGenerationById.mockResolvedValue(makeGen({ id: 'gen-existing', status: 'generating' }));
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL + 100);

    expect(fetchGenerationById).toHaveBeenCalledWith('gen-existing');
    ctrl.clearPolling();
  });

  it('does not start polling on page load when generation is draft_generated', async () => {
    mockFetchGenerationsForAssessmentInstance.mockResolvedValue([
      makeGen({ id: 'gen-done', status: 'draft_generated' }),
    ]);

    const ctrl = createPollingController();
    await ctrl.load('inst-1');

    expect(ctrl.state.generating).toBe(false);
    expect(fetchGenerationById).not.toHaveBeenCalled();
    expect(ctrl.state.pollRef).toBeNull();
  });

  it('does not start polling on page load when generation is approved', async () => {
    mockFetchGenerationsForAssessmentInstance.mockResolvedValue([
      makeGen({ id: 'gen-approved', status: 'approved' }),
    ]);

    const ctrl = createPollingController();
    await ctrl.load('inst-1');

    expect(ctrl.state.generating).toBe(false);
    expect(ctrl.state.pollRef).toBeNull();
  });

  it('does not start polling on page load when generation is failed', async () => {
    mockFetchGenerationsForAssessmentInstance.mockResolvedValue([
      makeGen({ id: 'gen-failed', status: 'failed' }),
    ]);

    const ctrl = createPollingController();
    await ctrl.load('inst-1');

    expect(ctrl.state.generating).toBe(false);
    expect(ctrl.state.pollRef).toBeNull();
  });

  // 6. Request timeout still recovers from database status
  it('recovers from Edge Function timeout by checking database status', async () => {
    mockFetchGenerationsForAssessmentInstance.mockResolvedValue([]);
    mockGenerateStrategyReport.mockRejectedValue(new Error('Edge Function timed out'));

    mockFetchGenerationsForAssessmentInstance
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeGen({ id: 'gen-recovered', status: 'queued' })]);

    mockFetchGenerationById.mockResolvedValue(makeGen({ id: 'gen-recovered', status: 'queued' }));

    const ctrl = createPollingController();
    await ctrl.handleGenerate('inst-1', 'user-1');

    expect(ctrl.state.generating).toBe(true);
    expect(ctrl.state.generations[0]?.id).toBe('gen-recovered');
    expect(ctrl.state.pollRef).not.toBeNull();
    ctrl.clearPolling();
  });

  it('recovers from Edge Function timeout when backend already completed', async () => {
    mockFetchGenerationsForAssessmentInstance.mockResolvedValue([]);
    mockGenerateStrategyReport.mockRejectedValue(new Error('Network error'));

    mockFetchGenerationsForAssessmentInstance
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeGen({ id: 'gen-done', status: 'draft_generated', output_json: { summary: 'done' } })]);

    const ctrl = createPollingController();
    await ctrl.handleGenerate('inst-1', 'user-1');

    expect(ctrl.state.generating).toBe(false);
    expect(ctrl.state.generations[0]?.status).toBe('draft_generated');
    expect(ctrl.state.pollRef).toBeNull();
  });

  it('shows failure only when DB status is failed', async () => {
    mockFetchGenerationsForAssessmentInstance.mockResolvedValue([]);
    mockGenerateStrategyReport.mockRejectedValue(new Error('Request failed'));

    mockFetchGenerationsForAssessmentInstance
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeGen({ id: 'gen-fail', status: 'failed', error_message: 'Backend error' })]);

    const ctrl = createPollingController();
    await ctrl.handleGenerate('inst-1', 'user-1');

    expect(ctrl.state.generating).toBe(false);
    expect(ctrl.state.error).toBe('Backend error');
    expect(ctrl.state.pollRef).toBeNull();
  });

  // 7. Terminal status stops polling
  it('stops polling when status becomes draft_generated', async () => {
    mockFetchGenerationsForAssessmentInstance.mockResolvedValue([]);
    mockGenerateStrategyReport.mockResolvedValue(makeGen({ id: 'gen-1', status: 'queued' }));
    mockFetchGenerationById.mockResolvedValue(makeGen({ id: 'gen-1', status: 'queued' }));

    const ctrl = createPollingController();
    await ctrl.handleGenerate('inst-1', 'user-1');

    const pollCountAfterGenerate = mockFetchGenerationById.mock.calls.length;

    mockFetchGenerationById.mockResolvedValue(makeGen({ id: 'gen-1', status: 'draft_generated' }));
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL + 100);

    const pollCountAfterTerminal = mockFetchGenerationById.mock.calls.length;
    expect(pollCountAfterTerminal).toBe(pollCountAfterGenerate + 1);

    // Advance more — polling should have stopped
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL * 3);

    expect(mockFetchGenerationById.mock.calls.length).toBe(pollCountAfterTerminal);
  });

  it('stops polling when status becomes failed', async () => {
    mockFetchGenerationsForAssessmentInstance.mockResolvedValue([]);
    mockGenerateStrategyReport.mockResolvedValue(makeGen({ id: 'gen-1', status: 'queued' }));
    mockFetchGenerationById.mockResolvedValue(makeGen({ id: 'gen-1', status: 'queued' }));

    const ctrl = createPollingController();
    await ctrl.handleGenerate('inst-1', 'user-1');

    mockFetchGenerationById.mockResolvedValue(makeGen({ id: 'gen-1', status: 'failed', error_message: 'AI error' }));
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL + 100);

    expect(ctrl.state.generating).toBe(false);

    const pollCount = mockFetchGenerationById.mock.calls.length;
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL * 3);
    expect(mockFetchGenerationById.mock.calls.length).toBe(pollCount);
  });

  it('stops polling when status becomes approved', async () => {
    mockFetchGenerationsForAssessmentInstance.mockResolvedValue([]);
    mockGenerateStrategyReport.mockResolvedValue(makeGen({ id: 'gen-1', status: 'queued' }));
    mockFetchGenerationById.mockResolvedValue(makeGen({ id: 'gen-1', status: 'queued' }));

    const ctrl = createPollingController();
    await ctrl.handleGenerate('inst-1', 'user-1');

    mockFetchGenerationById.mockResolvedValue(makeGen({ id: 'gen-1', status: 'approved' }));
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL + 100);

    expect(ctrl.state.generating).toBe(false);

    const pollCount = mockFetchGenerationById.mock.calls.length;
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL * 3);
    expect(mockFetchGenerationById.mock.calls.length).toBe(pollCount);
  });

  // 8. Unmount clears polling
  it('clears polling interval on unmount', async () => {
    mockFetchGenerationsForAssessmentInstance.mockResolvedValue([
      makeGen({ id: 'gen-active', status: 'queued' }),
    ]);
    mockFetchGenerationById.mockResolvedValue(makeGen({ id: 'gen-active', status: 'queued' }));

    const ctrl = createPollingController();
    await ctrl.load('inst-1');

    const pollCountBefore = mockFetchGenerationById.mock.calls.length;
    ctrl.clearPolling();

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL * 5);

    expect(mockFetchGenerationById.mock.calls.length).toBe(pollCountBefore);
  });

  // 9. Duplicate polling intervals are not created
  it('does not create duplicate polling intervals for the same generation', async () => {
    mockFetchGenerationsForAssessmentInstance.mockResolvedValue([]);
    mockGenerateStrategyReport.mockResolvedValue(makeGen({ id: 'gen-1', status: 'queued' }));
    mockFetchGenerationById.mockResolvedValue(makeGen({ id: 'gen-1', status: 'queued' }));

    const ctrl = createPollingController();
    await ctrl.handleGenerate('inst-1', 'user-1');

    // Try to start polling again for the same generation
    ctrl.startPolling('gen-1');

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL + 100);

    // Should only have one poll call (not doubled)
    expect(mockFetchGenerationById.mock.calls.length).toBe(2);
  });

  it('does not start duplicate generation from double click', async () => {
    mockFetchGenerationsForAssessmentInstance.mockResolvedValue([]);
    mockGenerateStrategyReport.mockResolvedValue(makeGen({ id: 'gen-1', status: 'queued' }));
    mockFetchGenerationById.mockResolvedValue(makeGen({ id: 'gen-1', status: 'queued' }));

    const ctrl = createPollingController();

    // Double-click: call handleGenerate twice in quick succession
    await Promise.all([
      ctrl.handleGenerate('inst-1', 'user-1'),
      ctrl.handleGenerate('inst-1', 'user-1'),
    ]);

    // Only one generateStrategyReport call should have been made
    expect(mockGenerateStrategyReport).toHaveBeenCalledTimes(1);
    ctrl.clearPolling();
  });

  // 10. Latest generation state is not stale
  it('latest generation state reflects the most recent poll result', async () => {
    mockFetchGenerationsForAssessmentInstance.mockResolvedValue([]);
    mockGenerateStrategyReport.mockResolvedValue(makeGen({ id: 'gen-1', status: 'queued' }));
    mockFetchGenerationById.mockResolvedValue(makeGen({ id: 'gen-1', status: 'queued' }));

    const ctrl = createPollingController();
    await ctrl.handleGenerate('inst-1', 'user-1');

    // Poll 1: generating
    mockFetchGenerationById.mockResolvedValue(makeGen({ id: 'gen-1', status: 'generating' }));
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL + 100);
    expect(ctrl.state.generations[0].status).toBe('generating');

    // Poll 2: draft_generated
    mockFetchGenerationById.mockResolvedValue(makeGen({ id: 'gen-1', status: 'draft_generated', output_json: { summary: 'final' } }));
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL + 100);
    expect(ctrl.state.generations[0].status).toBe('draft_generated');
    expect(ctrl.state.generating).toBe(false);
  });

  it('handles generation not found during polling', async () => {
    mockFetchGenerationsForAssessmentInstance.mockResolvedValue([]);
    mockGenerateStrategyReport.mockResolvedValue(makeGen({ id: 'gen-1', status: 'queued' }));
    mockFetchGenerationById.mockResolvedValue(makeGen({ id: 'gen-1', status: 'queued' }));

    const ctrl = createPollingController();
    await ctrl.handleGenerate('inst-1', 'user-1');

    // Generation disappears from DB
    mockFetchGenerationById.mockResolvedValue(null);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL + 100);

    expect(ctrl.state.generating).toBe(false);
    expect(ctrl.state.error).toContain('not found');
    expect(ctrl.state.pollRef).toBeNull();
  });

  it('continues polling through transient network errors', async () => {
    mockFetchGenerationsForAssessmentInstance.mockResolvedValue([]);
    mockGenerateStrategyReport.mockResolvedValue(makeGen({ id: 'gen-1', status: 'queued' }));
    mockFetchGenerationById.mockResolvedValue(makeGen({ id: 'gen-1', status: 'queued' }));

    const ctrl = createPollingController();
    await ctrl.handleGenerate('inst-1', 'user-1');

    // Poll 1: network error
    mockFetchGenerationById.mockRejectedValue(new Error('Network error'));
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL + 100);
    expect(ctrl.state.generating).toBe(true);
    expect(ctrl.state.pollRef).not.toBeNull();

    // Poll 2: succeeds with terminal status
    mockFetchGenerationById.mockResolvedValue(makeGen({ id: 'gen-1', status: 'draft_generated' }));
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL + 100);
    expect(ctrl.state.generating).toBe(false);
    expect(ctrl.state.generations[0].status).toBe('draft_generated');
  });

  // 11. Status labels and read-only behavior
  it('queued and generating both show "Generating" label', () => {
    expect(GENERATION_STATUS_LABELS.queued).toBe('Generating');
    expect(GENERATION_STATUS_LABELS.generating).toBe('Generating');
  });

  it('draft_generated is not read-only', () => {
    expect(isGenerationReadOnly('draft_generated')).toBe(false);
  });

  it('approved is read-only', () => {
    expect(isGenerationReadOnly('approved')).toBe(true);
  });
});

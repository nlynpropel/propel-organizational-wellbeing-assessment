import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateGenerationInput,
  canCreateGeneration,
  GENERATION_TYPES,
  GENERATION_STATUSES,
  type CreateGenerationInput,
} from '../aiGenerations';
import type { AnalysisInputSnapshotRow } from '../../lib/database.types';

// Mock supabase
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();
const mockInsert = vi.fn();
const mockSingle = vi.fn();
const mockOrder = vi.fn();
const mockDelete = vi.fn();
const mockUpdate = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
      insert: mockInsert,
      single: mockSingle,
      order: mockOrder,
      delete: mockDelete,
      update: mockUpdate,
    })),
  },
}));

vi.mock('../../lib/logger', () => ({
  logDbError: vi.fn(),
}));

// Mock feature flags — controlled per-test
vi.mock('../../lib/featureFlags', () => ({
  isFeatureEnabled: vi.fn(),
  FEATURE_FLAGS: {
    ENABLE_AI_ANALYSIS: false,
    ENABLE_STRATEGY_ANALYSIS: false,
    ENABLE_INCENTIVE_DESIGN: false,
    ENABLE_ORGANIZATION_PLAYBOOK: false,
    ENABLE_CUSTOM_ASSESSMENTS: false,
    ENABLE_CUSTOM_ASSESSMENT_BUILDER: false,
    ENABLE_CUSTOM_ASSESSMENT_SENDING: false,
    ENABLE_PDF_REPORTS: false,
    ENABLE_PROPEL_STRATEGY_REVIEW: false,
  },
}));

import { isFeatureEnabled } from '../../lib/featureFlags';
import { createGeneration } from '../aiGenerations';

const validInput: CreateGenerationInput = {
  workspace_id: 'ws-1',
  snapshot_id: 'snap-1',
  model_name: 'gpt-4o',
  prompt_version: 'v1',
  created_by: 'user-1',
};

const sufficientSnapshot = {
  id: 'snap-1',
  snapshot_version: 1,
  completeness_level: 'sufficient',
};

const notReadySnapshot = {
  id: 'snap-1',
  snapshot_version: 1,
  completeness_level: 'not_ready',
};

function setupSnapshotMock(snapshot: Record<string, unknown> | null) {
  mockSelect.mockReturnValue({
    eq: mockEq.mockReturnValue({
      maybeSingle: mockMaybeSingle.mockResolvedValue({
        data: snapshot,
        error: null,
      }),
    }),
  });
}

function setupInsertMock(row: Record<string, unknown>) {
  mockInsert.mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: mockSingle.mockResolvedValue({ data: row, error: null }),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  (isFeatureEnabled as ReturnType<typeof vi.fn>).mockReturnValue(false);
});

describe('aiGenerations — constants', () => {
  it('exposes strategy_poc as the only generation type', () => {
    expect(GENERATION_TYPES).toEqual(['strategy_poc']);
  });

  it('exposes all six statuses', () => {
    expect(GENERATION_STATUSES).toEqual([
      'queued',
      'generating',
      'draft_generated',
      'failed',
      'approved',
      'rejected',
    ]);
  });
});

describe('aiGenerations — input validation', () => {
  it('accepts a valid generation input', () => {
    expect(validateGenerationInput(validInput)).toBeNull();
  });

  it('rejects missing workspace_id', () => {
    expect(validateGenerationInput({ ...validInput, workspace_id: '' })).toBe(
      'Workspace ID is required'
    );
  });

  it('rejects missing snapshot_id', () => {
    expect(validateGenerationInput({ ...validInput, snapshot_id: '' })).toBe(
      'Snapshot ID is required'
    );
  });

  it('rejects empty model_name', () => {
    expect(validateGenerationInput({ ...validInput, model_name: '' })).toBe(
      'Model name is required'
    );
  });

  it('rejects empty prompt_version', () => {
    expect(validateGenerationInput({ ...validInput, prompt_version: ' ' })).toBe(
      'Prompt version is required'
    );
  });

  it('rejects missing created_by', () => {
    expect(validateGenerationInput({ ...validInput, created_by: '' })).toBe(
      'Created by is required'
    );
  });

  it('rejects invalid generation_type', () => {
    expect(
      validateGenerationInput({
        ...validInput,
        generation_type: 'invalid_type' as never,
      })
    ).toBe('Invalid generation type');
  });
});

describe('aiGenerations — feature flag gating', () => {
  it('blocks createGeneration when ENABLE_AI_ANALYSIS is false', async () => {
    (isFeatureEnabled as ReturnType<typeof vi.fn>).mockReturnValue(false);
    setupSnapshotMock(sufficientSnapshot);

    await expect(createGeneration(validInput)).rejects.toThrow(
      'AI analysis is not enabled'
    );
    // Verify no DB insert was attempted
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('allows createGeneration when ENABLE_AI_ANALYSIS is true and snapshot is sufficient', async () => {
    (isFeatureEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    setupSnapshotMock(sufficientSnapshot);
    const generatedRow = {
      id: 'gen-1',
      workspace_id: 'ws-1',
      snapshot_id: 'snap-1',
      generation_type: 'strategy_poc',
      status: 'queued',
      model_name: 'gpt-4o',
      prompt_version: 'v1',
      input_snapshot_version: 1,
      output_json: null,
      error_message: null,
      created_by: 'user-1',
      reviewed_by: null,
      reviewed_at: null,
      created_at: '2026-01-01T00:00:00Z',
    };
    setupInsertMock(generatedRow);

    const result = await createGeneration(validInput);
    expect(result.status).toBe('queued');
    expect(result.id).toBe('gen-1');
    expect(mockInsert).toHaveBeenCalled();
  });

  it('blocks createGeneration when snapshot readiness is not_ready even with flag enabled', async () => {
    (isFeatureEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    setupSnapshotMock(notReadySnapshot);

    await expect(createGeneration(validInput)).rejects.toThrow(
      'Snapshot readiness is below sufficient'
    );
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('blocks createGeneration when snapshot is not found even with flag enabled', async () => {
    (isFeatureEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    setupSnapshotMock(null);

    await expect(createGeneration(validInput)).rejects.toThrow(
      'Snapshot not found'
    );
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

describe('aiGenerations — canCreateGeneration (UI gating)', () => {
  const baseSnapshot = {
    id: 'snap-1',
    workspace_id: 'ws-1',
    snapshot_version: 1,
    snapshot_data: {},
    completeness_level: 'sufficient',
    created_at: '2026-01-01T00:00:00Z',
  } as unknown as AnalysisInputSnapshotRow;

  it('returns false when feature flag is disabled regardless of snapshot', () => {
    (isFeatureEnabled as ReturnType<typeof vi.fn>).mockReturnValue(false);
    expect(canCreateGeneration(baseSnapshot)).toBe(false);
  });

  it('returns true when flag is enabled and snapshot is sufficient', () => {
    (isFeatureEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    expect(canCreateGeneration(baseSnapshot)).toBe(true);
  });

  it('returns true when flag is enabled and snapshot is strong', () => {
    (isFeatureEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    expect(
      canCreateGeneration({ ...baseSnapshot, completeness_level: 'strong' } as AnalysisInputSnapshotRow)
    ).toBe(true);
  });

  it('returns false when flag is enabled but snapshot is not_ready', () => {
    (isFeatureEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    expect(
      canCreateGeneration({ ...baseSnapshot, completeness_level: 'not_ready' } as AnalysisInputSnapshotRow)
    ).toBe(false);
  });

  it('returns false when flag is enabled but snapshot is limited', () => {
    (isFeatureEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    expect(
      canCreateGeneration({ ...baseSnapshot, completeness_level: 'limited' } as AnalysisInputSnapshotRow)
    ).toBe(false);
  });

  it('returns false when flag is enabled but snapshot is null', () => {
    (isFeatureEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    expect(canCreateGeneration(null)).toBe(false);
  });
});

describe('aiGenerations — unauthorized user simulation', () => {
  it('would be blocked by RLS even with flag enabled (insert fails with RLS error)', async () => {
    // This simulates what happens when an unauthorized user (e.g. employer_admin)
    // tries to insert: the RLS policy denies it because has_capability() returns false
    // (no generate_ai_analysis in their role's capabilities).
    // We simulate this by having the insert return an RLS error.
    (isFeatureEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    setupSnapshotMock(sufficientSnapshot);
    mockInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: mockSingle.mockResolvedValue({
          data: null,
          error: { code: '42501', message: 'new row violates row-level security policy' },
        }),
      }),
    });

    await expect(createGeneration(validInput)).rejects.toThrow();
    expect(mockInsert).toHaveBeenCalled();
  });
});

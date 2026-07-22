import { describe, it, expect } from 'vitest';
import {
  GENERATION_TYPES,
  GENERATION_STATUSES,
  validateGenerationInput,
  canCreateGeneration,
  type CreateGenerationInput,
} from '../../services/aiGenerations';
import type { AnalysisInputSnapshotRow } from '../../lib/database.types';

const validInput: CreateGenerationInput = {
  workspace_id: 'ws-1',
  snapshot_id: 'snap-1',
  model_name: 'gpt-4o',
  prompt_version: 'v1',
  created_by: 'user-1',
};

describe('aiGenerations service', () => {
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

  describe('canCreateGeneration', () => {
    const baseSnapshot = {
      id: 'snap-1',
      workspace_id: 'ws-1',
      snapshot_version: 1,
      snapshot_data: {},
      completeness_level: 'sufficient',
      created_at: '2026-01-01T00:00:00Z',
    } as unknown as AnalysisInputSnapshotRow;

    it('allows generation for sufficient snapshot', () => {
      expect(canCreateGeneration(baseSnapshot)).toBe(true);
    });

    it('allows generation for strong snapshot', () => {
      expect(
        canCreateGeneration({ ...baseSnapshot, completeness_level: 'strong' } as AnalysisInputSnapshotRow)
      ).toBe(true);
    });

    it('denies generation for not_ready snapshot', () => {
      expect(
        canCreateGeneration({ ...baseSnapshot, completeness_level: 'not_ready' } as AnalysisInputSnapshotRow)
      ).toBe(false);
    });

    it('denies generation for limited snapshot', () => {
      expect(
        canCreateGeneration({ ...baseSnapshot, completeness_level: 'limited' } as AnalysisInputSnapshotRow)
      ).toBe(false);
    });

    it('denies generation for null snapshot', () => {
      expect(canCreateGeneration(null)).toBe(false);
    });
  });
});

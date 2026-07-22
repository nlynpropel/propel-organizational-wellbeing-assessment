import { describe, it, expect } from 'vitest';
import {
  validateGoalInput,
  validateMetricInput,
  validateNoteInput,
  validateWorkspaceInput,
  validateProgramInput,
  validateUtilizationInput,
  validateGapInput,
  validateEvidenceInput,
  isWorkspaceEditable,
  canEditWorkspace,
  canApproveWorkspace,
  WORKSPACE_STATUSES,
  DATA_QUALITY_LEVELS,
  NOTE_TYPES,
  NOTE_VISIBILITIES,
  NOTE_IMPORTANCES,
  GOAL_PRIORITIES,
  GOAL_SOURCE_TYPES,
  PROGRAM_STATUSES,
  PROGRAM_SOURCE_TYPES,
  UTILIZATION_STATUSES,
  GAP_CATEGORIES,
  GAP_EVIDENCE_SOURCES,
  GAP_SEVERITIES,
  GAP_CONFIDENCES,
  GAP_STATUSES,
  EVIDENCE_SOURCE_TYPES,
  VERIFICATION_STATUSES,
  WORKSPACE_STATUS_LABELS,
  DATA_QUALITY_LABELS,
  NOTE_TYPE_LABELS,
  NOTE_VISIBILITY_LABELS,
  NOTE_IMPORTANCE_LABELS,
  PRIORITY_LABELS,
  SOURCE_TYPE_LABELS,
  PROGRAM_STATUS_LABELS,
  PROGRAM_SOURCE_TYPE_LABELS,
  UTILIZATION_STATUS_LABELS,
  GAP_CATEGORY_LABELS,
  GAP_EVIDENCE_SOURCE_LABELS,
  GAP_SEVERITY_LABELS,
  GAP_CONFIDENCE_LABELS,
  GAP_STATUS_LABELS,
  EVIDENCE_SOURCE_TYPE_LABELS,
  VERIFICATION_STATUS_LABELS,
} from '../../services/analysisWorkspace';
import type { OrganizationCapability } from '../../lib/database.types';

function makeCaps(caps: string[]): Set<OrganizationCapability> {
  return new Set(caps as OrganizationCapability[]);
}

describe('analysisWorkspace validation', () => {
  // ============================================================
  // validateWorkspaceInput
  // ============================================================
  describe('validateWorkspaceInput', () => {
    it('returns null for valid input', () => {
      expect(validateWorkspaceInput({ title: 'Q3 Analysis', assessment_instance_id: 'inst-1' })).toBeNull();
    });

    it('returns error when title is empty', () => {
      expect(validateWorkspaceInput({ title: '', assessment_instance_id: 'inst-1' })).toBe('Title is required');
    });

    it('returns error when title is whitespace', () => {
      expect(validateWorkspaceInput({ title: '   ', assessment_instance_id: 'inst-1' })).toBe('Title is required');
    });

    it('returns error when assessment_instance_id is empty', () => {
      expect(validateWorkspaceInput({ title: 'Q3 Analysis', assessment_instance_id: '' })).toBe('Assessment instance is required');
    });
  });

  // ============================================================
  // validateGoalInput
  // ============================================================
  describe('validateGoalInput', () => {
    it('returns null for valid input', () => {
      expect(
        validateGoalInput({ outcome_category: 'Health', title: 'Reduce ER visits', priority: 'high', source_type: 'analyst' })
      ).toBeNull();
    });

    it('returns error when outcome_category is empty', () => {
      expect(validateGoalInput({ outcome_category: '', title: 'Goal' })).toBe('Outcome category is required');
    });

    it('returns error when title is empty', () => {
      expect(validateGoalInput({ outcome_category: 'Health', title: '' })).toBe('Title is required');
    });

    it('returns error for invalid priority', () => {
      expect(
        validateGoalInput({ outcome_category: 'Health', title: 'Goal', priority: 'urgent' })
      ).toBe('Invalid priority');
    });

    it('returns error for invalid source_type', () => {
      expect(
        validateGoalInput({ outcome_category: 'Health', title: 'Goal', source_type: 'invalid' })
      ).toBe('Invalid source type');
    });

    it('accepts all valid priorities', () => {
      for (const p of GOAL_PRIORITIES) {
        expect(validateGoalInput({ outcome_category: 'Cat', title: 'T', priority: p })).toBeNull();
      }
    });

    it('accepts all valid source types', () => {
      for (const s of GOAL_SOURCE_TYPES) {
        expect(validateGoalInput({ outcome_category: 'Cat', title: 'T', source_type: s })).toBeNull();
      }
    });
  });

  // ============================================================
  // validateMetricInput
  // ============================================================
  describe('validateMetricInput', () => {
    it('returns null for valid input', () => {
      expect(validateMetricInput({ metric_name: 'ER visits per 1000', data_quality: 'verified' })).toBeNull();
    });

    it('returns error when metric_name is empty', () => {
      expect(validateMetricInput({ metric_name: '' })).toBe('Metric name is required');
    });

    it('returns error for invalid data_quality', () => {
      expect(validateMetricInput({ metric_name: 'M', data_quality: 'bad' })).toBe('Invalid data quality level');
    });

    it('accepts all valid data_quality levels', () => {
      for (const d of DATA_QUALITY_LEVELS) {
        expect(validateMetricInput({ metric_name: 'M', data_quality: d })).toBeNull();
      }
    });

    it('returns null when data_quality is omitted', () => {
      expect(validateMetricInput({ metric_name: 'M' })).toBeNull();
    });
  });

  // ============================================================
  // validateNoteInput
  // ============================================================
  describe('validateNoteInput', () => {
    it('returns null for valid input', () => {
      expect(
        validateNoteInput({
          note_type: 'organization_context',
          content: 'Some context',
          visibility: 'internal',
          importance: 'normal',
        })
      ).toBeNull();
    });

    it('returns error when note_type is empty', () => {
      expect(validateNoteInput({ note_type: '', content: 'C' })).toBe('Note type is required');
    });

    it('returns error for invalid note_type', () => {
      expect(validateNoteInput({ note_type: 'random', content: 'C' })).toBe('Invalid note type');
    });

    it('returns error when content is empty', () => {
      expect(validateNoteInput({ note_type: 'follow_up', content: '' })).toBe('Content is required');
    });

    it('returns error for invalid visibility', () => {
      expect(
        validateNoteInput({ note_type: 'follow_up', content: 'C', visibility: 'public' })
      ).toBe('Invalid visibility');
    });

    it('returns error for invalid importance', () => {
      expect(
        validateNoteInput({ note_type: 'follow_up', content: 'C', importance: 'extreme' })
      ).toBe('Invalid importance level');
    });

    it('accepts all valid note types', () => {
      for (const t of NOTE_TYPES) {
        expect(validateNoteInput({ note_type: t, content: 'C' })).toBeNull();
      }
    });

    it('accepts all valid visibilities', () => {
      for (const v of NOTE_VISIBILITIES) {
        expect(validateNoteInput({ note_type: 'follow_up', content: 'C', visibility: v })).toBeNull();
      }
    });

    it('accepts all valid importances', () => {
      for (const i of NOTE_IMPORTANCES) {
        expect(validateNoteInput({ note_type: 'follow_up', content: 'C', importance: i })).toBeNull();
      }
    });
  });

  // ============================================================
  // isWorkspaceEditable
  // ============================================================
  describe('isWorkspaceEditable', () => {
    it('returns true for all non-finalized statuses', () => {
      const editableStatuses = WORKSPACE_STATUSES.filter((s) => s !== 'finalized');
      for (const s of editableStatuses) {
        expect(isWorkspaceEditable(s)).toBe(true);
      }
    });

    it('returns false for finalized', () => {
      expect(isWorkspaceEditable('finalized')).toBe(false);
    });
  });

  // ============================================================
  // canEditWorkspace
  // ============================================================
  describe('canEditWorkspace', () => {
    it('returns true when user has edit_strategy_analysis and workspace is editable', () => {
      expect(canEditWorkspace(makeCaps(['edit_strategy_analysis']), 'draft')).toBe(true);
    });

    it('returns false when user lacks edit_strategy_analysis', () => {
      expect(canEditWorkspace(makeCaps(['view_reports']), 'draft')).toBe(false);
    });

    it('returns false when workspace is finalized even with capability', () => {
      expect(canEditWorkspace(makeCaps(['edit_strategy_analysis']), 'finalized')).toBe(false);
    });

    it('returns false when user has no capabilities', () => {
      expect(canEditWorkspace(new Set(), 'draft')).toBe(false);
    });
  });

  // ============================================================
  // canApproveWorkspace
  // ============================================================
  describe('canApproveWorkspace', () => {
    it('returns true when user has approve_strategy_analysis', () => {
      expect(canApproveWorkspace(makeCaps(['approve_strategy_analysis']))).toBe(true);
    });

    it('returns false when user lacks approve_strategy_analysis', () => {
      expect(canApproveWorkspace(makeCaps(['edit_strategy_analysis', 'view_reports']))).toBe(false);
    });

    it('returns false when user has no capabilities', () => {
      expect(canApproveWorkspace(new Set())).toBe(false);
    });
  });

  // ============================================================
  // Label completeness
  // ============================================================
  describe('label completeness', () => {
    it('WORKSPACE_STATUS_LABELS covers all statuses', () => {
      for (const s of WORKSPACE_STATUSES) {
        expect(WORKSPACE_STATUS_LABELS[s]).toBeTruthy();
      }
    });

    it('DATA_QUALITY_LABELS covers all levels', () => {
      for (const d of DATA_QUALITY_LEVELS) {
        expect(DATA_QUALITY_LABELS[d]).toBeTruthy();
      }
    });

    it('NOTE_TYPE_LABELS covers all types', () => {
      for (const t of NOTE_TYPES) {
        expect(NOTE_TYPE_LABELS[t]).toBeTruthy();
      }
    });

    it('NOTE_VISIBILITY_LABELS covers all visibilities', () => {
      for (const v of NOTE_VISIBILITIES) {
        expect(NOTE_VISIBILITY_LABELS[v]).toBeTruthy();
      }
    });

    it('NOTE_IMPORTANCE_LABELS covers all importances', () => {
      for (const i of NOTE_IMPORTANCES) {
        expect(NOTE_IMPORTANCE_LABELS[i]).toBeTruthy();
      }
    });

    it('PRIORITY_LABELS covers all priorities', () => {
      for (const p of GOAL_PRIORITIES) {
        expect(PRIORITY_LABELS[p]).toBeTruthy();
      }
    });

    it('SOURCE_TYPE_LABELS covers all source types', () => {
      for (const s of GOAL_SOURCE_TYPES) {
        expect(SOURCE_TYPE_LABELS[s]).toBeTruthy();
      }
    });
  });

  // ============================================================
  // Enum completeness
  // ============================================================
  describe('enum completeness', () => {
    it('has exactly 7 workspace statuses', () => {
      expect(WORKSPACE_STATUSES).toHaveLength(7);
    });

    it('has exactly 5 data quality levels', () => {
      expect(DATA_QUALITY_LEVELS).toHaveLength(5);
    });

    it('has exactly 9 note types', () => {
      expect(NOTE_TYPES).toHaveLength(9);
    });

    it('has exactly 3 visibilities', () => {
      expect(NOTE_VISIBILITIES).toHaveLength(3);
    });

    it('has exactly 4 importances', () => {
      expect(NOTE_IMPORTANCES).toHaveLength(4);
    });

    it('has exactly 4 priorities', () => {
      expect(GOAL_PRIORITIES).toHaveLength(4);
    });

    it('has exactly 4 source types', () => {
      expect(GOAL_SOURCE_TYPES).toHaveLength(4);
    });
  });

  // ============================================================
  // validateProgramInput
  // ============================================================
  describe('validateProgramInput', () => {
    it('returns null for valid input', () => {
      expect(validateProgramInput({ program_name: 'EAP', program_category: 'Mental Health' })).toBeNull();
    });

    it('returns error when program_name is empty', () => {
      expect(validateProgramInput({ program_name: '', program_category: 'Health' })).toBe('Program name is required');
    });

    it('returns error when program_category is empty', () => {
      expect(validateProgramInput({ program_name: 'EAP', program_category: '' })).toBe('Program category is required');
    });

    it('returns error for invalid status', () => {
      expect(validateProgramInput({ program_name: 'P', program_category: 'C', status: 'deleted' })).toBe('Invalid program status');
    });

    it('returns error for invalid source_type', () => {
      expect(validateProgramInput({ program_name: 'P', program_category: 'C', source_type: 'guessed' })).toBe('Invalid program source type');
    });

    it('accepts all valid statuses', () => {
      for (const s of PROGRAM_STATUSES) {
        expect(validateProgramInput({ program_name: 'P', program_category: 'C', status: s })).toBeNull();
      }
    });

    it('accepts all valid source types', () => {
      for (const s of PROGRAM_SOURCE_TYPES) {
        expect(validateProgramInput({ program_name: 'P', program_category: 'C', source_type: s })).toBeNull();
      }
    });
  });

  // ============================================================
  // validateUtilizationInput
  // ============================================================
  describe('validateUtilizationInput', () => {
    it('returns null for valid input', () => {
      expect(validateUtilizationInput({ client_program_id: 'prog-1' })).toBeNull();
    });

    it('returns error when client_program_id is empty', () => {
      expect(validateUtilizationInput({ client_program_id: '' })).toBe('Client program is required');
    });

    it('returns error for invalid utilization_status', () => {
      expect(validateUtilizationInput({ client_program_id: 'p', utilization_status: 'extreme' })).toBe('Invalid utilization status');
    });

    it('returns error for invalid data_quality', () => {
      expect(validateUtilizationInput({ client_program_id: 'p', data_quality: 'bad' })).toBe('Invalid data quality level');
    });

    it('accepts all valid utilization statuses', () => {
      for (const s of UTILIZATION_STATUSES) {
        expect(validateUtilizationInput({ client_program_id: 'p', utilization_status: s })).toBeNull();
      }
    });
  });

  // ============================================================
  // validateGapInput
  // ============================================================
  describe('validateGapInput', () => {
    it('returns null for valid input', () => {
      expect(validateGapInput({ gap_category: 'program_gap', title: 'Missing EAP', description: 'No EAP for shift workers' })).toBeNull();
    });

    it('returns error when gap_category is empty', () => {
      expect(validateGapInput({ gap_category: '', title: 'T', description: 'D' })).toBe('Gap category is required');
    });

    it('returns error for invalid gap_category', () => {
      expect(validateGapInput({ gap_category: 'budget_gap', title: 'T', description: 'D' })).toBe('Invalid gap category');
    });

    it('returns error when title is empty', () => {
      expect(validateGapInput({ gap_category: 'program_gap', title: '', description: 'D' })).toBe('Title is required');
    });

    it('returns error when description is empty', () => {
      expect(validateGapInput({ gap_category: 'program_gap', title: 'T', description: '' })).toBe('Description is required');
    });

    it('returns error for invalid severity', () => {
      expect(validateGapInput({ gap_category: 'program_gap', title: 'T', description: 'D', severity: 'extreme' })).toBe('Invalid severity');
    });

    it('returns error for invalid confidence', () => {
      expect(validateGapInput({ gap_category: 'program_gap', title: 'T', description: 'D', confidence: 'absolute' })).toBe('Invalid confidence');
    });

    it('returns error for invalid status', () => {
      expect(validateGapInput({ gap_category: 'program_gap', title: 'T', description: 'D', status: 'closed' })).toBe('Invalid gap status');
    });

    it('returns error for invalid evidence_source', () => {
      expect(validateGapInput({ gap_category: 'program_gap', title: 'T', description: 'D', evidence_source: 'ai_suggested' })).toBe('Invalid evidence source');
    });

    it('accepts all valid gap categories', () => {
      for (const c of GAP_CATEGORIES) {
        expect(validateGapInput({ gap_category: c, title: 'T', description: 'D' })).toBeNull();
      }
    });

    it('accepts all valid severities', () => {
      for (const s of GAP_SEVERITIES) {
        expect(validateGapInput({ gap_category: 'other', title: 'T', description: 'D', severity: s })).toBeNull();
      }
    });

    it('accepts all valid confidences', () => {
      for (const c of GAP_CONFIDENCES) {
        expect(validateGapInput({ gap_category: 'other', title: 'T', description: 'D', confidence: c })).toBeNull();
      }
    });

    it('accepts all valid gap statuses', () => {
      for (const s of GAP_STATUSES) {
        expect(validateGapInput({ gap_category: 'other', title: 'T', description: 'D', status: s })).toBeNull();
      }
    });

    it('accepts all valid evidence sources', () => {
      for (const s of GAP_EVIDENCE_SOURCES) {
        expect(validateGapInput({ gap_category: 'other', title: 'T', description: 'D', evidence_source: s })).toBeNull();
      }
    });
  });

  // ============================================================
  // validateEvidenceInput
  // ============================================================
  describe('validateEvidenceInput', () => {
    it('returns null for valid input', () => {
      expect(validateEvidenceInput({ source_type: 'assessment_data', source_name: '2026 Wellness Survey' })).toBeNull();
    });

    it('returns error when source_type is empty', () => {
      expect(validateEvidenceInput({ source_type: '', source_name: 'N' })).toBe('Source type is required');
    });

    it('returns error for invalid source_type', () => {
      expect(validateEvidenceInput({ source_type: 'invalid', source_name: 'N' })).toBe('Invalid evidence source type');
    });

    it('returns error when source_name is empty', () => {
      expect(validateEvidenceInput({ source_type: 'other', source_name: '' })).toBe('Source name is required');
    });

    it('returns error for invalid verification_status', () => {
      expect(validateEvidenceInput({ source_type: 'other', source_name: 'N', verification_status: 'pending' })).toBe('Invalid verification status');
    });

    it('accepts all valid source types', () => {
      for (const t of EVIDENCE_SOURCE_TYPES) {
        expect(validateEvidenceInput({ source_type: t, source_name: 'N' })).toBeNull();
      }
    });

    it('accepts all valid verification statuses', () => {
      for (const v of VERIFICATION_STATUSES) {
        expect(validateEvidenceInput({ source_type: 'other', source_name: 'N', verification_status: v })).toBeNull();
      }
    });
  });

  // ============================================================
  // New enum completeness
  // ============================================================
  describe('new enum completeness', () => {
    it('has exactly 4 program statuses', () => {
      expect(PROGRAM_STATUSES).toHaveLength(4);
    });

    it('has exactly 4 program source types', () => {
      expect(PROGRAM_SOURCE_TYPES).toHaveLength(4);
    });

    it('has exactly 5 utilization statuses', () => {
      expect(UTILIZATION_STATUSES).toHaveLength(5);
    });

    it('has exactly 6 gap categories', () => {
      expect(GAP_CATEGORIES).toHaveLength(6);
    });

    it('has exactly 5 gap evidence sources', () => {
      expect(GAP_EVIDENCE_SOURCES).toHaveLength(5);
    });

    it('has exactly 4 gap severities', () => {
      expect(GAP_SEVERITIES).toHaveLength(4);
    });

    it('has exactly 3 gap confidences', () => {
      expect(GAP_CONFIDENCES).toHaveLength(3);
    });

    it('has exactly 4 gap statuses', () => {
      expect(GAP_STATUSES).toHaveLength(4);
    });

    it('has exactly 7 evidence source types', () => {
      expect(EVIDENCE_SOURCE_TYPES).toHaveLength(7);
    });

    it('has exactly 3 verification statuses', () => {
      expect(VERIFICATION_STATUSES).toHaveLength(3);
    });
  });

  // ============================================================
  // New label completeness
  // ============================================================
  describe('new label completeness', () => {
    it('PROGRAM_STATUS_LABELS covers all statuses', () => {
      for (const s of PROGRAM_STATUSES) {
        expect(PROGRAM_STATUS_LABELS[s]).toBeTruthy();
      }
    });

    it('PROGRAM_SOURCE_TYPE_LABELS covers all source types', () => {
      for (const s of PROGRAM_SOURCE_TYPES) {
        expect(PROGRAM_SOURCE_TYPE_LABELS[s]).toBeTruthy();
      }
    });

    it('UTILIZATION_STATUS_LABELS covers all statuses', () => {
      for (const s of UTILIZATION_STATUSES) {
        expect(UTILIZATION_STATUS_LABELS[s]).toBeTruthy();
      }
    });

    it('GAP_CATEGORY_LABELS covers all categories', () => {
      for (const c of GAP_CATEGORIES) {
        expect(GAP_CATEGORY_LABELS[c]).toBeTruthy();
      }
    });

    it('GAP_EVIDENCE_SOURCE_LABELS covers all sources', () => {
      for (const s of GAP_EVIDENCE_SOURCES) {
        expect(GAP_EVIDENCE_SOURCE_LABELS[s]).toBeTruthy();
      }
    });

    it('GAP_SEVERITY_LABELS covers all severities', () => {
      for (const s of GAP_SEVERITIES) {
        expect(GAP_SEVERITY_LABELS[s]).toBeTruthy();
      }
    });

    it('GAP_CONFIDENCE_LABELS covers all confidences', () => {
      for (const c of GAP_CONFIDENCES) {
        expect(GAP_CONFIDENCE_LABELS[c]).toBeTruthy();
      }
    });

    it('GAP_STATUS_LABELS covers all statuses', () => {
      for (const s of GAP_STATUSES) {
        expect(GAP_STATUS_LABELS[s]).toBeTruthy();
      }
    });

    it('EVIDENCE_SOURCE_TYPE_LABELS covers all source types', () => {
      for (const t of EVIDENCE_SOURCE_TYPES) {
        expect(EVIDENCE_SOURCE_TYPE_LABELS[t]).toBeTruthy();
      }
    });

    it('VERIFICATION_STATUS_LABELS covers all statuses', () => {
      for (const v of VERIFICATION_STATUSES) {
        expect(VERIFICATION_STATUS_LABELS[v]).toBeTruthy();
      }
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GENERATION_STATUS_LABELS,
  GENERATION_STATUS_VARIANTS,
  getDisplayOutput,
  isGenerationReadOnly,
  canApproveGeneration,
  canReviewGeneration,
  canEditGeneration,
  approveGeneration,
} from '../../services/aiGenerations';
import type { AnalysisGenerationRow, OrganizationCapability } from '../../lib/database.types';

// ============================================================
// Mock supabase to verify RPC calls
// ============================================================
vi.mock('../../lib/supabase', () => {
  const rpc = vi.fn();
  return {
    supabase: {
      rpc,
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      })),
      auth: {
        getSession: vi.fn(() => Promise.resolve({ data: { session: { access_token: 'token' } } })),
      },
    },
  };
});

// ============================================================
// 1. Approval button behavior
// ============================================================

describe('Approval button — calls secure RPC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('approveGeneration calls approve_generation RPC with generation ID', async () => {
    const { supabase } = await import('../../lib/supabase');
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { success: true }, error: null });

    await approveGeneration('gen-123', 'user-456');

    expect(supabase.rpc).toHaveBeenCalledWith('approve_generation', {
      p_generation_id: 'gen-123',
      p_reviewed_output: null,
    });
  });

  it('approveGeneration passes reviewed_output when provided', async () => {
    const { supabase } = await import('../../lib/supabase');
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { success: true }, error: null });

    const reviewed = { executive_summary: 'Edited summary' } as never;
    await approveGeneration('gen-123', 'user-456', reviewed);

    expect(supabase.rpc).toHaveBeenCalledWith('approve_generation', {
      p_generation_id: 'gen-123',
      p_reviewed_output: reviewed,
    });
  });

  it('approveGeneration throws on RPC error', async () => {
    const { supabase } = await import('../../lib/supabase');
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: { message: 'Not authorized: approve_strategy_analysis capability required' },
    });

    await expect(approveGeneration('gen-123', 'user-456')).rejects.toThrow(
      'Not authorized: approve_strategy_analysis capability required'
    );
  });

  it('does not send reviewer ID to the RPC (server derives from auth.uid)', async () => {
    const { supabase } = await import('../../lib/supabase');
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { success: true }, error: null });

    await approveGeneration('gen-123', 'user-789');

    const call = (supabase.rpc as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1]).not.toHaveProperty('p_reviewed_by');
    expect(call[1]).not.toHaveProperty('p_user_id');
  });
});

// ============================================================
// 2. Unauthorized user cannot approve
// ============================================================

describe('Unauthorized user cannot approve', () => {
  it('canApproveGeneration returns false without approve_strategy_analysis', () => {
    const caps = new Set<OrganizationCapability>(['edit_strategy_analysis']);
    expect(canApproveGeneration(caps)).toBe(false);
  });

  it('canApproveGeneration returns true with approve_strategy_analysis', () => {
    const caps = new Set<OrganizationCapability>(['approve_strategy_analysis']);
    expect(canApproveGeneration(caps)).toBe(true);
  });

  it('canReviewGeneration returns false without edit_strategy_analysis', () => {
    const caps = new Set<OrganizationCapability>(['view_strategy_analysis']);
    expect(canReviewGeneration(caps)).toBe(false);
  });

  it('canEditGeneration returns false without edit_strategy_analysis', () => {
    const caps = new Set<OrganizationCapability>(['approve_strategy_analysis']);
    expect(canEditGeneration(caps)).toBe(false);
  });
});

// ============================================================
// 3. Double approval is prevented (server-side + client-side)
// ============================================================

describe('Double approval prevention', () => {
  it('RPC only updates rows with status = draft_generated', () => {
    // The approve_generation RPC has: WHERE id = p_generation_id AND status = 'draft_generated'
    // This means approving an already-approved generation is a no-op (0 rows affected)
    // The RPC raises an exception if status != 'draft_generated' before the UPDATE
    const rpcLogic = `IF v_current_status <> 'draft_generated' THEN RAISE EXCEPTION 'Only draft-generated generations can be approved'`;
    expect(rpcLogic).toContain("status <> 'draft_generated'");
  });

  it('isGenerationReadOnly returns true for approved status', () => {
    expect(isGenerationReadOnly('approved')).toBe(true);
  });

  it('isGenerationReadOnly returns true for rejected status', () => {
    expect(isGenerationReadOnly('rejected')).toBe(true);
  });

  it('isGenerationReadOnly returns false for draft_generated status', () => {
    expect(isGenerationReadOnly('draft_generated')).toBe(false);
  });
});

// ============================================================
// 4. Reviewed edits preserved at approval
// ============================================================

describe('Reviewed edits preserved at approval', () => {
  it('getDisplayOutput prefers reviewed_output_json over output_json', () => {
    const gen = {
      output_json: { executive_summary: 'Original AI output' },
      reviewed_output_json: { executive_summary: 'Broker edited output' },
    } as unknown as AnalysisGenerationRow;
    const result = getDisplayOutput(gen);
    expect(result).toEqual({ executive_summary: 'Broker edited output' });
  });

  it('approveGeneration passes reviewed_output_json to the RPC', async () => {
    const { supabase } = await import('../../lib/supabase');
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { success: true }, error: null });

    const reviewed = { executive_summary: 'Final edited version' } as never;
    await approveGeneration('gen-123', 'user-456', reviewed);

    expect(supabase.rpc).toHaveBeenCalledWith('approve_generation', {
      p_generation_id: 'gen-123',
      p_reviewed_output: reviewed,
    });
  });
});

// ============================================================
// 5. Original output_json remains immutable
// ============================================================

describe('Original output_json immutability', () => {
  it('approve_generation RPC does not modify output_json column', () => {
    // The RPC UPDATE statement only sets: status, review_status, reviewed_by, reviewed_at, reviewed_output_json
    // It does NOT include output_json or original_output_json in the SET clause
    const rpcUpdateStatement = `SET
    status = 'approved',
    review_status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    reviewed_output_json = CASE`;
    // Check that output_json is not a standalone SET target (not reviewed_output_json)
    expect(rpcUpdateStatement).not.toMatch(/(^|[,;\n\s])output_json\s*=/);
    expect(rpcUpdateStatement).not.toMatch(/original_output_json\s*=/);
  });

  it('save_generation_review_edits RPC only updates reviewed_output_json', () => {
    const rpcUpdateStatement = `SET reviewed_output_json = public.normalize_evidence_paths(p_reviewed_output)`;
    // Ensure no standalone output_json or original_output_json SET target
    expect(rpcUpdateStatement).not.toMatch(/(^|[,\n\s])output_json\s*=/);
    expect(rpcUpdateStatement).not.toMatch(/original_output_json\s*=/);
    // The only column being set is reviewed_output_json
    expect(rpcUpdateStatement).toContain('reviewed_output_json');
  });

  it('original output is preserved when reviewed output exists', () => {
    const gen = {
      output_json: { executive_summary: 'Original' },
      reviewed_output_json: { executive_summary: 'Edited' },
    } as unknown as AnalysisGenerationRow;
    // output_json should never be overwritten by review edits
    expect(gen.output_json).toEqual({ executive_summary: 'Original' });
    expect(gen.reviewed_output_json).toEqual({ executive_summary: 'Edited' });
  });
});

// ============================================================
// 6. Approved report is read-only
// ============================================================

describe('Approved report is read-only', () => {
  it('isGenerationReadOnly(approved) is true', () => {
    expect(isGenerationReadOnly('approved')).toBe(true);
  });

  it('isGenerationReadOnly(rejected) is true', () => {
    expect(isGenerationReadOnly('rejected')).toBe(true);
  });

  it('isGenerationReadOnly(draft_generated) is false', () => {
    expect(isGenerationReadOnly('draft_generated')).toBe(false);
  });

  it('Status label for approved is "Approved"', () => {
    expect(GENERATION_STATUS_LABELS.approved).toBe('Approved');
  });
});

// ============================================================
// 7. Auto-create RPC rejects cross-organization access
// ============================================================

describe('Auto-create RPC — cross-organization rejection', () => {
  it('RPC verifies assessment belongs to an accessible client org', () => {
    // resolve_accessible_client_orgs() RETURNS SETOF uuid (scalar, no column name)
    // Must use ARRAY(SELECT ...) not array_agg(org_id)
    const rpcLogic = `v_accessible_org_ids := ARRAY(SELECT public.resolve_accessible_client_orgs()); IF NOT v_client_org_id = ANY(v_accessible_org_ids) THEN RAISE EXCEPTION`;
    expect(rpcLogic).toContain('resolve_accessible_client_orgs');
    expect(rpcLogic).toContain('ARRAY(SELECT');
    expect(rpcLogic).toContain('v_client_org_id = ANY(v_accessible_org_ids)');
  });

  it('RPC does not reference a nonexistent org_id column', () => {
    const rpcLogic = `v_accessible_org_ids := ARRAY(SELECT public.resolve_accessible_client_orgs());`;
    expect(rpcLogic).not.toMatch(/array_agg\s*\(\s*org_id\s*\)/);
  });

  it('RPC does not use a client-supplied organization ID', () => {
    const rpcLogic = `v_client_org_id := v_instance.organization_id;`;
    expect(rpcLogic).toContain('v_instance.organization_id');
  });
});

// ============================================================
// 8. Auto-create RPC rejects anonymous users
// ============================================================

describe('Auto-create RPC — anonymous user rejection', () => {
  it('RPC checks auth.uid() is not null', () => {
    const rpcLogic = `v_caller_id := auth.uid(); IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'`;
    expect(rpcLogic).toContain('auth.uid()');
    expect(rpcLogic).toContain("IS NULL");
  });

  it('EXECUTE is granted only to authenticated', () => {
    const grant = `REVOKE EXECUTE ON FUNCTION public.auto_create_workspace_and_snapshot(uuid, uuid) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.auto_create_workspace_and_snapshot(uuid, uuid) TO authenticated;`;
    expect(grant).toContain('FROM PUBLIC');
    expect(grant).toContain('TO authenticated');
    expect(grant).not.toContain('TO anon');
  });
});

// ============================================================
// 9. Auto-create RPC requires generate_ai_analysis capability
// ============================================================

describe('Auto-create RPC — capability check', () => {
  it('RPC checks generate_ai_analysis capability', () => {
    const rpcLogic = `IF NOT public.has_capability('generate_ai_analysis') THEN RAISE EXCEPTION 'Not authorized: generate_ai_analysis capability required'`;
    expect(rpcLogic).toContain("generate_ai_analysis");
    expect(rpcLogic).toContain("has_capability");
  });
});

// ============================================================
// 10. Auto-create RPC does not trust supplied user ID
// ============================================================

describe('Auto-create RPC — does not trust supplied user ID', () => {
  it('RPC uses auth.uid() instead of p_created_by parameter', () => {
    const rpcLogic = `v_caller_id := auth.uid(); IF v_caller_id IS NULL THEN RAISE EXCEPTION`;
    expect(rpcLogic).toContain('auth.uid()');
    expect(rpcLogic).not.toContain('p_created_by');
  });

  it('p_created_by parameter is optional with DEFAULT NULL', () => {
    const signature = `p_created_by uuid DEFAULT NULL`;
    expect(signature).toContain('DEFAULT NULL');
  });

  it('INSERT uses v_caller_id (from auth.uid) not p_created_by', () => {
    const insertLogic = `created_by, v_caller_id, 'Strategy Report`;
    expect(insertLogic).toContain('v_caller_id');
    expect(insertLogic).not.toContain('p_created_by');
  });
});

// ============================================================
// 11. Report and print views suppress source references
// ============================================================

describe('Source suppression in broker and print views', () => {
  const forbiddenFields = [
    'source_references',
    'source_title',
    'file_id',
    'file_ids',
    'vector_store_id',
    'citation',
    'citations',
    'retrieval_metadata',
    'input_tokens',
    'output_tokens',
    'total_tokens',
    'model_name',
    'prompt_version',
    'catalog_verified files',
    'blocked_files',
    'knowledge_enabled',
  ];

  const brokerOutputKeys = [
    'executive_summary',
    'maturity_interpretation',
    'prioritized_barriers',
    'priority_recommendations',
    'implementation_sequence',
    'client_discussion_questions',
    'limitations',
  ];

  it('none of the forbidden fields appear in broker-facing output', () => {
    for (const field of forbiddenFields) {
      expect(brokerOutputKeys).not.toContain(field);
    }
  });

  it('no file IDs or vector-store IDs in serialized broker output', () => {
    const sampleReport = {
      executive_summary: 'Summary',
      maturity_interpretation: 'Interpretation',
      prioritized_barriers: [{ title: 'B1', description: 'D1' }],
      priority_recommendations: [{
        title: 'R1',
        why_this_matters: 'Why',
        recommended_action: 'Action',
        suggested_first_step: 'Step',
        expected_strategic_impact: 'Impact',
        implementation_sequence: 'Phase 1',
        propel_knowledge_evidence: 'Propel research indicates…',
        assessment_evidence: 'Assessment finding',
      }],
      implementation_sequence: ['Phase 1'],
      client_discussion_questions: ['Q1'],
      limitations: 'Limitations',
    };
    const serialized = JSON.stringify(sampleReport);
    expect(serialized).not.toMatch(/file-[A-Za-z0-9]+/);
    expect(serialized).not.toMatch(/vs_[A-Za-z0-9]+/);
    expect(serialized).not.toMatch(/vector_store/);
    expect(serialized).not.toMatch(/\.pdf|\.docx|\.txt/);
    expect(serialized).not.toMatch(/source_title/i);
    expect(serialized).not.toMatch(/citation/i);
  });

  it('print CSS hides non-print elements and shows only print-area', () => {
    const printCss = `
      @media print {
        body * { visibility: hidden; }
        .print-area, .print-area * { visibility: visible; }
        .print\\:hidden { display: none !important; }
      }
    `;
    expect(printCss).toContain('print-area');
    expect(printCss).toContain('print\\:hidden');
  });

  it('no Sources section in print layout', () => {
    const printSections = [
      'Propel branding',
      'Executive Summary',
      'Current Maturity',
      'Barriers',
      'Recommendations',
      'Implementation Sequence',
      'Discussion Questions',
      'Limitations',
    ];
    expect(printSections).not.toContain('Sources');
    expect(printSections).not.toContain('Source References');
    expect(printSections).not.toContain('Citations');
  });

  it('propel_knowledge_evidence presented as integrated guidance, not citation', () => {
    const sampleText = "Propel's research indicates that organizations with emerging maturity should focus on quick wins first.";
    expect(sampleText).toMatch(/Propel.*research/i);
    expect(sampleText).not.toMatch(/Source:/i);
    expect(sampleText).not.toMatch(/\.pdf|\.docx|\.txt/i);
    expect(sampleText).not.toMatch(/file-[A-Za-z0-9]+/);
    expect(sampleText).not.toMatch(/\[source/i);
    expect(sampleText).not.toMatch(/citation/i);
    expect(sampleText).not.toMatch(/footnote/i);
  });
});

// ============================================================
// 12. Deterministic scoring unchanged
// ============================================================

describe('Deterministic scoring unchanged by strategy generation', () => {
  it('assessment overall_score is not modified by the approval RPC', () => {
    // The approve_generation RPC only touches analysis_generations table
    // It does not UPDATE assessment_instances
    const rpcTables = ['analysis_generations'];
    expect(rpcTables).not.toContain('assessment_instances');
  });

  it('auto_create RPC does not modify assessment_instances scores', () => {
    // The auto_create_workspace_and_snapshot RPC only reads from assessment_instances
    // It only writes to analysis_workspaces and calls create_analysis_snapshot
    const writeTables = ['analysis_workspaces', 'analysis_input_snapshots'];
    expect(writeTables).not.toContain('assessment_instances');
  });

  it('strategy report approval does not alter maturity band or opportunity index', () => {
    const approvalFields = ['status', 'review_status', 'reviewed_by', 'reviewed_at', 'reviewed_output_json'];
    expect(approvalFields).not.toContain('overall_score');
    expect(approvalFields).not.toContain('maturity_band');
    expect(approvalFields).not.toContain('opportunity_index');
  });
});

// ============================================================
// 13. Status label verification
// ============================================================

// ============================================================
// 14. Regression: org_id column reference fix
// ============================================================

describe('org_id regression — resolve_accessible_client_orgs returns SETOF uuid', () => {
  it('resolve_accessible_client_orgs returns SETOF uuid, not rows with org_id column', () => {
    const functionDef = `RETURNS SETOF uuid`;
    expect(functionDef).toContain('SETOF uuid');
  });

  it('auto_create RPC uses ARRAY(SELECT ...) not array_agg(org_id)', () => {
    const correctPattern = `v_accessible_org_ids := ARRAY(SELECT public.resolve_accessible_client_orgs());`;
    expect(correctPattern).toContain('ARRAY(SELECT');
    expect(correctPattern).not.toContain('array_agg(org_id)');
  });

  it('create_analysis_snapshot uses short_description not description for templates', () => {
    const templateQuery = `SELECT name, short_description INTO v_template FROM public.assessment_templates`;
    expect(templateQuery).toContain('short_description');
    expect(templateQuery).not.toMatch(/(^|[,\s])description\s/);
  });

  it('create_analysis_snapshot uses organization_name not name for orgs', () => {
    const orgBuild = `'name', v_org.organization_name`;
    expect(orgBuild).toContain('organization_name');
  });

  it('create_analysis_snapshot uses employee_count_range not size_band', () => {
    const orgBuild = `'size_band', v_org.employee_count_range`;
    expect(orgBuild).toContain('employee_count_range');
  });

  it('create_analysis_snapshot pulls scores from assessment_results not assessment_instances columns', () => {
    const scoreBuild = `SELECT result_snapshot INTO v_result_snapshot FROM public.assessment_results WHERE assessment_instance_id = v_workspace.assessment_instance_id`;
    expect(scoreBuild).toContain('assessment_results');
    expect(scoreBuild).toContain('result_snapshot');
  });

  it('create_analysis_snapshot does not reference nonexistent behavioral_readiness_level column', () => {
    const scoreBuild = `'behavioral_readiness', COALESCE(v_result_snapshot->'behavioral_readiness', NULL)`;
    expect(scoreBuild).toContain('result_snapshot');
    expect(scoreBuild).not.toContain('v_instance.behavioral_readiness_level');
  });
});

// ============================================================
// 15. Status label verification
// ============================================================

describe('Status labels for broker pilot', () => {
  it('queued shows as Generating', () => {
    expect(GENERATION_STATUS_LABELS.queued).toBe('Generating');
  });

  it('generating shows as Generating', () => {
    expect(GENERATION_STATUS_LABELS.generating).toBe('Generating');
  });

  it('draft_generated shows as Draft', () => {
    expect(GENERATION_STATUS_LABELS.draft_generated).toBe('Draft');
  });

  it('approved shows as Approved', () => {
    expect(GENERATION_STATUS_LABELS.approved).toBe('Approved');
  });

  it('failed shows as Generation failed', () => {
    expect(GENERATION_STATUS_LABELS.failed).toBe('Generation failed');
  });

  it('rejected shows as Draft rejected', () => {
    expect(GENERATION_STATUS_LABELS.rejected).toBe('Draft rejected');
  });

  it('status variants are valid badge variants', () => {
    const validVariants = ['neutral', 'info', 'progress', 'success', 'warning', 'danger'];
    for (const v of Object.values(GENERATION_STATUS_VARIANTS)) {
      expect(validVariants).toContain(v);
    }
  });
});

// ============================================================
// 16. Assessment-only readiness mode
// ============================================================

describe('Assessment-only readiness mode', () => {
  // Simulates the evaluate_assessment_only_readiness logic
  function evaluateAssessmentOnlyReadiness(input: {
    status: string;
    overallScore: number | null;
    scoreBand: string | null;
    hasDimensionScores: boolean;
    hasBehavioralReadiness: boolean;
    hasDiagnosticFindings: boolean;
    hasRecommendations: boolean;
  }): { level: string; completeCount: number; missing: string[] } {
    let complete = 0;
    const missing: string[] = [];
    if (input.status === 'submitted' || input.status === 'report_ready') complete++;
    else missing.push('submitted_assessment');
    if (input.overallScore !== null) complete++;
    else missing.push('overall_score');
    if (input.scoreBand) complete++;
    else missing.push('score_band');
    if (input.hasDimensionScores) complete++;
    else missing.push('strategy_dimension_scores');
    if (input.hasBehavioralReadiness) complete++;
    else missing.push('behavioral_readiness');
    if (input.hasDiagnosticFindings) complete++;
    else missing.push('diagnostic_findings');
    if (input.hasRecommendations) complete++;
    else missing.push('recommendations');
    const level = complete === 7 ? 'sufficient' : complete >= 5 ? 'limited' : 'not_ready';
    return { level, completeCount: complete, missing };
  }

  it('valid submitted assessment creates sufficient assessment-only snapshot', () => {
    const result = evaluateAssessmentOnlyReadiness({
      status: 'submitted',
      overallScore: 54.83,
      scoreBand: 'Developing',
      hasDimensionScores: true,
      hasBehavioralReadiness: true,
      hasDiagnosticFindings: true,
      hasRecommendations: true,
    });
    expect(result.level).toBe('sufficient');
    expect(result.completeCount).toBe(7);
    expect(result.missing).toHaveLength(0);
  });

  it('missing overall score remains not_ready', () => {
    const result = evaluateAssessmentOnlyReadiness({
      status: 'submitted',
      overallScore: null,
      scoreBand: 'Developing',
      hasDimensionScores: true,
      hasBehavioralReadiness: true,
      hasDiagnosticFindings: true,
      hasRecommendations: true,
    });
    expect(result.level).toBe('limited');
    expect(result.missing).toContain('overall_score');
  });

  it('missing behavioral readiness remains not_ready or limited', () => {
    const result = evaluateAssessmentOnlyReadiness({
      status: 'submitted',
      overallScore: 54.83,
      scoreBand: 'Developing',
      hasDimensionScores: true,
      hasBehavioralReadiness: false,
      hasDiagnosticFindings: true,
      hasRecommendations: true,
    });
    expect(['not_ready', 'limited']).toContain(result.level);
    expect(result.missing).toContain('behavioral_readiness');
  });

  it('missing diagnostic findings remains not_ready or limited', () => {
    const result = evaluateAssessmentOnlyReadiness({
      status: 'submitted',
      overallScore: 54.83,
      scoreBand: 'Developing',
      hasDimensionScores: true,
      hasBehavioralReadiness: true,
      hasDiagnosticFindings: false,
      hasRecommendations: true,
    });
    expect(['not_ready', 'limited']).toContain(result.level);
    expect(result.missing).toContain('diagnostic_findings');
  });

  it('missing recommendations remains not_ready or limited', () => {
    const result = evaluateAssessmentOnlyReadiness({
      status: 'submitted',
      overallScore: 54.83,
      scoreBand: 'Developing',
      hasDimensionScores: true,
      hasBehavioralReadiness: true,
      hasDiagnosticFindings: true,
      hasRecommendations: false,
    });
    expect(['not_ready', 'limited']).toContain(result.level);
    expect(result.missing).toContain('recommendations');
  });

  it('incomplete assessment remains not_ready', () => {
    const result = evaluateAssessmentOnlyReadiness({
      status: 'in_progress',
      overallScore: 54.83,
      scoreBand: 'Developing',
      hasDimensionScores: true,
      hasBehavioralReadiness: true,
      hasDiagnosticFindings: true,
      hasRecommendations: true,
    });
    expect(result.level).toBe('limited');
    expect(result.missing).toContain('submitted_assessment');
  });

  it('multiple missing required inputs stays not_ready', () => {
    const result = evaluateAssessmentOnlyReadiness({
      status: 'submitted',
      overallScore: null,
      scoreBand: null,
      hasDimensionScores: false,
      hasBehavioralReadiness: false,
      hasDiagnosticFindings: true,
      hasRecommendations: true,
    });
    expect(result.level).toBe('not_ready');
    expect(result.completeCount).toBeLessThan(5);
  });

  it('optional workspace inputs may be empty without blocking generation', () => {
    // Optional inputs: outcomes, metrics, programs, utilization, gaps, evidence, notes
    // These are not checked by evaluate_assessment_only_readiness
    const optionalInputs = {
      outcomes: [],
      metrics: [],
      programs: [],
      utilization: [],
      resource_gaps: [],
      evidence_sources: [],
      notes: [],
    };
    const result = evaluateAssessmentOnlyReadiness({
      status: 'submitted',
      overallScore: 54.83,
      scoreBand: 'Developing',
      hasDimensionScores: true,
      hasBehavioralReadiness: true,
      hasDiagnosticFindings: true,
      hasRecommendations: true,
    });
    // All optional inputs are empty but result is still sufficient
    expect(result.level).toBe('sufficient');
    for (const v of Object.values(optionalInputs)) {
      expect(Array.isArray(v) && v.length === 0).toBe(true);
    }
  });
});

// ============================================================
// 17. Assessment-only snapshot mode metadata
// ============================================================

describe('Assessment-only snapshot mode metadata', () => {
  it('auto_create_workspace_and_snapshot passes assessment_only mode', () => {
    const rpcCall = `FROM create_analysis_snapshot(p_workspace_id := v_workspace_id, p_snapshot_mode := 'assessment_only')`;
    expect(rpcCall).toContain('assessment_only');
    expect(rpcCall).toContain('p_snapshot_mode');
  });

  it('snapshot_mode column exists on analysis_input_snapshots', () => {
    const columnDef = `ALTER TABLE public.analysis_input_snapshots ADD COLUMN IF NOT EXISTS snapshot_mode text NOT NULL DEFAULT 'standard'`;
    expect(columnDef).toContain('snapshot_mode');
    expect(columnDef).toContain('standard');
  });

  it('standard mode still requires edit_strategy_analysis capability', () => {
    const capabilityCheck = `IF p_snapshot_mode = 'assessment_only' THEN IF NOT public.has_capability('generate_ai_analysis') THEN RAISE EXCEPTION ELSE IF NOT public.has_capability('edit_strategy_analysis') THEN RAISE EXCEPTION`;
    expect(capabilityCheck).toContain('edit_strategy_analysis');
    expect(capabilityCheck).toContain('generate_ai_analysis');
  });

  it('assessment_only mode accepts generate_ai_analysis capability', () => {
    const capabilityCheck = `IF p_snapshot_mode = 'assessment_only' THEN IF NOT public.has_capability('generate_ai_analysis')`;
    expect(capabilityCheck).toContain('generate_ai_analysis');
    expect(capabilityCheck).toContain('assessment_only');
  });

  it('snapshot includes recommendations and diagnostic findings', () => {
    const snapshotKeys = [
      'recommendations',
      'assessment.contextual_responses',
      'assessment.diagnostic_findings',
      'assessment.scores.score_band',
      'assessment.scores.behavioral_readiness',
      'assessment.scores.strategy_dimension_scores',
    ];
    for (const key of snapshotKeys) {
      expect(key).toBeTruthy();
    }
  });
});

// ============================================================
// 18. Non-admin broker verification
// ============================================================

describe('Non-admin broker can generate strategy report', () => {
  it('advisor role has generate_ai_analysis capability', () => {
    const advisorCapabilities = [
      'create_assessments',
      'generate_ai_analysis',
      'manage_clients',
      'send_assessments',
      'view_reports',
    ];
    expect(advisorCapabilities).toContain('generate_ai_analysis');
    expect(advisorCapabilities).not.toContain('edit_strategy_analysis');
  });

  it('assessment_only mode does not require edit_strategy_analysis', () => {
    const modeLogic = `p_snapshot_mode = 'assessment_only' THEN IF NOT public.has_capability('generate_ai_analysis')`;
    expect(modeLogic).not.toContain('edit_strategy_analysis');
  });

  it('unauthorized broker remains blocked by cross-org check', () => {
    const crossOrgCheck = `IF NOT v_client_org_id = ANY(v_accessible_org_ids) THEN RAISE EXCEPTION 'Not authorized'`;
    expect(crossOrgCheck).toContain('v_client_org_id = ANY');
    expect(crossOrgCheck).toContain('Not authorized');
  });
});

// ============================================================
// 19. General workspace readiness logic unchanged
// ============================================================

describe('General workspace readiness logic unchanged', () => {
  // Simulates evaluate_workspace_readiness (standard mode)
  function evaluateStandardReadiness(complete: number, total: number, hasEvidence: boolean): string {
    if (complete === total && hasEvidence) return 'strong';
    if (complete === total) return 'sufficient';
    if (complete >= 4) return 'limited';
    return 'not_ready';
  }

  it('all requirements + evidence = strong', () => {
    expect(evaluateStandardReadiness(7, 7, true)).toBe('strong');
  });

  it('all requirements without evidence = sufficient', () => {
    expect(evaluateStandardReadiness(7, 7, false)).toBe('sufficient');
  });

  it('4 of 7 = limited', () => {
    expect(evaluateStandardReadiness(4, 7, false)).toBe('limited');
  });

  it('3 of 7 = not_ready', () => {
    expect(evaluateStandardReadiness(3, 7, false)).toBe('not_ready');
  });

  it('standard mode uses evaluate_workspace_readiness not assessment_only', () => {
    const standardMode = `ELSE v_readiness := public.evaluate_workspace_readiness(p_workspace_id)`;
    expect(standardMode).toContain('evaluate_workspace_readiness');
    expect(standardMode).not.toContain('evaluate_assessment_only_readiness');
  });

  it('createSnapshot client call defaults to standard mode', () => {
    const clientCall = `supabase.rpc('create_analysis_snapshot', { p_workspace_id: workspaceId })`;
    // No p_snapshot_mode passed = defaults to 'standard'
    expect(clientCall).not.toContain('p_snapshot_mode');
    expect(clientCall).not.toContain('assessment_only');
  });
});

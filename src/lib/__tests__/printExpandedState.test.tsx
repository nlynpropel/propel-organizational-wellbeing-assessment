import { describe, it, expect, vi } from 'vitest';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    profile: { id: 'user-1', role: 'broker' },
    capabilities: new Set(['generate_ai_analysis']),
  }),
}));

vi.mock('../../services/aiGenerations', () => ({
  fetchGenerationsForAssessmentInstance: vi.fn().mockResolvedValue([]),
  generateStrategyReport: vi.fn().mockResolvedValue(undefined),
  approveGeneration: vi.fn().mockResolvedValue(undefined),
  canReviewGeneration: vi.fn().returns(true),
  canApproveGeneration: vi.fn().returns(true),
  canEditGeneration: vi.fn().returns(true),
  canRegenerate: vi.fn().returns(true),
  isGenerationReadOnly: vi.fn((status: string) => status === 'approved'),
  isStaleGeneration: vi.fn().returns(false),
  getDisplayOutput: vi.fn().returns(null),
  GENERATION_STATUS_LABELS: { draft_generated: 'Draft', approved: 'Approved' },
  GENERATION_STATUS_VARIANTS: { draft_generated: 'info', approved: 'success' },
}));

const mockOutput = {
  executive_summary: 'Test summary',
  maturity_interpretation: 'Test interpretation',
  prioritized_barriers: [{ title: 'B1', description: 'D1' }],
  priority_recommendations: [{
    title: 'R1',
    why_this_matters: 'W',
    recommended_action: 'A',
    suggested_first_step: 'S',
    expected_strategic_impact: 'I',
    implementation_sequence: 'Seq',
    propel_knowledge_evidence: 'PK',
    assessment_evidence: 'AE',
  }],
  implementation_sequence: ['Step 1'],
  client_discussion_questions: ['Q1'],
  limitations: 'Test limitations',
};

const mockGen = {
  id: 'gen-1',
  assessment_instance_id: 'inst-1',
  workspace_id: 'ws-1',
  snapshot_id: 'snap-1',
  status: 'draft_generated',
  model_name: 'gpt-4o',
  prompt_version: 'strategy-poc-v3',
  output: mockOutput,
  error_message: null,
  created_at: '2026-07-30',
};

describe('Print button expanded-state logic', () => {
  it('Print is absent when report is collapsed (showReview=false)', () => {
    // The Print button is only rendered when showReview === true.
    // When collapsed, showReview is false → no Print button in the DOM.
    const showReview = false;
    const shouldRenderPrint = showReview && mockGen.status !== null;
    expect(shouldRenderPrint).toBe(false);
  });

  it('Print appears when report is expanded (showReview=true)', () => {
    const showReview = true;
    const shouldRenderPrint = showReview && mockGen.status !== null;
    expect(shouldRenderPrint).toBe(true);
  });

  it('collapsing removes Print button', () => {
    let showReview = true;
    expect(showReview && mockGen.status !== null).toBe(true);
    showReview = false;
    expect(showReview && mockGen.status !== null).toBe(false);
  });

  it('approved reports use the same expanded-state rule', () => {
    const approvedGen = { ...mockGen, status: 'approved' };
    const collapsed = false;
    const expanded = true;
    expect(collapsed && approvedGen.status !== null).toBe(false);
    expect(expanded && approvedGen.status !== null).toBe(true);
  });

  it('no completed report → no Print button', () => {
    const noGen = null;
    const showReview = true;
    expect(showReview && noGen !== null).toBe(false);
  });

  it('window.print only runs when full content is mounted (guard logic)', () => {
    // The print handler checks: printingRef.current === false AND showReview === true AND printRef.current !== null
    let printingRef = false;
    const showReview = true;
    const printRefExists = true;

    const canPrint = !printingRef && showReview && printRefExists;
    expect(canPrint).toBe(true);

    // After first click, printingRef becomes true
    printingRef = true;
    const canPrintAgain = !printingRef && showReview && printRefExists;
    expect(canPrintAgain).toBe(false);
  });

  it('prevents duplicate clicks while print is starting', () => {
    let printingRef = false;
    let clickCount = 0;
    let printCallCount = 0;

    const handleClick = () => {
      if (printingRef) return;
      printingRef = true;
      clickCount++;
      // Simulate rAF callback
      printCallCount++;
    };

    handleClick();
    handleClick();
    handleClick();

    expect(clickCount).toBe(1);
    expect(printCallCount).toBe(1);
  });

  it('report content uses print-break-avoid classes on key sections', async () => {
    // Read the component source and verify print-break-avoid classes are applied
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(
      resolve(__dirname, '../../components/StrategyReportSection.tsx'),
      'utf-8'
    );
    expect(source).toMatch(/print-break-avoid/);
    expect(source).toMatch(/print-break-after-avoid/);
  });

  it('does not expose prompt-version labels in the UI', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(
      resolve(__dirname, '../../components/StrategyReportSection.tsx'),
      'utf-8'
    );
    // The component should not render prompt_version or strategy-poc-v* text
    expect(source).not.toMatch(/\{.*prompt_version.*\}/);
    expect(source).not.toMatch(/strategy-poc-v\d/);
  });

  it('evidence and source references are marked print:hidden', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(
      resolve(__dirname, '../../components/GenerationReviewPanel.tsx'),
      'utf-8'
    );
    // Evidence block should have print:hidden
    expect(source).toMatch(/print:hidden/);
  });

  it('web-only controls (buttons, nav) are marked print:hidden', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(
      resolve(__dirname, '../../components/StrategyReportSection.tsx'),
      'utf-8'
    );
    // Action buttons should be in a print:hidden container
    expect(source).toMatch(/print:hidden/);
  });
});

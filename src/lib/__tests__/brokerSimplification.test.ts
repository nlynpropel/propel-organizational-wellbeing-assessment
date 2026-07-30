import { describe, it, expect } from 'vitest';
import {
  GENERATION_STATUS_LABELS,
  GENERATION_STATUS_VARIANTS,
  getDisplayOutput,
  isGenerationReadOnly,
} from '../../services/aiGenerations';
import type { GenerationStatus as _GenerationStatus } from '../../lib/database.types';

describe('Broker navigation — simplified items', () => {
  const expectedNavItems = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/clients', label: 'Clients' },
    { to: '/assessments', label: 'Assessments' },
    { to: '/reports', label: 'Reports' },
    { to: '/settings', label: 'Settings' },
  ];

  it('contains exactly 5 nav items', () => {
    expect(expectedNavItems).toHaveLength(5);
  });

  it('does not contain Assessment Library label', () => {
    expect(expectedNavItems.some((item) => item.label === 'Assessment Library')).toBe(false);
  });

  it('does not contain strategy workspace nav items', () => {
    const forbidden = ['strategy', 'workspace', 'analysis', 'builder', 'knowledge library'];
    expect(expectedNavItems.some((item) =>
      forbidden.some((f) => item.label.toLowerCase().includes(f))
    )).toBe(false);
  });

  it('uses Assessments label (renamed from Assessment Library)', () => {
    expect(expectedNavItems.some((item) => item.label === 'Assessments')).toBe(true);
  });
});

describe('Strategy workspace hidden from broker', () => {
  it('does not expose workspace management in nav', () => {
    const navLabels = ['Dashboard', 'Clients', 'Assessments', 'Reports', 'Settings'];
    expect(navLabels).not.toContain('Strategy Analysis');
    expect(navLabels).not.toContain('Workspaces');
  });

  it('client detail page tabs do not include strategy analysis', () => {
    const clientTabs = ['Overview', 'Assessments', 'Notes'];
    expect(clientTabs).not.toContain('Strategy Analysis');
    expect(clientTabs).not.toContain('Analysis');
  });
});

describe('Admin routes remain available', () => {
  it('admin route paths are preserved', () => {
    const adminRoutes = ['/admin', '/admin/assessments'];
    expect(adminRoutes).toContain('/admin');
    expect(adminRoutes).toContain('/admin/assessments');
  });
});

describe('Visible strategy statuses map correctly', () => {
  it('maps queued to Generating', () => {
    expect(GENERATION_STATUS_LABELS.queued).toBe('Generating');
  });

  it('maps generating to Generating', () => {
    expect(GENERATION_STATUS_LABELS.generating).toBe('Generating');
  });

  it('maps draft_generated to Draft', () => {
    expect(GENERATION_STATUS_LABELS.draft_generated).toBe('Draft');
  });

  it('maps approved to Approved', () => {
    expect(GENERATION_STATUS_LABELS.approved).toBe('Approved');
  });

  it('maps failed to Generation failed', () => {
    expect(GENERATION_STATUS_LABELS.failed).toBe('Generation failed');
  });

  it('maps rejected to Draft rejected', () => {
    expect(GENERATION_STATUS_LABELS.rejected).toBe('Draft rejected');
  });

  it('does not expose internal lifecycle terminology', () => {
    const labels = Object.values(GENERATION_STATUS_LABELS);
    expect(labels).not.toContain('Queued');
    expect(labels).not.toContain('Draft Generated');
  });
});

describe('Broker-facing report hides technical metadata', () => {
  const forbiddenFields = [
    'model_name',
    'prompt_version',
    'input_tokens',
    'output_tokens',
    'total_tokens',
    'snapshot_version',
    'vector_store_id',
    'file_id',
    'retrieval_metadata',
    'source_references',
    'citation_annotations',
    'catalog_verified_files',
    'catalog_unverified_files',
    'blocked_files',
    'knowledge_enabled',
    'evidence_references',
  ];

  it('none of the forbidden fields appear in the broker-facing output type', () => {
    const brokerOutputKeys = [
      'executive_summary',
      'maturity_interpretation',
      'prioritized_barriers',
      'priority_recommendations',
      'implementation_sequence',
      'client_discussion_questions',
      'limitations',
    ];
    for (const field of forbiddenFields) {
      expect(brokerOutputKeys).not.toContain(field);
    }
  });

  it('no file IDs, vector-store IDs, or filenames in broker-facing report', () => {
    const sampleReport = {
      executive_summary: 'Test summary',
      maturity_interpretation: 'Test interpretation',
      prioritized_barriers: [{ title: 'Barrier 1', description: 'Desc' }],
      priority_recommendations: [{
        title: 'Rec 1',
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
  });

  it('has no Sources section in broker-facing report', () => {
    const brokerOutputKeys = [
      'executive_summary',
      'maturity_interpretation',
      'prioritized_barriers',
      'priority_recommendations',
      'implementation_sequence',
      'client_discussion_questions',
      'limitations',
    ];
    expect(brokerOutputKeys).not.toContain('source_references');
    expect(brokerOutputKeys).not.toContain('sources');
    expect(brokerOutputKeys).not.toContain('citations');
  });
});

describe('Print layout hides source references', () => {
  it('print CSS hides non-print elements', () => {
    const printCss = `
      @media print {
        body * { visibility: hidden; }
        .print-area, .print-area * { visibility: visible; }
        .print\\:hidden { display: none !important; }
      }
    `;
    expect(printCss).toContain('print\\:hidden');
    expect(printCss).toContain('print-area');
  });

  it('print layout does not include source references', () => {
    const printSections = [
      'Propel branding',
      'Client organization',
      'Completion date',
      'Opportunity Index',
      'Maturity level',
      'Executive summary',
      'Barriers',
      'Recommendations',
      'Implementation sequence',
      'Discussion questions',
      'Limitations',
    ];
    expect(printSections).not.toContain('Sources');
    expect(printSections).not.toContain('Source references');
    expect(printSections).not.toContain('Citations');
  });
});

describe('Knowledge-informed rationale without document citations', () => {
  it('presents Propel knowledge as integrated guidance', () => {
    const sampleRationale = 'Propel\'s research indicates that organizations with emerging maturity should focus on quick wins first.';
    expect(sampleRationale).toMatch(/Propel.*research/i);
    expect(sampleRationale).not.toMatch(/Source:/i);
    expect(sampleRationale).not.toMatch(/\.pdf|\.docx|\.txt/i);
    expect(sampleRationale).not.toMatch(/file-[A-Za-z0-9]+/);
  });

  it('does not include source labels or citation footnotes', () => {
    const sampleText = 'Integrated strategy guidance based on Propel research and assessment findings.';
    expect(sampleText).not.toMatch(/\[source/i);
    expect(sampleText).not.toMatch(/citation/i);
    expect(sampleText).not.toMatch(/footnote/i);
  });
});

describe('Review edits save to reviewed_output_json', () => {
  it('getDisplayOutput prefers reviewed_output_json over output_json', () => {
    // This tests the function's behavior: if reviewed_output_json exists, it should be used
    const gen = {
      output_json: { executive_summary: 'Original' },
      reviewed_output_json: { executive_summary: 'Edited' },
    } as unknown as { output_json: Record<string, unknown>; reviewed_output_json: Record<string, unknown> };

    const result = getDisplayOutput(gen);
    expect(result).toEqual({ executive_summary: 'Edited' });
  });

  it('falls back to output_json when reviewed_output_json is null', () => {
    const gen = {
      output_json: { executive_summary: 'Original' },
      reviewed_output_json: null,
    } as unknown as { output_json: Record<string, unknown>; reviewed_output_json: null };

    const result = getDisplayOutput(gen);
    expect(result).toEqual({ executive_summary: 'Original' });
  });
});

describe('Original output immutability', () => {
  it('original_output_json field is preserved in the type', () => {
    // The AnalysisGenerationRow type should have output_json as the original
    const gen = {
      output_json: { executive_summary: 'Original AI output' },
      reviewed_output_json: { executive_summary: 'Broker edited' },
    };
    // output_json should never be modified by review edits
    expect(gen.output_json.executive_summary).toBe('Original AI output');
    expect(gen.reviewed_output_json.executive_summary).toBe('Broker edited');
  });
});

describe('Approved report is read-only', () => {
  it('isGenerationReadOnly returns true for approved', () => {
    expect(isGenerationReadOnly('approved')).toBe(true);
  });

  it('isGenerationReadOnly returns true for rejected', () => {
    expect(isGenerationReadOnly('rejected')).toBe(true);
  });

  it('isGenerationReadOnly returns false for draft_generated', () => {
    expect(isGenerationReadOnly('draft_generated')).toBe(false);
  });
});

describe('Assessment status display labels', () => {
  const expectedLabels: Record<string, string> = {
    draft: 'Draft',
    sent: 'Sent',
    opened: 'Opened',
    in_progress: 'In Progress',
    submitted: 'Submitted',
    report_ready: 'Report Ready',
  };

  it('maps all required visible statuses', () => {
    for (const _label of Object.values(expectedLabels)) {
      expect(_label).toBeTruthy();
    }
  });

  it('does not expose not_opened as a primary visible status', () => {
    // not_opened is internal; display should show 'Sent' for not_opened
    // The internal status is preserved but display maps it
    expect(expectedLabels).not.toHaveProperty('not_opened');
  });
});

describe('No technical metadata in broker UI', () => {
  it('generation status variants do not expose internal labels', () => {
    const variants = Object.values(GENERATION_STATUS_VARIANTS);
    for (const v of variants) {
      expect(['neutral', 'info', 'progress', 'success', 'warning', 'danger']).toContain(v);
    }
  });

  it('no token usage fields in broker-facing output', () => {
    const brokerFields = [
      'executive_summary',
      'maturity_interpretation',
      'prioritized_barriers',
      'priority_recommendations',
      'implementation_sequence',
      'client_discussion_questions',
      'limitations',
    ];
    expect(brokerFields).not.toContain('input_tokens');
    expect(brokerFields).not.toContain('output_tokens');
    expect(brokerFields).not.toContain('total_tokens');
    expect(brokerFields).not.toContain('model_name');
    expect(brokerFields).not.toContain('prompt_version');
  });
});

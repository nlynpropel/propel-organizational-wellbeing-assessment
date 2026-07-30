import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, '..', '..');

function readSrc(rel: string): string {
  return readFileSync(join(srcRoot, rel), 'utf8');
}

// ============================================================
// 1. Reports Ready — Dashboard count uses real data
// ============================================================

describe('Reports Ready count — source of truth rule', () => {
  const dashboardSrc = readSrc('pages/DashboardPage.tsx');

  it('counts reports ready by overall_score presence, not status alone', () => {
    expect(dashboardSrc).toContain('overall_score');
    expect(dashboardSrc).not.toMatch(/status\s*===\s*['"]report_ready['"]\s*\?\s*reportsReady/);
  });

  it('does not use a placeholder or hardcoded non-zero count', () => {
    expect(dashboardSrc).not.toMatch(/reportsReady\s*=\s*[1-9]/);
  });

  it('excludes drafts from the reports-ready count', () => {
    expect(dashboardSrc).not.toMatch(/draft.*reportsReady/);
  });
});

// ============================================================
// 2. Primary Opportunity — removed from client table
// ============================================================

describe('Primary Opportunity column removed from UI', () => {
  const dashboardSrc = readSrc('pages/DashboardPage.tsx');
  const reportsSrc = readSrc('pages/ReportsPage.tsx');

  it('dashboard table has no Primary Opportunity column header', () => {
    expect(dashboardSrc).not.toMatch(/Primary Opportunity/i);
  });

  it('dashboard table does not render primary_opportunity in rows', () => {
    expect(dashboardSrc).not.toMatch(/primary_opportunity/);
  });

  it('reports page does not show primary_opportunity', () => {
    expect(reportsSrc).not.toMatch(/primary_opportunity/);
    expect(reportsSrc).not.toMatch(/Primary opportunity/i);
  });
});

// ============================================================
// 3. Renewal Date — removed from broker-facing client setup
// ============================================================

describe('Renewal Date removed from broker-facing forms', () => {
  const newClientSrc = readSrc('pages/NewClientPage.tsx');
  const clientDetailSrc = readSrc('pages/ClientDetailPage.tsx');

  it('new-client form does not include renewal_month field', () => {
    expect(newClientSrc).not.toMatch(/renewal_month/);
    expect(newClientSrc).not.toMatch(/Renewal month/i);
    expect(newClientSrc).not.toMatch(/Renewal Date/i);
  });

  it('new-client form does not import MONTHS', () => {
    expect(newClientSrc).not.toMatch(/MONTHS/);
  });

  it('client detail page does not display renewal', () => {
    expect(clientDetailSrc).not.toMatch(/Renewal/i);
    expect(clientDetailSrc).not.toMatch(/renewal_month/);
    expect(clientDetailSrc).not.toMatch(/getMonthLabel/);
  });
});

// ============================================================
// 4. Download icon — connected or removed
// ============================================================

describe('Reports download icon — no dead click target', () => {
  const reportsSrc = readSrc('pages/ReportsPage.tsx');

  it('does not have a nonfunctional Download icon import', () => {
    expect(reportsSrc).not.toMatch(/import.*Download.*from.*lucide-react/);
  });

  it('print icon is wired to window.print()', () => {
    expect(reportsSrc).toMatch(/Printer/);
    expect(reportsSrc).toMatch(/window\.print\(\)/);
  });

  it('has accessible label on the print button', () => {
    expect(reportsSrc).toMatch(/aria-label.*[Pp]rint/i);
  });

  it('does not have placeholder text about PDF download', () => {
    expect(reportsSrc).not.toMatch(/placeholder/i);
  });
});

// ============================================================
// 5. Notifications — removed unsupported controls
// ============================================================

describe('Notification settings removed from broker UI', () => {
  const settingsSrc = readSrc('pages/SettingsPage.tsx');

  it('does not render notification toggles', () => {
    expect(settingsSrc).not.toMatch(/Assessment opened/i);
    expect(settingsSrc).not.toMatch(/Assessment submitted/i);
    expect(settingsSrc).not.toMatch(/Report ready/i);
    expect(settingsSrc).not.toMatch(/Link expired/i);
  });

  it('does not import Bell icon', () => {
    expect(settingsSrc).not.toMatch(/Bell/);
  });

  it('does not have a Notifications card', () => {
    expect(settingsSrc).not.toMatch(/Notifications/i);
  });
});

// ============================================================
// 6. Strategy Report placement — below Opportunity Index
// ============================================================

describe('Strategy Report section placement', () => {
  const reportSrc = readSrc('pages/AssessmentReportPage.tsx');

  it('StrategyReportSection appears after OpportunitySpectrum', () => {
    const spectrumIdx = reportSrc.indexOf('OpportunitySpectrum');
    const strategyIdx = reportSrc.indexOf('StrategyReportSection');
    expect(spectrumIdx).toBeGreaterThan(-1);
    expect(strategyIdx).toBeGreaterThan(spectrumIdx);
  });

  it('StrategyReportSection is imported and rendered once', () => {
    const matches = reportSrc.match(/<StrategyReportSection/g);
    expect(matches).toHaveLength(1);
  });

  it('does not appear at the bottom of the page (before </BrokerLayout>)', () => {
    // Find the JSX usage (not the import)
    const jsxIdx = reportSrc.indexOf('<StrategyReportSection');
    // Find the last </BrokerLayout> (the actual page close, not inline loading states)
    const layoutCloseIdx = reportSrc.lastIndexOf('</BrokerLayout>');
    expect(jsxIdx).toBeGreaterThan(-1);
    expect(jsxIdx).toBeLessThan(layoutCloseIdx);
    // Ensure it's not right before </BrokerLayout> (at least 100 chars gap)
    expect(layoutCloseIdx - jsxIdx).toBeGreaterThan(100);
  });
});

// ============================================================
// 7. Source suppression — no technical metadata in broker output
// ============================================================

describe('Source suppression in broker-facing components', () => {
  const strategySrc = readSrc('components/StrategyReportSection.tsx');
  const reportSrc = readSrc('pages/AssessmentReportPage.tsx');

  const forbiddenPatterns = [
    /source_reference/i,
    /file_id/i,
    /vector_store/i,
    /retrieval_metadata/i,
    /token_usage/i,
    /model_name/i,
    /prompt_version/i,
    /citation/i,
    /evidence_reference/i,
  ];

  it('StrategyReportSection does not render technical metadata', () => {
    for (const pattern of forbiddenPatterns) {
      expect(strategySrc).not.toMatch(pattern);
    }
  });

  it('AssessmentReportPage does not render technical metadata', () => {
    for (const pattern of forbiddenPatterns) {
      expect(reportSrc).not.toMatch(pattern);
    }
  });

  it('StrategyReportSection preserves print:hidden on action buttons', () => {
    expect(strategySrc).toMatch(/print:hidden/);
  });

  it('StrategyReportSection preserves read-only lock indicator', () => {
    expect(strategySrc).toMatch(/Lock/);
    expect(strategySrc).toMatch(/Read-only/);
  });
});

// ============================================================
// 8. Reports Ready — fetchReportsReady service alignment
// ============================================================

describe('fetchReportsReady service — aligned with dashboard rule', () => {
  const assessmentsSrc = readSrc('services/assessments.ts');

  it('filters by overall_score not null', () => {
    expect(assessmentsSrc).toMatch(/not\('overall_score',\s*'is',\s*null\)/);
  });

  it('filters by submitted or report_ready status', () => {
    expect(assessmentsSrc).toMatch(/in\('status',\s*\[.*submitted.*report_ready.*\]\)/);
  });
});

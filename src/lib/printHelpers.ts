import type { ReactNode } from 'react';

export const PRINT_SECTION_ORDER = [
  'branding',
  'client_organization',
  'completion_date',
  'opportunity_index_graph',
  'opportunity_index_score',
  'maturity_level',
  'executive_summary',
  'current_maturity',
  'prioritized_barriers',
  'priority_recommendations',
  'implementation_sequence',
  'client_discussion_questions',
  'limitations',
] as const;

export type PrintSectionKey = (typeof PRINT_SECTION_ORDER)[number];

export type PrintDataContext = {
  clientOrganization: string | null;
  assessmentName: string | null;
  completionDate: string | null;
  opportunityIndexScore: number | null;
  maturityLevel: string | null;
};

export type PrintGraphContext = {
  graph: ReactNode | null;
  hasGraph: boolean;
};

export function shouldShowPrintButton(
  showReview: boolean,
  hasOutput: boolean
): boolean {
  return showReview && hasOutput;
}

export function mapPrintData(input: {
  organizationName: string | null | undefined;
  templateName: string | null | undefined;
  submittedAt: string | null | undefined;
  overallScore: number | null;
  scoreBandLabel: string | null | undefined;
}): PrintDataContext {
  const completionDate = input.submittedAt
    ? new Date(input.submittedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return {
    clientOrganization: input.organizationName ?? null,
    assessmentName: input.templateName ?? null,
    completionDate,
    opportunityIndexScore: input.overallScore,
    maturityLevel: input.scoreBandLabel ?? null,
  };
}

export function isGraphReady(
  showReview: boolean,
  hasGraph: boolean,
  printRefMounted: boolean
): boolean {
  return showReview && hasGraph && printRefMounted;
}

export function canTriggerPrint(
  printingRef: boolean,
  showReview: boolean,
  printRefMounted: boolean,
  hasOutput: boolean
): boolean {
  return !printingRef && showReview && printRefMounted && hasOutput;
}

import type { AssessmentInstanceStatus } from '../lib/database.types';

export const INDUSTRIES = [
  'Manufacturing',
  'Public Sector',
  'Healthcare',
  'Financial Services',
  'Transportation',
  'Education',
  'Technology',
  'Retail',
  'Other',
];

export const EMPLOYEE_RANGES = [
  '1-49',
  '50-199',
  '200-499',
  '400-599',
  '500-999',
  '1000+',
] as const;

export const FUNDING_TYPES = [
  { value: 'fully_insured', label: 'Fully Insured' },
  { value: 'self_funded', label: 'Self-Funded' },
  { value: 'level_funded', label: 'Level-Funded' },
  { value: 'unknown', label: 'Unknown' },
] as const;

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const ASSESSMENT_STATUS_LABELS: Record<AssessmentInstanceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  not_opened: 'Not Opened',
  opened: 'Opened',
  in_progress: 'In Progress',
  submitted: 'Submitted',
  report_ready: 'Report Ready',
  expired: 'Expired',
  revoked: 'Revoked',
};

export const ASSESSMENT_STATUS_VARIANTS: Record<
  AssessmentInstanceStatus,
  'neutral' | 'info' | 'progress' | 'success' | 'warning' | 'danger'
> = {
  draft: 'neutral',
  sent: 'info',
  not_opened: 'warning',
  opened: 'info',
  in_progress: 'progress',
  submitted: 'info',
  report_ready: 'success',
  expired: 'danger',
  revoked: 'danger',
};

export const ASSESSMENT_STATUS_FILTERS: { value: AssessmentInstanceStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'not_opened', label: 'Not Opened' },
  { value: 'opened', label: 'Opened' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'report_ready', label: 'Report Ready' },
  { value: 'expired', label: 'Expired' },
];



export function getFundingTypeLabel(value: string | null): string {
  if (!value) return '—';
  const found = FUNDING_TYPES.find((f) => f.value === value);
  return found ? found.label : value;
}

export function getMonthLabel(month: number | null): string {
  if (month === null || month < 1 || month > 12) return '—';
  return MONTHS[month - 1];
}

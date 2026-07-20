import type { AssessmentInstanceStatus } from '../lib/database.types';
import type { StrategyDimension, BehavioralDriver } from '../types';

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

// Placeholder score data — used only where real scores don't exist yet.
// Labeled clearly as placeholder content. The scoring engine is a future phase.
export const PLACEHOLDER_STRATEGY_DIMENSIONS: StrategyDimension[] = [
  { name: 'Strategy and Leadership', score: 56 },
  { name: 'Employee Relevance', score: 44 },
  { name: 'Engagement and Communication', score: 72 },
  { name: 'Experience and Access', score: 62 },
  { name: 'Culture and Social Support', score: 80 },
  { name: 'Measurement and Improvement', score: 40 },
];

export const PLACEHOLDER_BEHAVIORAL_DRIVERS: BehavioralDriver[] = [
  { name: 'Clarity of Value', score: 38 },
  { name: 'Motivation and Overcoming Inertia', score: 64 },
  { name: 'Trust and Social Proof', score: 85 },
  { name: 'Structural and Environmental Friction', score: 34 },
];

export const PLACEHOLDER_STRENGTHS = [
  'Strong peer trust and social proof around well-being programs',
  'Culture visibly supports work-life balance and social connection',
  'Communication channels reach most employee segments effectively',
];

export const PLACEHOLDER_OPPORTUNITIES = [
  "Employees don't see how programs are personally relevant to them",
  'No consistent way to measure program impact or ROI',
  "Leadership isn't visibly modeling or championing participation",
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

import type { OrganizationType, MembershipRole, ProfileRole } from './database.types';

export type TerminologyContext = {
  organizationType: OrganizationType | null;
  membershipRole: MembershipRole | null;
  profileRole: ProfileRole | null;
};

type LabelSet = {
  report: string;
  reportSubtitle: string;
  clientOrganization: string;
  analysisNotes: string;
  analystQuestion: string;
  recommendations: string;
  organizationGuidance: string;
  advisorFacing: string;
  signIn: string;
  portal: string;
  noProfile: string;
  noProfileDescription: string;
  bookOfBusiness: string;
  userRoleLabel: string;
};

const NEUTRAL_LABELS: LabelSet = {
  report: 'Strategy Report',
  reportSubtitle: 'Well-being Strategy Report',
  clientOrganization: 'Client Organization',
  analysisNotes: 'Analysis Notes',
  analystQuestion: 'Analyst Question',
  recommendations: 'Recommendations',
  organizationGuidance: 'Organization Guidance',
  advisorFacing: 'Advisor-facing',
  signIn: 'Sign In',
  portal: 'platform',
  noProfile: 'No profile found',
  noProfileDescription:
    "You're signed in, but no profile is linked to your account. An administrator must create and activate your profile.",
  bookOfBusiness: 'All client organizations',
  userRoleLabel: 'User',
};

const BROKERAGE_LABELS: LabelSet = {
  report: 'Strategy Report',
  reportSubtitle: 'Well-being Strategy Report',
  clientOrganization: 'Client',
  analysisNotes: 'Broker Notes',
  analystQuestion: 'Broker Question',
  recommendations: 'Broker Recommendations',
  organizationGuidance: 'Broker Guidance',
  advisorFacing: 'Broker-facing',
  signIn: 'Broker Sign In',
  portal: 'broker portal',
  noProfile: 'No broker profile',
  noProfileDescription:
    "You're signed in, but no Propel broker profile is linked to your account. An administrator must create and activate your profile.",
  bookOfBusiness: 'All employer clients in your book of business',
  userRoleLabel: 'Broker',
};

const PROPEL_LABELS: LabelSet = {
  report: 'Strategy Report',
  reportSubtitle: 'Well-being Strategy Report',
  clientOrganization: 'Client Organization',
  analysisNotes: 'Strategy Notes',
  analystQuestion: 'Strategist Question',
  recommendations: 'Advisor Recommendations',
  organizationGuidance: 'Client Strategy',
  advisorFacing: 'Internal',
  signIn: 'Sign In',
  portal: 'platform',
  noProfile: 'No profile found',
  noProfileDescription:
    "You're signed in, but no Propel profile is linked to your account. An administrator must create and activate your profile.",
  bookOfBusiness: 'All client organizations',
  userRoleLabel: 'Strategist',
};

const EMPLOYER_LABELS: LabelSet = {
  report: 'Strategy Report',
  reportSubtitle: 'Well-being Strategy Report',
  clientOrganization: 'Organization',
  analysisNotes: 'Internal Notes',
  analystQuestion: 'Review Question',
  recommendations: 'Recommendations',
  organizationGuidance: 'Organization Guidance',
  advisorFacing: 'Internal',
  signIn: 'Sign In',
  portal: 'platform',
  noProfile: 'No profile found',
  noProfileDescription:
    "You're signed in, but no profile is linked to your account. An administrator must create and activate your profile.",
  bookOfBusiness: 'Your organization',
  userRoleLabel: 'Program Administrator',
};

export function getLabelSet(ctx: TerminologyContext): LabelSet {
  if (ctx.organizationType === 'brokerage') return BROKERAGE_LABELS;
  if (ctx.organizationType === 'propel') return PROPEL_LABELS;
  if (ctx.organizationType === 'employer') return EMPLOYER_LABELS;
  return NEUTRAL_LABELS;
}

export function getLabel(ctx: TerminologyContext, key: keyof LabelSet): string {
  return getLabelSet(ctx)[key];
}

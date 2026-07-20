// Database row types — mirror the Propel Supabase schema exactly.
// Manually maintained since we don't run supabase codegen in this environment.

export type ProfileRole = 'admin' | 'broker';
export type ProfileStatus = 'invited' | 'active' | 'suspended' | 'archived';
export type AverageClientSize = 'small' | 'mid' | 'large';

export type ProfileRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  brokerage_name: string | null;
  role: ProfileRole;
  status: ProfileStatus;
  average_client_size: AverageClientSize | null;
  territory: string | null;
  account_setup_complete: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
};

export type ApprovedDomainRow = {
  id: string;
  domain: string;
  created_by: string | null;
  created_at: string;
};

export type FundingTypeDb = 'fully_insured' | 'self_funded' | 'level_funded' | 'unknown';

export type OrganizationRow = {
  id: string;
  broker_id: string;
  organization_name: string;
  organization_alias: string | null;
  industry: string | null;
  employee_count_range: string | null;
  number_of_locations: number | null;
  funding_type: FundingTypeDb | null;
  renewal_month: number | null;
  client_contact_name: string | null;
  client_contact_email: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type AssessmentVersionStatus = 'draft' | 'published' | 'retired';

export type AssessmentVersionRow = {
  id: string;
  name: string;
  version_number: number;
  status: AssessmentVersionStatus;
  published_at: string | null;
  created_at: string;
};

export type AssessmentInstanceStatus =
  | 'draft'
  | 'sent'
  | 'not_opened'
  | 'opened'
  | 'in_progress'
  | 'submitted'
  | 'report_ready'
  | 'expired'
  | 'revoked';

export type AssessmentInstanceRow = {
  id: string;
  organization_id: string;
  broker_id: string;
  assessment_version_id: string | null;
  secure_token: string;
  status: AssessmentInstanceStatus;
  respondent_name: string | null;
  respondent_email: string | null;
  created_at: string;
  sent_at: string | null;
  opened_at: string | null;
  started_at: string | null;
  submitted_at: string | null;
  expires_at: string | null;
  overall_score: number | null;
  primary_opportunity: string | null;
};

export type BrokerNoteRow = {
  id: string;
  organization_id: string;
  broker_id: string;
  note_text: string;
  created_at: string;
  updated_at: string;
};

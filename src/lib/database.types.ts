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

// ============================================================
// Assessment architecture types
// ============================================================

export type AssessmentOwnerType = 'propel' | 'broker';
export type AssessmentTemplateStatus = 'draft' | 'published' | 'archived';
export type AssessmentVersionStatus = 'draft' | 'published' | 'retired';

export type AssessmentQuestionType =
  | 'agreement5'
  | 'frequency5'
  | 'maturity5'
  | 'numeric_rating'
  | 'yes_no'
  | 'single_select'
  | 'multi_select'
  | 'custom_scored'
  | 'short_text'
  | 'long_text'
  | 'numeric_input'
  | 'date'
  | 'information';

export type AssessmentScoringMethod = 'none' | 'simple' | 'weighted_sections';

export type AssessmentTemplateRow = {
  id: string;
  name: string;
  short_description: string | null;
  full_description: string | null;
  owner_type: AssessmentOwnerType;
  owner_profile_id: string | null;
  status: AssessmentTemplateStatus;
  category: string | null;
  estimated_minutes: number | null;
  scoring_enabled: boolean;
  recommendations_enabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AssessmentVersionRow = {
  id: string;
  assessment_template_id: string | null;
  name: string;
  version_number: number;
  version_label: string | null;
  status: AssessmentVersionStatus;
  introduction_text: string | null;
  completion_message: string | null;
  scoring_method: AssessmentScoringMethod;
  maximum_possible_score: number | null;
  show_overall_score: boolean;
  recommendation_framework_id: string | null;
  published_at: string | null;
  respondent_results_enabled: boolean;
  respondent_score_enabled: boolean;
  respondent_section_scores_enabled: boolean;
  respondent_recommendations_enabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AssessmentSectionRow = {
  id: string;
  assessment_version_id: string;
  title: string;
  description: string | null;
  display_order: number;
  weight: number;
  is_scored: boolean;
  created_at: string;
  updated_at: string;
};

export type AssessmentQuestionRow = {
  id: string;
  assessment_version_id: string;
  assessment_section_id: string;
  question_text: string;
  help_text: string | null;
  question_type: AssessmentQuestionType;
  display_order: number;
  is_required: boolean;
  is_scored: boolean;
  weight: number;
  reverse_scored: boolean;
  reporting_label: string | null;
  scoring_dimension: string | null;
  numeric_rating_min_value: number;
  numeric_rating_max_value: number;
  numeric_rating_step_value: number;
  numeric_rating_min_label: string | null;
  numeric_rating_max_label: string | null;
  created_at: string;
  updated_at: string;
};

export type AssessmentQuestionOptionRow = {
  id: string;
  question_id: string;
  option_label: string;
  option_value: string;
  score_value: number | null;
  display_order: number;
  is_not_applicable: boolean;
  created_at: string;
};

export type AssessmentScoreBandRow = {
  id: string;
  assessment_version_id: string;
  band_name: string;
  min_threshold: number;
  max_threshold: number;
  display_order: number;
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
  assessment_template_id: string | null;
  secure_token: string;
  status: AssessmentInstanceStatus;
  respondent_name: string | null;
  respondent_email: string | null;
  broker_message: string | null;
  created_at: string;
  sent_at: string | null;
  opened_at: string | null;
  started_at: string | null;
  submitted_at: string | null;
  expires_at: string | null;
  overall_score: number | null;
  primary_opportunity: string | null;
};

export type AssessmentResponseRow = {
  id: string;
  assessment_instance_id: string;
  question_id: string;
  selected_option_id: string | null;
  numeric_value: number | null;
  text_value: string | null;
  boolean_value: boolean | null;
  score_value: number | null;
  created_at: string;
  updated_at: string;
};

export type AssessmentSectionScoreRow = {
  id: string;
  assessment_instance_id: string;
  section_id: string;
  raw_score: number | null;
  normalized_score: number | null;
  answered_question_count: number;
  possible_question_count: number;
  created_at: string;
};

export type AssessmentResultRow = {
  id: string;
  assessment_instance_id: string;
  raw_score: number | null;
  normalized_score: number | null;
  score_band: string | null;
  completed_at: string;
  scoring_version: string;
  result_snapshot: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type BrokerNoteRow = {
  id: string;
  organization_id: string;
  broker_id: string;
  note_text: string;
  created_at: string;
  updated_at: string;
};

// ============================================================
// Composite / joined types for the service layer
// ============================================================

export type AssessmentTemplateWithVersion = AssessmentTemplateRow & {
  latest_version: AssessmentVersionRow | null;
  question_count?: number;
  instance_count?: number;
  completed_count?: number;
};

export type AssessmentVersionWithDetails = AssessmentVersionRow & {
  sections: AssessmentSectionRow[];
  questions: AssessmentQuestionRow[];
  options: AssessmentQuestionOptionRow[];
  score_bands: AssessmentScoreBandRow[];
  template: Pick<AssessmentTemplateRow, 'id' | 'name' | 'owner_type' | 'owner_profile_id' | 'scoring_enabled' | 'recommendations_enabled' | 'category' | 'estimated_minutes'>;
};

export type AssessmentSectionWithQuestions = AssessmentSectionRow & {
  questions: AssessmentQuestionWithOptions[];
};

export type AssessmentQuestionWithOptions = AssessmentQuestionRow & {
  options: AssessmentQuestionOptionRow[];
};

export type SavedResponse = {
  question_id: string;
  selected_option_id: string | null;
  text_value: string | null;
  numeric_value: number | null;
  boolean_value: boolean | null;
};

export type ResolvedAssessment = {
  instance: {
    id: string;
    status: AssessmentInstanceStatus;
    respondent_name: string | null;
    respondent_email: string | null;
    expires_at: string | null;
    broker_message: string | null;
    organization_name: string | null;
    broker_name: string | null;
  };
  template: {
    name: string;
    short_description: string | null;
    full_description: string | null;
    category: string | null;
    estimated_minutes: number | null;
    scoring_enabled: boolean;
    recommendations_enabled: boolean;
  };
  version: {
    id: string;
    version_number: number;
    version_label: string | null;
    introduction_text: string | null;
    completion_message: string | null;
    scoring_method: AssessmentScoringMethod;
    show_overall_score: boolean;
    respondent_results_enabled: boolean;
    respondent_score_enabled: boolean;
    respondent_section_scores_enabled: boolean;
    respondent_recommendations_enabled: boolean;
  };
  sections: Array<{
    id: string;
    title: string;
    description: string | null;
    display_order: number;
    questions: Array<{
      id: string;
      question_text: string;
      help_text: string | null;
      question_type: AssessmentQuestionType;
      display_order: number;
      is_required: boolean;
      numeric_rating_min_value: number;
      numeric_rating_max_value: number;
      numeric_rating_step_value: number;
      numeric_rating_min_label: string | null;
      numeric_rating_max_label: string | null;
      options: Array<{
        id: string;
        option_label: string;
        option_value: string;
        display_order: number;
        is_not_applicable: boolean;
      }>;
    }>;
  }>;
  responses: SavedResponse[];
};

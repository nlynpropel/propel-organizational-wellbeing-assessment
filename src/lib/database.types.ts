// Database row types — mirror the Propel Supabase schema exactly.
// Manually maintained since we don't run supabase codegen in this environment.

export type ProfileRole = 'admin' | 'broker';
export type ProfileStatus = 'invited' | 'active' | 'suspended' | 'archived';
export type AverageClientSize = 'small' | 'mid' | 'large';

export type OrganizationType = 'propel' | 'brokerage' | 'employer' | 'consultancy' | 'partner' | 'other';
export type OrganizationStatus = 'active' | 'archived';
export type MembershipRole = 'platform_admin' | 'organization_admin' | 'advisor' | 'client_manager' | 'employer_admin' | 'viewer';
export type MembershipStatus = 'active' | 'invited' | 'suspended';
export type RelationshipType = 'advisor' | 'consultant' | 'broker' | 'internal';

export type OrganizationCapability =
  | 'manage_clients'
  | 'create_assessments'
  | 'publish_assessments'
  | 'send_assessments'
  | 'view_reports'
  | 'edit_strategy_analysis'
  | 'approve_strategy_analysis'
  | 'manage_organization_playbook'
  | 'generate_ai_analysis'
  | 'manage_incentive_designs'
  | 'manage_organization_members'
  | 'access_admin_tools';

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

export type OrganizationMembershipRow = {
  id: string;
  organization_id: string;
  profile_id: string;
  role: MembershipRole;
  status: MembershipStatus;
  created_at: string;
  updated_at: string;
};

export type OrganizationClientRelationshipRow = {
  id: string;
  service_organization_id: string;
  client_organization_id: string;
  relationship_type: RelationshipType;
  status: OrganizationStatus;
  created_at: string;
  updated_at: string;
};

export type OrganizationRoleCapabilityRow = {
  id: string;
  role: string;
  capability: string;
};

export type ApprovedDomainRow = {
  id: string;
  domain: string;
  organization_name: string | null;
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
  organization_type: OrganizationType | null;
  status: OrganizationStatus;
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
  maximum_selections: number | null;
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
// Recommendation engine types
// ============================================================

export type RecommendationType = 'strength' | 'priority_opportunity' | 'quick_win' | 'high_impact_move' | 'meeting_question';
export type EffortLevel = 'low' | 'medium' | 'high';
export type ImpactLevel = 'low' | 'medium' | 'high';
export type FrameworkStatus = 'draft' | 'published' | 'retired';

export type RecommendationFrameworkRow = {
  id: string;
  name: string;
  version: string;
  status: FrameworkStatus;
  created_at: string;
  updated_at: string;
};

export type RecommendationRow = {
  id: string;
  framework_id: string;
  bank_id: string;
  title: string;
  description: string;
  strength_title: string | null;
  strength_description: string | null;
  recommendation_type: RecommendationType;
  dimension_key: string | null;
  driver_key: string | null;
  effort_level: EffortLevel | null;
  impact_level: ImpactLevel | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AssessmentResultRecommendationRow = {
  id: string;
  assessment_result_id: string;
  recommendation_id: string;
  priority_score: number;
  recommendation_type: RecommendationType;
  rationale_snapshot: string;
  title_snapshot: string;
  description_snapshot: string;
  strength_title_snapshot: string | null;
  strength_description_snapshot: string | null;
  dimension_key_snapshot: string | null;
  driver_key_snapshot: string | null;
  effort_level_snapshot: EffortLevel | null;
  impact_level_snapshot: ImpactLevel | null;
  display_order: number;
  created_at: string;
};

// ============================================================
// Composite / joined types for the service layer
// ============================================================

export type AssessmentTemplateWithVersion = AssessmentTemplateRow & {
  latest_version: AssessmentVersionRow | null;
  versions?: AssessmentVersionRow[];
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
      maximum_selections: number | null;
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

// ============================================================
// Strategy Analysis Workspace types
// ============================================================

export type WorkspaceStatus =
  | 'draft'
  | 'inputs_in_progress'
  | 'ready_for_analysis'
  | 'analysis_generated'
  | 'under_review'
  | 'approved'
  | 'finalized';

export type OutcomeGoalPriority = 'low' | 'medium' | 'high' | 'critical';
export type OutcomeGoalSourceType = 'analyst' | 'client_directed' | 'assessment_finding' | 'stakeholder_input';
export type DataQualityLevel = 'verified' | 'client_reported' | 'estimated' | 'incomplete' | 'unknown';
export type AnalysisNoteType =
  | 'organization_context'
  | 'analyst_observation'
  | 'specific_question'
  | 'key_consideration'
  | 'known_constraint'
  | 'client_priority'
  | 'implementation_history'
  | 'data_limitation'
  | 'follow_up';
export type AnalysisNoteVisibility = 'internal' | 'organization_team' | 'client_report_candidate';
export type AnalysisNoteImportance = 'low' | 'normal' | 'high' | 'critical';

export type AnalysisWorkspaceRow = {
  id: string;
  client_organization_id: string;
  assessment_instance_id: string;
  service_organization_id: string;
  created_by: string;
  assigned_to: string | null;
  title: string;
  status: WorkspaceStatus;
  created_at: string;
  updated_at: string;
};

export type AnalysisOutcomeGoalRow = {
  id: string;
  workspace_id: string;
  outcome_category: string;
  title: string;
  description: string | null;
  priority: OutcomeGoalPriority;
  target_population: string | null;
  desired_timeframe: string | null;
  source_type: OutcomeGoalSourceType;
  source_note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type AnalysisOutcomeMetricRow = {
  id: string;
  workspace_id: string;
  outcome_goal_id: string | null;
  metric_name: string;
  metric_category: string | null;
  current_value: string | null;
  target_value: string | null;
  unit: string | null;
  measurement_period: string | null;
  population_description: string | null;
  data_source: string | null;
  data_quality: DataQualityLevel;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AnalysisNoteRow = {
  id: string;
  workspace_id: string;
  note_type: AnalysisNoteType;
  title: string | null;
  content: string;
  visibility: AnalysisNoteVisibility;
  importance: AnalysisNoteImportance;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type WorkspaceWithDetails = AnalysisWorkspaceRow & {
  goals: AnalysisOutcomeGoalRow[];
  metrics: AnalysisOutcomeMetricRow[];
  notes: AnalysisNoteRow[];
  utilizationRecords: ProgramUtilizationRecordRow[];
  resourceGaps: AnalysisResourceGapRow[];
  evidenceSources: AnalysisEvidenceSourceRow[];
  assessment_instance?: Pick<AssessmentInstanceRow, 'id' | 'status' | 'overall_score' | 'primary_opportunity'> | null;
};

// ============================================================
// Programs, Utilization, Resource Gaps, Evidence Sources
// ============================================================

export type ProgramStatus = 'active' | 'paused' | 'discontinued' | 'planned';
export type ProgramSourceType = 'client_reported' | 'analyst_entered' | 'verified' | 'estimated';
export type UtilizationStatus = 'not_measured' | 'low' | 'moderate' | 'high' | 'unknown';
export type GapCategory = 'program_gap' | 'population_gap' | 'access_gap' | 'resource_gap' | 'data_gap' | 'other';
export type GapEvidenceSource = 'manual' | 'utilization_data' | 'assessment_finding' | 'client_input' | 'benchmark';
export type GapSeverity = 'low' | 'medium' | 'high' | 'critical';
export type GapConfidence = 'low' | 'medium' | 'high';
export type GapStatus = 'open' | 'confirmed' | 'addressed' | 'dismissed';
export type EvidenceSourceType = 'assessment_data' | 'utilization_report' | 'client_document' | 'benchmark_data' | 'stakeholder_interview' | 'third_party_report' | 'other';
export type VerificationStatus = 'unverified' | 'verified' | 'disputed';

export type ClientProgramRow = {
  id: string;
  client_organization_id: string;
  program_name: string;
  provider_name: string | null;
  program_category: string;
  description: string | null;
  target_population: string | null;
  eligibility_summary: string | null;
  access_method: string | null;
  communication_channels: string | null;
  incentive_connected: boolean;
  status: ProgramStatus;
  start_date: string | null;
  end_date: string | null;
  source_type: ProgramSourceType;
  source_note: string | null;
  created_at: string;
  updated_at: string;
};

export type ProgramUtilizationRecordRow = {
  id: string;
  workspace_id: string;
  client_program_id: string;
  measurement_start: string | null;
  measurement_end: string | null;
  eligible_population: number | null;
  registered_count: number | null;
  active_user_count: number | null;
  completion_count: number | null;
  utilization_rate: number | null;
  repeat_engagement_rate: number | null;
  benchmark_value: string | null;
  benchmark_source: string | null;
  utilization_status: UtilizationStatus;
  data_quality: DataQualityLevel;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AnalysisResourceGapRow = {
  id: string;
  workspace_id: string;
  gap_category: GapCategory;
  title: string;
  description: string;
  affected_population: string | null;
  evidence_source: GapEvidenceSource;
  severity: GapSeverity;
  confidence: GapConfidence;
  status: GapStatus;
  user_confirmed: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type AnalysisEvidenceSourceRow = {
  id: string;
  workspace_id: string;
  source_type: EvidenceSourceType;
  source_name: string;
  source_date: string | null;
  description: string | null;
  file_reference: string | null;
  verification_status: VerificationStatus;
  entered_by: string;
  created_at: string;
};

// ============================================================
// Analysis Input Snapshots & Readiness
// ============================================================

export type CompletenessLevel = 'not_ready' | 'limited' | 'sufficient' | 'strong';
export type ReadinessRequirementStatus = 'complete' | 'incomplete' | 'unavailable' | 'optional';

export type ReadinessRequirement = {
  key: string;
  label: string;
  status: ReadinessRequirementStatus;
  detail: string;
};

export type ReadinessEvaluation = {
  level: CompletenessLevel;
  requirements: ReadinessRequirement[];
  complete_count: number;
  total_required: number;
};

export type AnalysisInputSnapshotRow = {
  id: string;
  workspace_id: string;
  snapshot_version: number;
  input_json: Record<string, unknown>;
  completeness_level: CompletenessLevel;
  created_by: string;
  created_at: string;
};

export type CreateSnapshotResult = {
  snapshot_id: string;
  snapshot_version: number;
  completeness_level: CompletenessLevel;
};

// ============================================================
// Normalized snapshot input_json structure (for validation)
// ============================================================

export type SnapshotStrategyDimensionScore = {
  dimension: string;
  normalized_score: number | null;
  raw_score: number | null;
  answered_questions: number;
  possible_questions: number;
};

export type SnapshotBehavioralReadinessDriver = {
  score: number | null;
  label: string;
  interpretation: string;
};

export type SnapshotContextualResponse = {
  question: string;
  reporting_label: string | null;
  question_type: string;
  is_scored: boolean;
  selected_option: string | null;
  numeric_value: number | null;
  text_value: string | null;
  boolean_value: boolean | null;
  score_value: number | null;
};

export type SnapshotDiagnosticFinding = {
  tag: string;
  severity_threshold: number;
  question: string;
  reporting_label: string | null;
};

export type SnapshotRecommendation = {
  title: string;
  description: string;
  rationale: string;
  recommendation_type: string;
  dimension: string | null;
  driver: string | null;
  effort_level: string | null;
  impact_level: string | null;
  strength_title: string | null;
  strength_description: string | null;
  display_order: number;
};

export type SnapshotInputJson = {
  snapshot_version: number;
  workspace_title: string;
  workspace_status: string;
  client_organization: {
    name: string;
    type: string | null;
    industry: string | null;
    size_band: string | null;
    description: string | null;
  };
  assessment: {
    template_name: string | null;
    template_description: string | null;
    instance_status: string;
    submitted_at: string | null;
    overall_score: number | null;
    maturity_band: string | null;
    strategy_dimension_scores: SnapshotStrategyDimensionScore[];
    behavioral_readiness: Record<string, SnapshotBehavioralReadinessDriver>;
    contextual_responses: SnapshotContextualResponse[];
    diagnostic_findings: SnapshotDiagnosticFinding[];
    driver_mapping: unknown[];
  };
  recommendations: SnapshotRecommendation[];
  outcomes: unknown[];
  metrics: unknown[];
  programs: unknown[];
  utilization: unknown[];
  resource_gaps: unknown[];
  notes: unknown[];
  evidence_sources: unknown[];
  readiness: ReadinessEvaluation;
  created_at: string;
};

export type SnapshotStructureValidation = {
  valid: boolean;
  missingSections: string[];
  details: Record<string, boolean>;
};

// ============================================================
// AI Generation records (Phase 1A — governance only, no AI calls)
// ============================================================

export type GenerationType = 'strategy_poc';
export type GenerationStatus =
  | 'queued'
  | 'generating'
  | 'draft_generated'
  | 'failed'
  | 'approved'
  | 'rejected';

export type AnalysisGenerationRow = {
  id: string;
  workspace_id: string;
  snapshot_id: string;
  generation_type: GenerationType;
  status: GenerationStatus;
  model_name: string;
  prompt_version: string;
  input_snapshot_version: number;
  output_json: Record<string, unknown> | null;
  original_output_json: Record<string, unknown> | null;
  reviewed_output_json: Record<string, unknown> | null;
  review_status: string | null;
  rejection_reason: string | null;
  error_message: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  retrieval_metadata: Record<string, unknown> | null;
  knowledge_enabled: boolean;
  created_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type PropelKnowledgeCatalogRow = {
  id: string;
  openai_file_id: string;
  title: string;
  content_type: string;
  is_active: boolean;
  client_facing_eligible: boolean;
  created_at: string;
};

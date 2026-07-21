export const FEATURE_FLAGS = {
  ENABLE_CUSTOM_ASSESSMENTS: false,
  ENABLE_CUSTOM_ASSESSMENT_BUILDER: false,
  ENABLE_CUSTOM_ASSESSMENT_SENDING: false,
  ENABLE_PDF_REPORTS: false,
  ENABLE_PROPEL_STRATEGY_REVIEW: false,
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag];
}

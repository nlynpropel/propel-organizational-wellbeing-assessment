/**
 * Analytics event abstraction for the respondent assessment experience.
 *
 * Events are typed and logged to the console in development. In production,
 * this can be swapped for a real provider (PostHog, Mixpanel, etc.) by
 * replacing the `emit` implementation without touching call sites.
 *
 * Privacy: payloads never contain secure tokens, email addresses, respondent
 * names, organization names, question IDs, answer values, or free-text.
 */

export type AssessmentAnalyticsEvent =
  | { type: 'assessment_opened'; templateCategory: string }
  | { type: 'assessment_started'; templateCategory: string }
  | { type: 'section_completed'; sectionIndex: number; totalSections: number }
  | { type: 'assessment_resumed'; hadSavedResponses: boolean }
  | { type: 'assessment_submitted'; templateCategory: string }
  | { type: 'assessment_error'; errorCode: string };

type EmitFn = (event: AssessmentAnalyticsEvent) => void;

const consoleEmit: EmitFn = (event) => {
  if (import.meta.env.DEV) {
    console.info('[analytics]', event.type, event);
  }
};

let emitImpl: EmitFn = consoleEmit;

export function setAnalyticsEmitter(fn: EmitFn): void {
  emitImpl = fn;
}

export function track(event: AssessmentAnalyticsEvent): void {
  emitImpl(event);
}

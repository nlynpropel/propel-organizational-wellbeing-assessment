/**
 * Analytics event abstraction for the respondent assessment experience.
 *
 * Events are typed and logged to the console in development. In production,
 * this can be swapped for a real provider (PostHog, Mixpanel, etc.) by
 * replacing the `emit` implementation without touching call sites.
 */

export type AssessmentAnalyticsEvent =
  | { type: 'assessment_opened'; token: string; templateName: string }
  | { type: 'assessment_started'; token: string; templateName: string }
  | { type: 'question_answered'; token: string; questionId: string; questionType: string }
  | { type: 'section_navigated'; token: string; sectionIndex: number; direction: 'next' | 'prev' }
  | { type: 'review_opened'; token: string; answeredCount: number; totalCount: number }
  | { type: 'assessment_submitted'; token: string; templateName: string }
  | { type: 'assessment_error'; token: string; error: string };

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

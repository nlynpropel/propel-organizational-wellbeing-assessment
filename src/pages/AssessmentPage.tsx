import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ListChecks } from 'lucide-react';
import {
  resolveAssessmentByToken,
  submitResponseByToken,
  finalizeSubmissionByToken,
} from '../services/assessmentBuilder';
import type { ResolvedAssessment, AssessmentResultRow, SavedResponse } from '../lib/database.types';
import { track } from '../lib/analytics';
import PublicAssessmentLayout from '../components/respondent/PublicAssessmentLayout';
import AssessmentIntroduction from '../components/respondent/AssessmentIntroduction';
import AssessmentProgress from '../components/respondent/AssessmentProgress';
import AssessmentSection from '../components/respondent/AssessmentSection';
import AssessmentReview from '../components/respondent/AssessmentReview';
import AssessmentCompletion from '../components/respondent/AssessmentCompletion';
import AssessmentAccessError from '../components/respondent/AssessmentAccessError';
import SaveStatus, { type SaveState } from '../components/respondent/SaveStatus';
import Button from '../components/ui/Button';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import type { ResponseUpdate } from '../components/respondent/questionTypes';
import ParticipationOpportunityResults from '../components/respondent/ParticipationOpportunityResults';

type Phase = 'loading' | 'intro' | 'section' | 'review' | 'submitting' | 'complete' | 'error';

export default function AssessmentPage() {
  const { token } = useParams<{ token: string }>();
  const [assessment, setAssessment] = useState<ResolvedAssessment | null>(null);
  const [responses, setResponses] = useState<SavedResponse[]>([]);
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<{ message: string; status?: string } | null>(null);
  const [result, setResult] = useState<AssessmentResultRow | null>(null);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [hasStarted, setHasStarted] = useState(false);

  const pendingSaves = useRef<Map<string, ResponseUpdate>>(new Map());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAssessment = useCallback(async () => {
    if (!token) return;
    setPhase('loading');
    try {
      const data = await resolveAssessmentByToken(token);
      if ('error' in data) {
        setAccessError({ message: data.error, status: data.status });
        setPhase('error');
        track({ type: 'assessment_error', errorCode: data.status || 'access_error' });
        return;
      }
      setAssessment(data);
      setResponses(data.responses || []);
      track({ type: 'assessment_opened', templateCategory: data.template.category || 'uncategorized' });

      if (data.instance.status === 'submitted') {
        setAccessError({ message: 'This assessment has already been submitted.', status: 'submitted' });
        setPhase('error');
        return;
      }
      if (data.responses.length > 0 || data.instance.status === 'in_progress') {
        setHasStarted(true);
        setPhase('section');
        track({ type: 'assessment_resumed', hadSavedResponses: data.responses.length > 0 });
      } else {
        setPhase('intro');
      }
    } catch (err) {
      console.error('[AssessmentPage.load] Failed to load assessment:', err);
      const msg = err instanceof Error ? err.message : 'Failed to load assessment';
      setError(msg);
      setPhase('error');
      track({ type: 'assessment_error', errorCode: 'load_failed' });
    }
  }, [token]);

  useEffect(() => {
    loadAssessment();
  }, [loadAssessment]);

  const flushSaves = useCallback(async () => {
    if (!token || pendingSaves.current.size === 0) return;
    setSaveState('saving');
    const entries = Array.from(pendingSaves.current.entries());
    pendingSaves.current.clear();
    try {
      await Promise.all(
        entries.map(([, update]) =>
          submitResponseByToken({
            token,
            questionId: update.question_id,
            selectedOptionId: update.selected_option_id,
            numericValue: update.numeric_value,
            textValue: update.text_value,
            booleanValue: update.boolean_value,
          })
        )
      );
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch {
      setSaveState('error');
      entries.forEach(([, update]) => pendingSaves.current.set(update.question_id, update));
    }
  }, [token]);

  const scheduleSave = useCallback(
    (update: ResponseUpdate) => {
      pendingSaves.current.set(update.question_id, update);

      setResponses((prev) => {
        const existing = prev.find((r) => r.question_id === update.question_id);
        const updated: SavedResponse = {
          question_id: update.question_id,
          selected_option_id: update.selected_option_id,
          text_value: update.text_value,
          numeric_value: update.numeric_value,
          boolean_value: update.boolean_value,
        };
        if (existing) {
          return prev.map((r) => (r.question_id === update.question_id ? updated : r));
        }
        return [...prev, updated];
      });

      if (assessment) {
        // No per-question analytics event — privacy by design.
      }

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => flushSaves(), 800);
    },
    [assessment, flushSaves]
  );

  const handleStart = () => {
    if (!assessment) return;
    setHasStarted(true);
    setPhase('section');
    track({ type: 'assessment_started', templateCategory: assessment.template.category || 'uncategorized' });
  };

  const handleNext = () => {
    if (!assessment) return;
    if (sectionIndex < assessment.sections.length - 1) {
      setSectionIndex((i) => i + 1);
      track({ type: 'section_completed', sectionIndex, totalSections: assessment.sections.length });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      flushSaves().then(() => {
        setPhase('review');
      });
    }
  };

  const handlePrev = () => {
    if (sectionIndex > 0) {
      setSectionIndex((i) => i - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setPhase('intro');
    }
  };

  const handleSubmit = async () => {
    if (!token || !assessment) return;
    setPhase('submitting');
    try {
      await flushSaves();
      const res = await finalizeSubmissionByToken(token);
      setResult(res);
      setPhase('complete');
      track({ type: 'assessment_submitted', templateCategory: assessment.template.category || 'uncategorized' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit assessment';
      setError(msg);
      setPhase('error');
      track({ type: 'assessment_error', errorCode: 'submit_failed' });
    }
  };

  if (phase === 'loading') {
    return (
      <PublicAssessmentLayout organizationName={null}>
        <LoadingState label="Loading assessment…" />
      </PublicAssessmentLayout>
    );
  }

  if (phase === 'error' && accessError) {
    return (
      <PublicAssessmentLayout organizationName={assessment?.instance.organization_name ?? null}>
        <AssessmentAccessError message={accessError.message} status={accessError.status} />
      </PublicAssessmentLayout>
    );
  }

  if (phase === 'error' && error) {
    return (
      <PublicAssessmentLayout organizationName={assessment?.instance.organization_name ?? null}>
        <ErrorState message={error} onRetry={loadAssessment} />
      </PublicAssessmentLayout>
    );
  }

  if (!assessment) return null;

  if (phase === 'intro' || (!hasStarted && phase !== 'section')) {
    return (
      <PublicAssessmentLayout organizationName={assessment.instance.organization_name}>
        <AssessmentIntroduction assessment={assessment} onStart={handleStart} />
      </PublicAssessmentLayout>
    );
  }

if (phase === 'complete') {
    return (
      <PublicAssessmentLayout organizationName={assessment.instance.organization_name}>
        {assessment.version.scoring_method === 'category_weighted' ? (
          <ParticipationOpportunityResults token={token!} />
        ) : (
          <AssessmentCompletion assessment={assessment} result={result} />
        )}
      </PublicAssessmentLayout>
    );
  }

  if (phase === 'review' || phase === 'submitting') {
    return (
      <PublicAssessmentLayout organizationName={assessment.instance.organization_name}>
        <div className="bg-white rounded-lg shadow-md border border-neutral-border p-8">
          <AssessmentReview
            assessment={{ ...assessment, responses }}
            onBack={() => setPhase('section')}
            onSubmit={handleSubmit}
            submitting={phase === 'submitting'}
          />
        </div>
      </PublicAssessmentLayout>
    );
  }

  // Section view
  const section = assessment.sections[sectionIndex];
  if (!section) return null;

  return (
    <PublicAssessmentLayout organizationName={assessment.instance.organization_name}>
      <div className="bg-white rounded-lg shadow-md border border-neutral-border p-8">
        <AssessmentProgress
          current={sectionIndex + 1}
          total={assessment.sections.length}
          label={section.title}
        />
        <AssessmentSection section={section} responses={responses} onResponse={scheduleSave} />
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-neutral-border-soft">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={handlePrev}>
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </div>
          <div className="flex items-center gap-4">
            <SaveStatus state={saveState} />
            <Button onClick={handleNext}>
              {sectionIndex < assessment.sections.length - 1 ? 'Continue' : 'Review'}
              {sectionIndex < assessment.sections.length - 1 ? (
                <ArrowRight className="w-4 h-4" />
              ) : (
                <ListChecks className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </PublicAssessmentLayout>
  );
}

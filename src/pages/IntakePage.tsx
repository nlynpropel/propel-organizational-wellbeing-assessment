import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ListChecks, Building2, Mail, Hash, Briefcase, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  resolveReusableLink,
  createIntakeSubmission,
  submitReusableAssessment,
} from '../services/reusableLinks';
import {
  validateEmployeeCount,
  normalizeEmail,
  isPublicEmailDomain,
  isValidEmailFormat,
} from '../lib/validation';
import PublicAssessmentLayout from '../components/respondent/PublicAssessmentLayout';
import AssessmentIntroduction from '../components/respondent/AssessmentIntroduction';
import AssessmentProgress from '../components/respondent/AssessmentProgress';
import AssessmentSection from '../components/respondent/AssessmentSection';
import AssessmentReview from '../components/respondent/AssessmentReview';
import AssessmentAccessError from '../components/respondent/AssessmentAccessError';
import ParticipationOpportunityResults from '../components/respondent/ParticipationOpportunityResults';
import Button from '../components/ui/Button';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import type { ResolvedReusableLink } from '../lib/database.types';
import type { ResponseUpdate } from '../components/respondent/questionTypes';

type Phase = 'loading' | 'intake' | 'intro' | 'section' | 'review' | 'submitting' | 'complete' | 'error';

type IntakeForm = {
  organization_name: string;
  contact_name: string;
  email: string;
  employee_count: string;
  industry: string;
};

const INDUSTRIES = [
  'Manufacturing', 'Public Sector', 'Healthcare', 'Financial Services',
  'Transportation', 'Education', 'Technology', 'Retail', 'Other',
];

const initialForm: IntakeForm = {
  organization_name: '',
  contact_name: '',
  email: '',
  employee_count: '',
  industry: '',
};

export default function IntakePage() {
  const { token } = useParams<{ token: string }>();
  const [phase, setPhase] = useState<Phase>('loading');
  const [assessment, setAssessment] = useState<ResolvedReusableLink | null>(null);
  const [resultToken, setResultToken] = useState<string | null>(null);
  const [intakeError, setIntakeError] = useState<string | null>(null);
  const [form, setForm] = useState<IntakeForm>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof IntakeForm, string>>>({});
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [responses, setResponses] = useState<Array<{ question_id: string; selected_option_id?: string | null; numeric_value?: number | null; text_value?: string | null; boolean_value?: boolean | null }>>([]);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);

  const loadLink = useCallback(async () => {
    if (!token) return;
    setPhase('loading');
    try {
      const data = await resolveReusableLink(token);
      if ('error' in data) {
        setAccessError(data.error);
        setPhase('error');
        return;
      }
      setAssessment(data);
      setPhase('intake');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load assessment';
      setError(msg);
      setPhase('error');
    }
  }, [token]);

  useEffect(() => {
    loadLink();
  }, [loadLink]);

  const validateIntake = (): boolean => {
    const e: Partial<Record<keyof IntakeForm, string>> = {};

    if (!form.organization_name.trim()) e.organization_name = 'Organization name is required.';
    if (!form.contact_name.trim()) e.contact_name = 'Contact name is required.';

    if (!form.email.trim()) {
      e.email = 'Work email is required.';
    } else if (!isValidEmailFormat(form.email)) {
      e.email = 'Please enter a valid email address.';
    } else if (isPublicEmailDomain(form.email)) {
      e.email = 'A work email is required. Public email domains (Gmail, Yahoo, Outlook, Hotmail, iCloud, AOL) are not accepted.';
    }

    const empVal = validateEmployeeCount(form.employee_count);
    if (!empVal.valid) e.employee_count = empVal.error;

    if (!form.industry) e.industry = 'Industry is required.';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleIntakeSubmit = async () => {
    if (!token || !validateIntake()) return;
    setIntakeError(null);
    setPhase('loading');
    try {
      const result = await createIntakeSubmission({
        token,
        orgName: form.organization_name.trim(),
        contactName: form.contact_name.trim(),
        email: normalizeEmail(form.email),
        employeeCount: parseInt(form.employee_count, 10),
        industry: form.industry,
      });

      if ('error' in result) {
        setIntakeError(result.error);
        setPhase('intake');
        return;
      }

      setSubmissionId(result.submission_id);
      setPhase('intro');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit intake form';
      setIntakeError(msg);
      setPhase('intake');
    }
  };

  const handleStart = () => {
    setPhase('section');
  };

  const handleResponse = (update: ResponseUpdate) => {
    setResponses((prev) => {
      const existing = prev.find((r) => r.question_id === update.question_id);
      const updated = {
        question_id: update.question_id,
        selected_option_id: update.selected_option_id ?? null,
        numeric_value: update.numeric_value ?? null,
        text_value: update.text_value ?? null,
        boolean_value: update.boolean_value ?? null,
      };
      if (existing) {
        return prev.map((r) => (r.question_id === update.question_id ? updated : r));
      }
      return [...prev, updated];
    });
  };

  const handleNext = () => {
    if (!assessment) return;
    if (sectionIndex < assessment.sections.length - 1) {
      setSectionIndex((i) => i + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setPhase('review');
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
    if (!token || !submissionId || !assessment) return;
    setPhase('submitting');
    try {
      const result = await submitReusableAssessment({
        token,
        submissionId,
        responses,
      });

      if ('error' in result) {
        setError(result.error);
        setPhase('error');
        return;
      }

      setResultToken(result.secure_token);
      setPhase('complete');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit assessment';
      setError(msg);
      setPhase('error');
    }
  };

  if (phase === 'loading') {
    return (
      <PublicAssessmentLayout organizationName={null}>
        <LoadingState label="Loading…" />
      </PublicAssessmentLayout>
    );
  }

  if (phase === 'error' && accessError) {
    return (
      <PublicAssessmentLayout organizationName={null}>
        <AssessmentAccessError message={accessError} />
      </PublicAssessmentLayout>
    );
  }

  if (phase === 'error' && error) {
    return (
      <PublicAssessmentLayout organizationName={null}>
        <ErrorState message={error} onRetry={loadLink} />
      </PublicAssessmentLayout>
    );
  }

  if (!assessment) return null;

  // Intake form phase
  if (phase === 'intake') {
    return (
      <PublicAssessmentLayout organizationName={null}>
        <div className="bg-white rounded-lg shadow-md border border-neutral-border p-8 max-w-2xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-navy mb-2">{assessment.template_name}</h1>
            {assessment.template_short_description && (
              <p className="text-sm text-neutral-secondary">{assessment.template_short_description}</p>
            )}
          </div>

          <div className="rounded-md bg-navy/5 border border-navy/10 px-4 py-3 mb-6">
            <p className="text-sm text-navy">
              Before you begin, please provide some information about your organization.
              A <strong>work email</strong> is required — public email domains (Gmail, Yahoo, etc.) are not accepted.
            </p>
          </div>

          {intakeError && (
            <div className="rounded-md bg-red/5 border border-red/20 px-4 py-3 mb-4">
              <p className="text-sm text-red flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {intakeError}
              </p>
            </div>
          )}

          <div className="space-y-4">
            <IntakeField icon={Building2} label="Organization name *" error={errors.organization_name}>
              <input
                type="text"
                value={form.organization_name}
                onChange={(e) => setForm({ ...form, organization_name: e.target.value })}
                className={inputCls(!!errors.organization_name)}
                placeholder="Acme Corporation"
              />
            </IntakeField>

            <IntakeField icon={Mail} label="Contact name *" error={errors.contact_name}>
              <input
                type="text"
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                className={inputCls(!!errors.contact_name)}
                placeholder="Jane Smith"
              />
            </IntakeField>

            <IntakeField icon={Mail} label="Work email *" error={errors.email}>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputCls(!!errors.email)}
                placeholder="jane@acme.com"
              />
              {errors.email && errors.email.includes('work email') && !errors.email.includes('valid') && (
                <p className="text-xs text-neutral-muted mt-1">
                  We use your work email to associate your assessment with the correct organization.
                </p>
              )}
            </IntakeField>

            <IntakeField icon={Hash} label="Employee count *" error={errors.employee_count}>
              <input
                type="number"
                min={1}
                step={1}
                value={form.employee_count}
                onChange={(e) => setForm({ ...form, employee_count: e.target.value })}
                className={inputCls(!!errors.employee_count)}
                placeholder="250"
              />
            </IntakeField>

            <IntakeField icon={Briefcase} label="Industry *" error={errors.industry}>
              <select
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                className={inputCls(!!errors.industry)}
              >
                <option value="">Select an industry</option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </IntakeField>

          </div>

          <div className="flex items-center justify-end mt-8 pt-6 border-t border-neutral-border-soft">
            <Button variant="primary" onClick={handleIntakeSubmit}>
              Continue to Assessment <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </PublicAssessmentLayout>
    );
  }

  // Intro phase
  if (phase === 'intro') {
    return (
      <PublicAssessmentLayout organizationName={form.organization_name}>
        <AssessmentIntroduction
          assessment={{
            template: {
              name: assessment.template_name,
              short_description: assessment.template_short_description,
              full_description: assessment.template_full_description,
              category: assessment.template_category,
              estimated_minutes: assessment.template_estimated_minutes,
            } as never,
            version: {
              version_number: assessment.version_number,
              version_label: assessment.version_label,
              respondent_intro_text: assessment.introduction_text,
              completion_message: assessment.completion_message,
            } as never,
            sections: assessment.sections as never,
            instance: { organization_name: form.organization_name } as never,
            responses: [],
          }}
          onStart={handleStart}
        />
      </PublicAssessmentLayout>
    );
  }

  // Complete phase
  if (phase === 'complete') {
    if (assessment.template_respondent_result_mode === 'instant_result' && resultToken) {
      return (
        <PublicAssessmentLayout organizationName={form.organization_name}>
          <ParticipationOpportunityResults token={resultToken} />
        </PublicAssessmentLayout>
      );
    }
    return (
      <PublicAssessmentLayout organizationName={form.organization_name}>
        <div className="bg-white rounded-lg shadow-md border border-neutral-border p-8 max-w-2xl mx-auto text-center">
          <div className="w-14 h-14 rounded-full bg-green-tint flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-green-dark" />
          </div>
          <h1 className="text-2xl font-bold text-navy mb-2">Assessment Submitted</h1>
          <p className="text-sm text-neutral-secondary">
            Thank you for completing the {assessment.template_name}. Your responses have been submitted successfully.
          </p>
        </div>
      </PublicAssessmentLayout>
    );
  }

  // Review / submitting phase
  if (phase === 'review' || phase === 'submitting') {
    return (
      <PublicAssessmentLayout organizationName={form.organization_name}>
        <div className="bg-white rounded-lg shadow-md border border-neutral-border p-8">
          <AssessmentReview
            assessment={{
              template: { name: assessment.template_name } as never,
              sections: assessment.sections as never,
              responses,
            } as never}
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
    <PublicAssessmentLayout organizationName={form.organization_name}>
      <div className="bg-white rounded-lg shadow-md border border-neutral-border p-8">
        <AssessmentProgress
          current={sectionIndex + 1}
          total={assessment.sections.length}
          label={section.title}
        />
        <AssessmentSection
          section={section as never}
          responses={responses.map((r) => ({
            question_id: r.question_id,
            selected_option_id: r.selected_option_id ?? null,
            text_value: r.text_value ?? null,
            numeric_value: r.numeric_value ?? null,
            boolean_value: r.boolean_value ?? null,
          })) as never}
          onResponse={handleResponse}
        />
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-neutral-border-soft">
          <Button variant="ghost" onClick={handlePrev}>
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
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
    </PublicAssessmentLayout>
  );
}

function inputCls(hasError: boolean): string {
  return `w-full px-3 py-2 rounded-sm border bg-white text-navy text-sm focus:outline-none focus:ring-1 focus:ring-green/20 ${
    hasError ? 'border-red' : 'border-neutral-border focus:border-green'
  }`;
}

function IntakeField({
  icon: Icon,
  label,
  error,
  children,
}: {
  icon: typeof Building2;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-medium text-navy mb-1.5">
        <Icon className="w-4 h-4 text-neutral-muted" />
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-red mt-1">{error}</p>}
    </div>
  );
}
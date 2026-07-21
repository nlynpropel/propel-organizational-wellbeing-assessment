import { Check, AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import Button from '../ui/Button';
import type { ResolvedAssessment } from '../../lib/database.types';
import { isAnswered, getSavedResponse, type QuestionData } from './questionTypes';

export default function AssessmentReview({
  assessment,
  onBack,
  onSubmit,
  submitting,
}: {
  assessment: ResolvedAssessment;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const allQuestions = assessment.sections.flatMap((s) =>
    s.questions.map((q) => ({
      sectionTitle: s.title,
      question: {
        id: q.id,
        question_text: q.question_text,
        help_text: q.help_text,
        question_type: q.question_type,
        is_required: q.is_required,
        options: q.options,
      } as QuestionData,
    }))
  );

  const requiredQuestions = allQuestions.filter((q) => q.question.is_required && q.question.question_type !== 'information');
  const answeredCount = requiredQuestions.filter((q) =>
    isAnswered(q.question, getSavedResponse(assessment.responses, q.question.id))
  ).length;
  const unansweredCount = requiredQuestions.length - answeredCount;
  const allAnswered = unansweredCount === 0;

  return (
    <div>
      <h2 className="text-xl font-semibold text-navy">Review your answers</h2>
      <p className="text-sm text-neutral-secondary mt-2 leading-relaxed">
        Please review your responses before submitting. You can go back to change any answer.
      </p>

      <div className={`rounded-md border p-4 mt-5 ${allAnswered ? 'bg-green-tint border-green/30' : 'bg-orange-tint border-orange/30'}`}>
        <div className="flex items-center gap-2">
          {allAnswered ? (
            <Check className="w-4 h-4 text-green-dark" />
          ) : (
            <AlertCircle className="w-4 h-4 text-orange" />
          )}
          <p className={`text-sm font-medium ${allAnswered ? 'text-green-dark' : 'text-orange'}`}>
            {allAnswered
              ? 'All required questions answered'
              : `${unansweredCount} required question${unansweredCount !== 1 ? 's' : ''} unanswered`}
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {assessment.sections.map((section) => {
          const sectionQuestions = section.questions.filter(
            (q) => q.question_type !== 'information'
          );
          if (sectionQuestions.length === 0) return null;
          return (
            <div key={section.id} className="rounded-md border border-neutral-border bg-white">
              <div className="px-4 py-3 border-b border-neutral-border-soft">
                <p className="text-xs font-medium text-neutral-muted uppercase tracking-wide">
                  {section.title}
                </p>
              </div>
              <div className="divide-y divide-neutral-border-soft">
                {sectionQuestions.map((q) => {
                  const response = getSavedResponse(assessment.responses, q.id);
                  const answered = isAnswered(
                    {
                      id: q.id,
                      question_text: q.question_text,
                      help_text: q.help_text,
                      question_type: q.question_type,
                      is_required: q.is_required,
                      options: q.options,
                    },
                    response
                  );
                  return (
                    <div key={q.id} className="px-4 py-3 flex items-start gap-3">
                      {answered ? (
                        <Check className="w-4 h-4 text-green-dark shrink-0 mt-0.5" />
                      ) : q.is_required ? (
                        <AlertCircle className="w-4 h-4 text-orange shrink-0 mt-0.5" />
                      ) : (
                        <div className="w-4 h-4 shrink-0 mt-0.5" />
                      )}
                      <p className="text-sm text-navy leading-relaxed flex-1">
                        {q.question_text}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-8">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <Button onClick={onSubmit} disabled={!allAnswered || submitting}>
          {submitting ? 'Submitting…' : 'Submit Assessment'}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

import type { AssessmentSectionWithQuestions } from '../../lib/database.types';
import { getQuestionTypeMeta } from '../../lib/assessmentScoring';

export default function AssessmentPreview({
  sections,
  introductionText,
  completionMessage,
  templateName,
}: {
  sections: AssessmentSectionWithQuestions[];
  introductionText?: string | null;
  completionMessage?: string | null;
  templateName: string;
}) {
  return (
    <div className="rounded-md border border-neutral-border bg-neutral-bg/20 p-6 max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
        <div>
          <h3 className="text-xl font-semibold text-navy">{templateName}</h3>
          {introductionText && <p className="text-sm text-neutral-secondary mt-2">{introductionText}</p>}
        </div>

        {sections.map((section, si) => (
          <div key={section.id || si} className="space-y-4">
            <div className="border-b border-neutral-border-soft pb-2">
              <h4 className="text-base font-semibold text-navy">
                {si + 1}. {section.title}
              </h4>
              {section.description && (
                <p className="text-sm text-neutral-secondary mt-1">{section.description}</p>
              )}
            </div>

            {section.questions.length === 0 ? (
              <p className="text-sm text-neutral-muted italic">No questions in this section.</p>
            ) : (
              section.questions.map((question, qi) => {
                const meta = getQuestionTypeMeta(question.question_type);
                return (
                  <div key={question.id || qi} className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-sm font-medium text-navy mt-0.5">{qi + 1}.</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-navy">
                          {question.question_text || <span className="text-neutral-muted italic">Untitled question</span>}
                          {question.is_required && <span className="text-red ml-1">*</span>}
                        </p>
                        {question.help_text && (
                          <p className="text-xs text-neutral-muted mt-0.5">{question.help_text}</p>
                        )}
                        {meta && (
                          <p className="text-xs text-neutral-muted mt-0.5 italic">{meta.label}</p>
                        )}
                      </div>
                    </div>

                    {question.options.length > 0 && (
                      <div className="pl-6 space-y-1">
                        {question.options.map((opt, oi) => (
                          <div key={opt.id || oi} className="flex items-center gap-2 text-sm text-neutral-secondary">
                            <span className="w-4 h-4 rounded-full border border-neutral-border" />
                            {opt.option_label || <span className="italic text-neutral-muted">Untitled option</span>}
                            {opt.is_not_applicable && <span className="text-xs text-blue">(N/A)</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {question.question_type === 'long_text' && (
                      <div className="pl-6">
                        <div className="w-full h-16 rounded-sm border border-neutral-border bg-neutral-bg/30" />
                      </div>
                    )}
                    {question.question_type === 'short_text' && (
                      <div className="pl-6">
                        <div className="w-full h-8 rounded-sm border border-neutral-border bg-neutral-bg/30" />
                      </div>
                    )}
                    {question.question_type === 'numeric_rating' && (
                      <div className="pl-6">
                        <div className="flex gap-1 flex-wrap">
                          {Array.from(
                            { length: Math.ceil((question.numeric_rating_max_value - question.numeric_rating_min_value) / question.numeric_rating_step_value) + 1 },
                            (_, i) => question.numeric_rating_min_value + i * question.numeric_rating_step_value
                          ).map((n, ni) => (
                            <span key={ni} className="w-8 h-8 rounded-sm border border-neutral-border bg-neutral-bg/30 flex items-center justify-center text-xs text-neutral-muted">
                              {n}
                            </span>
                          ))}
                        </div>
                        <div className="flex justify-between mt-1 text-xs text-neutral-muted">
                          <span>{question.numeric_rating_min_label || question.numeric_rating_min_value}</span>
                          <span>{question.numeric_rating_max_label || question.numeric_rating_max_value}</span>
                        </div>
                      </div>
                    )}
                    {question.question_type === 'numeric_input' && (
                      <div className="pl-6">
                        <div className="w-24 h-8 rounded-sm border border-neutral-border bg-neutral-bg/30" />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ))}

        {completionMessage && (
          <div className="rounded-md bg-green-tint border border-green/20 p-4">
            <p className="text-sm text-green-dark">{completionMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}

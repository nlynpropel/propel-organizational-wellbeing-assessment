import type { ResolvedAssessment } from '../../lib/database.types';
import type { ResponseUpdate, QuestionData } from './questionTypes';
import QuestionRenderer from './QuestionRenderer';
import { getSavedResponse } from './questionTypes';

export type SectionData = NonNullable<ResolvedAssessment['sections'][number]>;

export default function AssessmentSection({
  section,
  responses,
  onResponse,
}: {
  section: SectionData;
  responses: ResolvedAssessment['responses'];
  onResponse: (update: ResponseUpdate) => void;
}) {
  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-navy">{section.title}</h2>
      {section.description && (
        <p className="text-sm text-neutral-secondary mt-2 leading-relaxed">{section.description}</p>
      )}
      <div className="mt-6 space-y-8">
        {section.questions.map((q) => {
          const questionData: QuestionData = {
            id: q.id,
            question_text: q.question_text,
            help_text: q.help_text,
            question_type: q.question_type,
            is_required: q.is_required,
            options: q.options,
            numeric_rating: {
              min_value: q.numeric_rating_min_value,
              max_value: q.numeric_rating_max_value,
              step_value: q.numeric_rating_step_value,
              min_label: q.numeric_rating_min_label,
              max_label: q.numeric_rating_max_label,
            },
            maximum_selections: q.maximum_selections,
          };
          return (
            <QuestionRenderer
              key={q.id}
              question={questionData}
              response={getSavedResponse(responses, q.id)}
              onChange={onResponse}
            />
          );
        })}
      </div>
    </div>
  );
}

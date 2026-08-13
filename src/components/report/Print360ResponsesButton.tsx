import { Printer } from 'lucide-react';
import type { ReportData } from '../../services/reportData';
import type { AssessmentResponseRow, AssessmentSectionWithQuestions } from '../../lib/database.types';
import Button from '../ui/Button';

function resolveResponseValue(
  question: AssessmentSectionWithQuestions['questions'][number],
  response: AssessmentResponseRow | undefined
): string {
  if (!response) return 'No response';

  if (question.question_type === 'multi_select') {
    const raw = response.text_value;
    if (!raw) return 'No response';

    let ids: string[] = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        ids = parsed.filter((value): value is string => typeof value === 'string' && value.length > 0);
      }
    } catch {
      ids = raw.split(',').map((value) => value.trim()).filter(Boolean);
    }

    const labels = ids
      .map((id) => question.options.find((option) => option.id === id)?.option_label)
      .filter((label): label is string => Boolean(label));

    return labels.length > 0 ? labels.join(', ') : raw;
  }

  if (response.selected_option_id) {
    return question.options.find((option) => option.id === response.selected_option_id)?.option_label ?? 'Selected option';
  }

  if (response.text_value?.trim()) return response.text_value.trim();
  if (response.numeric_value !== null && response.numeric_value !== undefined) return String(response.numeric_value);
  if (response.boolean_value !== null && response.boolean_value !== undefined) return response.boolean_value ? 'Yes' : 'No';

  return 'No response';
}

export default function Print360ResponsesButton({ report }: { report: ReportData }) {
  const { instance, template, organization, sections, responses } = report;
  const responseMap = new Map(responses.map((response) => [response.question_id, response]));
  const submittedDate = instance.submitted_at
    ? new Date(instance.submitted_at).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="w-4 h-4" />
        Print Responses
      </Button>

      <style>{`
        .print-360-responses { display: none; }
        @media print {
          body * { visibility: hidden !important; }
          .print-360-responses, .print-360-responses * { visibility: visible !important; }
          .print-360-responses {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            color: #031c40;
            background: white;
            font-family: Arial, Helvetica, sans-serif;
            line-height: 1.45;
          }
          .print-360-section { break-inside: avoid-page; margin-bottom: 24px; }
          .print-360-item { break-inside: avoid; }
          @page { margin: 0.55in; }
        }
      `}</style>

      <div className="print-360-responses">
        <div style={{ borderBottom: '3px solid #031c40', paddingBottom: 16, marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px' }}>
            {template?.name ?? '360 Engagement Assessment'}
          </h1>
          <p style={{ fontSize: 13, margin: '2px 0' }}><strong>Organization:</strong> {organization?.organization_name ?? '—'}</p>
          <p style={{ fontSize: 13, margin: '2px 0' }}><strong>Respondent:</strong> {instance.respondent_name ?? instance.respondent_email ?? '—'}</p>
          {instance.respondent_name && instance.respondent_email && (
            <p style={{ fontSize: 13, margin: '2px 0' }}><strong>Email:</strong> {instance.respondent_email}</p>
          )}
          <p style={{ fontSize: 13, margin: '2px 0' }}><strong>Submitted:</strong> {submittedDate}</p>
        </div>

        {[...sections]
          .sort((a, b) => a.display_order - b.display_order)
          .map((section) => (
            <section key={section.id} className="print-360-section">
              <h2 style={{ fontSize: 16, fontWeight: 700, borderBottom: '1px solid #d9dee7', paddingBottom: 6, marginBottom: 10 }}>
                {section.title}
              </h2>
              {[...section.questions]
                .sort((a, b) => a.display_order - b.display_order)
                .map((question) => {
                  const answer = resolveResponseValue(question, responseMap.get(question.id));
                  return (
                    <div key={question.id} className="print-360-item" style={{ padding: '9px 0 11px', borderBottom: '1px solid #edf0f4' }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#596579', margin: '0 0 5px' }}>{question.question_text}</p>
                      <p style={{ fontSize: 14, whiteSpace: 'pre-wrap', margin: 0, color: answer === 'No response' ? '#8a94a4' : '#031c40', fontStyle: answer === 'No response' ? 'italic' : 'normal' }}>
                        {answer}
                      </p>
                    </div>
                  );
                })}
            </section>
          ))}

        <p style={{ fontSize: 10, color: '#8a94a4', marginTop: 28 }}>
          Submitted assessment responses only. AI analysis is intentionally excluded from this printout.
        </p>
      </div>
    </>
  );
}

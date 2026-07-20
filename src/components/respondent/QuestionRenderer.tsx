import { Check, Info } from 'lucide-react';
import type { ResponseUpdate, QuestionData } from './questionTypes';
import type { SavedResponse } from '../../lib/database.types';

type Props = {
  question: QuestionData;
  response: SavedResponse | undefined;
  onChange: (update: ResponseUpdate) => void;
};

const baseOptionClasses =
  'flex items-center gap-3 rounded-md border px-4 py-3 cursor-pointer transition-all duration-150 text-sm';
const unselectedClasses = 'border-neutral-border bg-white hover:border-navy/30 hover:bg-navy/[0.02]';
const selectedClasses = 'border-navy bg-navy/[0.04] ring-1 ring-navy/20';

function OptionButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${baseOptionClasses} ${selected ? selectedClasses : unselectedClasses} w-full text-left`}
    >
      <span
        className={`flex items-center justify-center w-5 h-5 rounded-full border shrink-0 transition-colors ${
          selected ? 'border-navy bg-navy' : 'border-neutral-border bg-white'
        }`}
      >
        {selected && <Check className="w-3 h-3 text-white" />}
      </span>
      <span className="font-medium text-navy">{label}</span>
    </button>
  );
}

function OptionGrid({
  question,
  response,
  onChange,
  multi = false,
}: {
  question: QuestionData;
  response: SavedResponse | undefined;
  onChange: (update: ResponseUpdate) => void;
  multi?: boolean;
}) {
  const selectedId = response?.selected_option_id ?? null;

  const handleSingle = (optionId: string) => {
    onChange({
      question_id: question.id,
      selected_option_id: optionId,
      text_value: null,
      numeric_value: null,
      boolean_value: null,
    });
  };

  if (!multi) {
    return (
      <div className="space-y-2">
        {question.options.map((opt) => (
          <OptionButton
            key={opt.id}
            label={opt.option_label}
            selected={selectedId === opt.id}
            onClick={() => handleSingle(opt.id)}
          />
        ))}
      </div>
    );
  }

  // multi_select: store selected IDs in text_value as comma-separated
  const selectedIds = response?.text_value
    ? response.text_value.split(',').filter(Boolean)
    : [];

  const handleMulti = (optionId: string) => {
    const next = selectedIds.includes(optionId)
      ? selectedIds.filter((id) => id !== optionId)
      : [...selectedIds, optionId];
    onChange({
      question_id: question.id,
      selected_option_id: null,
      text_value: next.join(','),
      numeric_value: null,
      boolean_value: null,
    });
  };

  return (
    <div className="space-y-2">
      {question.options.map((opt) => {
        const selected = selectedIds.includes(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => handleMulti(opt.id)}
            className={`${baseOptionClasses} ${selected ? selectedClasses : unselectedClasses} w-full text-left`}
          >
            <span
              className={`flex items-center justify-center w-5 h-5 rounded border shrink-0 transition-colors ${
                selected ? 'border-navy bg-navy' : 'border-neutral-border bg-white'
              }`}
            >
              {selected && <Check className="w-3 h-3 text-white" />}
            </span>
            <span className="font-medium text-navy">{opt.option_label}</span>
          </button>
        );
      })}
    </div>
  );
}

function TextInput({
  question,
  response,
  onChange,
  multiline = false,
  type = 'text',
}: {
  question: QuestionData;
  response: SavedResponse | undefined;
  onChange: (update: ResponseUpdate) => void;
  multiline?: boolean;
  type?: string;
}) {
  const value = response?.text_value ?? '';

  const handleChange = (val: string) => {
    onChange({
      question_id: question.id,
      selected_option_id: null,
      text_value: val || null,
      numeric_value: null,
      boolean_value: null,
    });
  };

  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        rows={4}
        placeholder="Type your answer…"
        className="w-full rounded-md border border-neutral-border px-4 py-3 text-sm text-navy placeholder:text-neutral-muted focus:outline-none focus:ring-2 focus:ring-green/40 focus:border-green resize-y"
      />
    );
  }

  return (
    <input
      type={type}
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      placeholder="Type your answer…"
      className="w-full rounded-md border border-neutral-border px-4 py-3 text-sm text-navy placeholder:text-neutral-muted focus:outline-none focus:ring-2 focus:ring-green/40 focus:border-green"
    />
  );
}

function NumericRating({
  question,
  response,
  onChange,
}: {
  question: QuestionData;
  response: SavedResponse | undefined;
  onChange: (update: ResponseUpdate) => void;
}) {
  const max = 10;
  const current = response?.numeric_value ?? null;

  return (
    <div>
      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() =>
              onChange({
                question_id: question.id,
                selected_option_id: null,
                text_value: null,
                numeric_value: n,
                boolean_value: null,
              })
            }
            className={`w-10 h-10 rounded-md border text-sm font-medium transition-all ${
              current === n
                ? 'border-navy bg-navy text-white'
                : 'border-neutral-border bg-white text-navy hover:border-navy/30 hover:bg-navy/[0.02]'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-xs text-neutral-muted">
        <span>1 = Low</span>
        <span>{max} = High</span>
      </div>
    </div>
  );
}

function NumericInput({
  question,
  response,
  onChange,
}: {
  question: QuestionData;
  response: SavedResponse | undefined;
  onChange: (update: ResponseUpdate) => void;
}) {
  const value = response?.numeric_value ?? '';

  return (
    <input
      type="number"
      value={value}
      onChange={(e) => {
        const val = e.target.value;
        onChange({
          question_id: question.id,
          selected_option_id: null,
          text_value: null,
          numeric_value: val === '' ? null : Number(val),
          boolean_value: null,
        });
      }}
      placeholder="Enter a number"
      className="w-full max-w-xs rounded-md border border-neutral-border px-4 py-3 text-sm text-navy placeholder:text-neutral-muted focus:outline-none focus:ring-2 focus:ring-green/40 focus:border-green"
    />
  );
}

function YesNo({
  question,
  response,
  onChange,
}: {
  question: QuestionData;
  response: SavedResponse | undefined;
  onChange: (update: ResponseUpdate) => void;
}) {
  const value = response?.boolean_value ?? null;

  return (
    <div className="flex gap-3">
      {[
        { label: 'Yes', val: true },
        { label: 'No', val: false },
      ].map((opt) => (
        <button
          key={opt.label}
          type="button"
          onClick={() =>
            onChange({
              question_id: question.id,
              selected_option_id: null,
              text_value: null,
              numeric_value: null,
              boolean_value: opt.val,
            })
          }
          className={`flex-1 rounded-md border px-4 py-3 text-sm font-medium transition-all ${
            value === opt.val
              ? 'border-navy bg-navy text-white'
              : 'border-neutral-border bg-white text-navy hover:border-navy/30 hover:bg-navy/[0.02]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Information({ question }: { question: QuestionData }) {
  return (
    <div className="rounded-md bg-blue-tint border border-blue/20 p-4 flex gap-3">
      <Info className="w-5 h-5 text-blue shrink-0 mt-0.5" />
      <p className="text-sm text-blue leading-relaxed">{question.question_text}</p>
    </div>
  );
}

export default function QuestionRenderer({ question, response, onChange }: Props) {
  const showLabel = question.question_type !== 'information';

  return (
    <div>
      {showLabel && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-navy leading-relaxed">
            {question.question_text}
            {question.is_required && <span className="text-red ml-1">*</span>}
          </label>
          {question.help_text && (
            <p className="text-xs text-neutral-muted mt-1.5 leading-relaxed">{question.help_text}</p>
          )}
        </div>
      )}

      {(() => {
        switch (question.question_type) {
          case 'agreement5':
          case 'frequency5':
          case 'maturity5':
          case 'single_select':
          case 'custom_scored':
            return <OptionGrid question={question} response={response} onChange={onChange} />;
          case 'multi_select':
            return <OptionGrid question={question} response={response} onChange={onChange} multi />;
          case 'yes_no':
            return <YesNo question={question} response={response} onChange={onChange} />;
          case 'numeric_rating':
            return <NumericRating question={question} response={response} onChange={onChange} />;
          case 'numeric_input':
            return <NumericInput question={question} response={response} onChange={onChange} />;
          case 'short_text':
            return <TextInput question={question} response={response} onChange={onChange} />;
          case 'long_text':
            return <TextInput question={question} response={response} onChange={onChange} multiline />;
          case 'date':
            return <TextInput question={question} response={response} onChange={onChange} type="date" />;
          case 'information':
            return <Information question={question} />;
          default:
            return <p className="text-sm text-neutral-muted">Unsupported question type.</p>;
        }
      })()}
    </div>
  );
}

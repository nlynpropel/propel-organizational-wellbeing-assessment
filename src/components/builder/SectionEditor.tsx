import { ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react';
import WeightInput from './WeightInput';
import ScoringToggle from './ScoringToggle';

export type DraftSection = {
  id?: string;
  title: string;
  description: string;
  display_order: number;
  weight: number;
  is_scored: boolean;
};

export default function SectionEditor({
  sections,
  onChange,
  onAdd,
  disabled,
}: {
  sections: DraftSection[];
  onChange: (sections: DraftSection[]) => void;
  onAdd: () => void;
  disabled?: boolean;
}) {
  const updateSection = (index: number, updates: Partial<DraftSection>) => {
    onChange(sections.map((s, i) => i === index ? { ...s, ...updates } : s));
  };

  const removeSection = (index: number) => {
    onChange(sections.filter((_, i) => i !== index));
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= sections.length) return;
    const reordered = [...sections];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    onChange(reordered.map((s, i) => ({ ...s, display_order: i })));
  };

  return (
    <div className="space-y-3">
      {sections.map((section, i) => (
        <div key={i} className="rounded-md border border-neutral-border bg-neutral-bg/30 p-4">
          <div className="flex items-start gap-3">
            <div className="flex flex-col gap-0.5 pt-1">
              <button
                type="button"
                onClick={() => moveSection(i, -1)}
                disabled={disabled || i === 0}
                className="text-neutral-muted hover:text-navy disabled:opacity-30"
                aria-label="Move section up"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => moveSection(i, 1)}
                disabled={disabled || i === sections.length - 1}
                className="text-neutral-muted hover:text-navy disabled:opacity-30"
                aria-label="Move section down"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 space-y-3">
              <input
                type="text"
                value={section.title}
                onChange={(e) => updateSection(i, { title: e.target.value })}
                placeholder="Section title"
                disabled={disabled}
                className="w-full px-3 py-2 rounded-sm border border-neutral-border bg-white text-navy font-medium focus:outline-none focus:border-green focus:ring-1 focus:ring-green/20"
              />
              <textarea
                value={section.description}
                onChange={(e) => updateSection(i, { description: e.target.value })}
                placeholder="Section description (optional)"
                disabled={disabled}
                rows={2}
                className="w-full px-3 py-2 rounded-sm border border-neutral-border bg-white text-navy text-sm focus:outline-none focus:border-green focus:ring-1 focus:ring-green/20"
              />
              <div className="flex items-center gap-4">
                <WeightInput
                  value={section.weight}
                  onChange={(v) => updateSection(i, { weight: v })}
                  disabled={disabled}
                  label="Section weight"
                />
                <ScoringToggle
                  checked={section.is_scored}
                  onChange={(v) => updateSection(i, { is_scored: v })}
                  disabled={disabled}
                  label="Scored section"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeSection(i)}
              disabled={disabled}
              className="p-1.5 text-neutral-muted hover:text-red disabled:opacity-30"
              aria-label="Remove section"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        className="flex items-center gap-1.5 text-sm text-green-dark hover:text-green font-medium disabled:opacity-60"
      >
        <Plus className="w-4 h-4" />
        Add section
      </button>
    </div>
  );
}

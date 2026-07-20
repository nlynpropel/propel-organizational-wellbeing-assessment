import type { ScoreBand } from '../../lib/assessmentScoring';

export default function ScoreBandEditor({
  bands,
  onChange,
  disabled,
}: {
  bands: ScoreBand[];
  onChange: (bands: ScoreBand[]) => void;
  disabled?: boolean;
}) {
  const updateBand = (index: number, updates: Partial<ScoreBand>) => {
    onChange(bands.map((b, i) => i === index ? { ...b, ...updates } : b));
  };

  const addBand = () => {
    const nextOrder = bands.length > 0 ? Math.max(...bands.map((b) => b.display_order)) + 1 : 0;
    onChange([...bands, { band_name: '', min_threshold: 0, max_threshold: 0, display_order: nextOrder }]);
  };

  const removeBand = (index: number) => {
    onChange(bands.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-navy">Score bands</label>
      <p className="text-xs text-neutral-muted">
        Define custom band names and thresholds. If left empty, defaults are used
        (Reactive 0-39, Developing 40-59, Established 60-74, Strategic 75-89, Leading 90-100).
      </p>
      {bands.map((band, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={band.band_name}
            onChange={(e) => updateBand(i, { band_name: e.target.value })}
            placeholder="Band name"
            disabled={disabled}
            className="flex-1 px-3 py-1.5 rounded-sm border border-neutral-border bg-white text-navy text-sm focus:outline-none focus:border-green focus:ring-1 focus:ring-green/20"
          />
          <input
            type="number"
            value={band.min_threshold}
            onChange={(e) => updateBand(i, { min_threshold: Number(e.target.value) })}
            placeholder="Min"
            disabled={disabled}
            min="0"
            max="100"
            className="w-16 px-2 py-1.5 rounded-sm border border-neutral-border bg-white text-navy text-sm focus:outline-none focus:border-green focus:ring-1 focus:ring-green/20"
            aria-label="Minimum threshold"
          />
          <span className="text-neutral-muted text-sm">–</span>
          <input
            type="number"
            value={band.max_threshold}
            onChange={(e) => updateBand(i, { max_threshold: Number(e.target.value) })}
            placeholder="Max"
            disabled={disabled}
            min="0"
            max="100"
            className="w-16 px-2 py-1.5 rounded-sm border border-neutral-border bg-white text-navy text-sm focus:outline-none focus:border-green focus:ring-1 focus:ring-green/20"
            aria-label="Maximum threshold"
          />
          <button
            type="button"
            onClick={() => removeBand(i)}
            disabled={disabled}
            className="p-1 text-neutral-muted hover:text-red disabled:opacity-30"
            aria-label="Remove band"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addBand}
        disabled={disabled}
        className="text-sm text-green-dark hover:text-green font-medium disabled:opacity-60"
      >
        + Add band
      </button>
    </div>
  );
}

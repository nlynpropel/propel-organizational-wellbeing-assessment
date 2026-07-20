export default function WeightInput({
  value,
  onChange,
  disabled,
  label = 'Weight',
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-neutral-muted mb-1">{label}</label>
      <input
        type="number"
        step="0.1"
        min="0"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-20 px-2 py-1.5 rounded-sm border border-neutral-border bg-white text-navy text-sm focus:outline-none focus:border-green focus:ring-1 focus:ring-green/20"
      />
    </div>
  );
}

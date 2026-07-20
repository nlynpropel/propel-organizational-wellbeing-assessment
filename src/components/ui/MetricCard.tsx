import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

type MetricColor = 'navy' | 'green' | 'orange' | 'blue' | 'teal';

const accentClasses: Record<MetricColor, string> = {
  navy: 'text-navy',
  green: 'text-green-dark',
  orange: 'text-orange',
  blue: 'text-blue',
  teal: 'text-teal',
};

export default function MetricCard({
  label,
  value,
  color = 'navy',
  hint,
  to,
}: {
  label: string;
  value: number | string;
  color?: MetricColor;
  hint?: string;
  to?: string;
}) {
  const content = (
    <div className="bg-white border border-neutral-border rounded-lg p-5 shadow-sm hover:border-neutral-border/80 hover:shadow-md transition flex flex-col h-full">
      <span className="eyebrow">{label}</span>
      <span className={`font-mono font-bold text-3xl mt-2 ${accentClasses[color]} tabular-nums`}>
        {value}
      </span>
      {hint && <span className="text-xs text-neutral-muted mt-1.5">{hint}</span>}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block h-full">
        {content}
      </Link>
    );
  }
  return content;
}

export function MetricCardArrow({ label }: { label: string }) {
  return <ArrowUpRight className="w-4 h-4 text-neutral-muted" aria-label={label} />;
}

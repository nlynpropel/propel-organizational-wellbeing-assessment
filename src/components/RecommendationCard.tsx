import { Flag, Star, Target } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Recommendation } from '../types';

const kindIcon: Record<Recommendation['kind'], LucideIcon> = {
  flag: Flag,
  star: Star,
  target: Target,
  strategy: Target,
};

const kindColor: Record<Recommendation['kind'], string> = {
  flag: 'text-orange bg-orange-tint',
  star: 'text-green-dark bg-green-tint',
  target: 'text-blue bg-blue-tint',
  strategy: 'text-blue bg-blue-tint',
};

const tierLabel: Record<Recommendation['tier'], string> = {
  'Quick Win': 'QUICK WIN',
  'High-Impact Move': 'HIGH-IMPACT MOVE',
};

export default function RecommendationCard({ rec }: { rec: Recommendation }) {
  const Icon = kindIcon[rec.kind];

  return (
    <div className="rounded-md border border-neutral-border bg-white p-4 hover:border-navy/15 hover:shadow-sm transition">
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${kindColor[rec.kind]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="eyebrow text-orange">{tierLabel[rec.tier]}</span>
          <p className="text-sm text-navy mt-1 leading-snug">{rec.title}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-neutral-muted">
            <span>{rec.dimension}</span>
            {rec.effort && <span>· {rec.effort}</span>}
            {rec.impact && <span>· {rec.impact}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

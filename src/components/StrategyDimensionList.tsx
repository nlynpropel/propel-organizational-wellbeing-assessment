import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import ScoreBar from './ui/ScoreBar';
import type { StrategyDimension } from '../types';

export default function StrategyDimensionList({
  dimensions,
}: {
  dimensions: StrategyDimension[];
}) {
  return (
    <div className="space-y-4">
      {dimensions.map((d) => (
        <div key={d.name} className="group">
          <div className="flex items-center justify-between mb-1">
            <Link
              to="#"
              onClick={(e) => e.preventDefault()}
              className="text-sm font-medium text-navy group-hover:text-navy-mid transition flex items-center gap-1"
            >
              {d.name}
              <ArrowUpRight className="w-3.5 h-3.5 text-neutral-muted opacity-0 group-hover:opacity-100 transition" />
            </Link>
            <span className="font-mono text-sm font-bold text-navy tabular-nums">
              {d.score}
              <span className="text-neutral-muted font-normal text-xs">/100</span>
            </span>
          </div>
          <ScoreBar score={d.score} max={100} showValue={false} size="md" />
        </div>
      ))}
    </div>
  );
}

import { scoreColor } from '../lib/scores';
import type { BehavioralDriver } from '../types';

export default function BehavioralReadinessList({
  drivers,
}: {
  drivers: BehavioralDriver[];
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {drivers.map((d) => {
        const color = scoreColor(d.score);
        return (
          <div key={d.name} className="rounded-md border border-neutral-border p-4 bg-neutral-bg/50">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-sm font-medium text-navy">{d.name}</span>
              <span className="font-mono text-lg font-bold tabular-nums" style={{ color }}>
                {d.score}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${d.score}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

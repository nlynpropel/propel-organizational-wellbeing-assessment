import type { MaturityClass } from '../types';

export const MATURITY_BANDS: { min: number; max: number; label: MaturityClass }[] = [
  { min: 0, max: 39, label: 'Reactive' },
  { min: 40, max: 59, label: 'Developing' },
  { min: 60, max: 74, label: 'Established' },
  { min: 75, max: 89, label: 'Strategic' },
  { min: 90, max: 100, label: 'Leading' },
];

export function maturityClass(score: number): MaturityClass {
  const band = MATURITY_BANDS.find((b) => score >= b.min && score <= b.max);
  return band?.label ?? 'Reactive';
}

export function maturityBadgeVariant(
  label: MaturityClass
): 'neutral' | 'info' | 'progress' | 'success' | 'warning' | 'danger' {
  switch (label) {
    case 'Reactive':
      return 'danger';
    case 'Developing':
      return 'warning';
    case 'Established':
      return 'progress';
    case 'Strategic':
      return 'info';
    case 'Leading':
      return 'success';
  }
}

export function scoreColor(score: number): string {
  if (score >= 75) return '#6ea83c';
  if (score >= 60) return '#8bc64e';
  if (score >= 40) return '#a9cd76';
  return '#c23b2f';
}

export function scorePositionPercent(score: number): number {
  return Math.max(0, Math.min(100, score));
}

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
  if (score >= 90) return '#3d7a1f';
  if (score >= 75) return '#6ea83c';
  if (score >= 60) return '#e89149';
  if (score >= 40) return '#5a6b8a';
  return '#3d4a5e';
}

export function maturityColor(label: number | string): string {
  const l = typeof label === 'number' ? String(label) : label;
  switch (l) {
    case 'Reactive': return '#3d4a5e';
    case 'Developing': return '#5a6b8a';
    case 'Established': return '#e89149';
    case 'Strategic': return '#6ea83c';
    case 'Leading': return '#3d7a1f';
    default: return '#6ea83c';
  }
}

export function behavioralColor(score: number | string): string {
  const s = typeof score === 'number' ? score : Number(score);
  if (s >= 80) return '#3d7a1f';
  if (s >= 65) return '#6ea83c';
  if (s >= 50) return '#e89149';
  return '#5a6b8a';
}

export function scorePositionPercent(score: number): number {
  return Math.max(0, Math.min(100, score));
}

import type { ReactNode } from 'react';

type Variant = 'neutral' | 'info' | 'progress' | 'success' | 'warning' | 'danger';

const variantClasses: Record<Variant, string> = {
  neutral: 'bg-neutral-bg text-neutral-secondary border-neutral-border',
  info: 'bg-blue-tint text-blue border-blue/20',
  progress: 'bg-green-tint text-green-dark border-green/25',
  success: 'bg-teal-tint text-teal border-teal/20',
  warning: 'bg-orange-tint text-orange border-orange/25',
  danger: 'bg-red-tint text-red border-red/20',
};

const dotClasses: Record<Variant, string> = {
  neutral: 'bg-neutral-muted',
  info: 'bg-blue',
  progress: 'bg-green',
  success: 'bg-teal',
  warning: 'bg-orange',
  danger: 'bg-red',
};

export default function Badge({
  children,
  variant = 'neutral',
  dot = false,
  className = '',
}: {
  children: ReactNode;
  variant?: Variant;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold tracking-wide ${variantClasses[variant]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotClasses[variant]}`} />}
      {children}
    </span>
  );
}

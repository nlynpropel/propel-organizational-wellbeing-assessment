import type { ReactNode } from 'react';

export default function Card({
  children,
  className = '',
  padding = true,
}: {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}) {
  return (
    <div
      className={`bg-white border border-neutral-border rounded-lg shadow-sm ${padding ? 'p-5' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

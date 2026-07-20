import { Loader2 } from 'lucide-react';

export default function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="w-6 h-6 text-green animate-spin" />
      <p className="text-sm text-neutral-muted mt-3">{label}</p>
    </div>
  );
}

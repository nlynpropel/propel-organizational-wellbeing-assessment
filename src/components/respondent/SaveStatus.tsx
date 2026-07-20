import { Check, Loader2, AlertCircle } from 'lucide-react';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function SaveStatus({ state }: { state: SaveState }) {
  if (state === 'idle') return null;

  return (
    <div className="flex items-center gap-1.5 text-xs">
      {state === 'saving' && (
        <>
          <Loader2 className="w-3 h-3 text-neutral-muted animate-spin" />
          <span className="text-neutral-muted">Saving…</span>
        </>
      )}
      {state === 'saved' && (
        <>
          <Check className="w-3 h-3 text-green-dark" />
          <span className="text-green-dark">Saved</span>
        </>
      )}
      {state === 'error' && (
        <>
          <AlertCircle className="w-3 h-3 text-red" />
          <span className="text-red">Couldn&apos;t save</span>
        </>
      )}
    </div>
  );
}

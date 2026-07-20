import { AlertTriangle } from 'lucide-react';
import Button from './Button';

export default function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-lg border border-red/20 bg-red-tint px-5 py-4 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-red shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-red">Something went wrong</p>
        <p className="text-sm text-red/80 mt-0.5">{message}</p>
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}

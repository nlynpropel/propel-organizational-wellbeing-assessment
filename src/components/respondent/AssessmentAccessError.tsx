import { AlertTriangle, Clock, Ban } from 'lucide-react';

export default function AssessmentAccessError({
  message,
  status,
}: {
  message: string;
  status?: string;
}) {
  const icon =
    status === 'expired' ? <Clock className="w-8 h-8 text-orange" /> :
    status === 'submitted' ? <Ban className="w-8 h-8 text-neutral-muted" /> :
    <AlertTriangle className="w-8 h-8 text-red" />;

  const title =
    status === 'expired' ? 'Assessment expired' :
    status === 'submitted' ? 'Already submitted' :
    status === 'revoked' ? 'Assessment revoked' :
    'Assessment unavailable';

  return (
    <div className="bg-white rounded-lg shadow-md border border-neutral-border p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-neutral-bg flex items-center justify-center mx-auto">
        {icon}
      </div>
      <h1 className="text-xl font-semibold text-navy mt-5">{title}</h1>
      <p className="text-sm text-neutral-secondary mt-3 leading-relaxed max-w-md mx-auto">
        {message}
      </p>
      <p className="text-xs text-neutral-muted mt-6">
        Contact your broker if you believe this is an error.
      </p>
    </div>
  );
}

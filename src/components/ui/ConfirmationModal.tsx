import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import Button from './Button';

export default function ConfirmationModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  confirmDisabled,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/40 backdrop-blur-sm px-4">
      <div className="bg-white w-full max-w-md rounded-lg shadow-xl flex flex-col">
        <div className="px-6 py-5">
          <div className="flex items-start gap-3">
            {variant === 'danger' && (
              <div className="w-10 h-10 rounded-full bg-red-tint flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red" />
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold text-navy">{title}</h3>
              <div className="text-sm text-neutral-secondary mt-1.5">{message}</div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-border-soft">
          <Button variant="ghost" size="md" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={variant === 'danger' ? 'danger' : 'primary'} size="md" onClick={onConfirm} disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

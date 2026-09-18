import { useEffect, useId, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isLoading = false,
  destructive = true
}) {
  const confirmButtonRef = useRef(null);
  const dialogId = useId();

  useEffect(() => {
    if (!open) return undefined;

    confirmButtonRef.current?.focus();
    const handleKeyDown = event => {
      if (event.key === 'Escape' && !isLoading) onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, isLoading, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !isLoading) onCancel();
      }}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${dialogId}-title`}
        aria-describedby={`${dialogId}-description`}
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-danger-bg)] text-[var(--color-danger)]">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={`${dialogId}-title`} className="text-base font-semibold text-[var(--color-text)]">
              {title}
            </h2>
            <p id={`${dialogId}-description`} className="mt-1 text-sm leading-relaxed text-[var(--color-text-muted)]">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] disabled:opacity-50"
            aria-label="Close confirmation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={onCancel} disabled={isLoading} className="btn btn-outline flex-1">
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={destructive ? 'btn flex-1 bg-[var(--color-danger)] text-white hover:opacity-90' : 'btn btn-submit flex-1'}
          >
            {isLoading ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

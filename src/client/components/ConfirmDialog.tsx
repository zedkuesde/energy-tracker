import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  confirmBusyLabel?: string;
  busy?: boolean;
  errorMessage?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  confirmBusyLabel,
  busy = false,
  errorMessage,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
      const heading = dialog.querySelector('h2');
      heading?.focus();
    } else if (dialog.open) {
      dialog.close();
    }

    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  }, [open]);

  function requestClose() {
    if (busy) {
      return;
    }
    const dialog = dialogRef.current;
    if (dialog?.open) {
      dialog.close();
    }
    onCancel();
  }

  return (
    <dialog
      ref={dialogRef}
      className="app-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        if (busy) {
          event.preventDefault();
        }
      }}
      onClose={() => {
        onCancel();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || busy) {
          return;
        }
        event.preventDefault();
        requestClose();
      }}
    >
      <h2 id={titleId} className="dialog-title" tabIndex={-1}>
        {title}
      </h2>
      <div className="dialog-body">{children}</div>
      {errorMessage ? (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <div className="dialog-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={requestClose}
          disabled={busy}
        >
          Annuler
        </button>
        <button
          type="button"
          className="danger-button"
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? (confirmBusyLabel ?? confirmLabel) : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

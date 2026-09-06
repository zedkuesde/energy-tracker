import type { ReactNode } from 'react';

type StatusPanelProps = {
  children: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  tone?: 'empty' | 'error' | 'loading';
};

export function StatusPanel({
  children,
  actionLabel,
  onAction,
  actionDisabled = false,
  tone = 'empty',
}: StatusPanelProps) {
  const role =
    tone === 'error' ? 'alert' : tone === 'loading' ? 'status' : undefined;
  return (
    <div className={`empty-state empty-state-${tone}`} role={role}>
      {children}
      {actionLabel && onAction ? (
        <button
          type="button"
          className="secondary-button status-action"
          onClick={onAction}
          disabled={actionDisabled}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

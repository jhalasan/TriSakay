import { Button } from '../Button';
import { Textarea } from '../Textarea';
import styles from './ConfirmModal.module.css';

/** Wireframe screen 11 "Log out" — dimmed overlay over the current screen, Cancel / confirm. Reused for any destructive S+ confirmation. */
export interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
  /** Renders a required reason field (account_actions.reason is NOT NULL) and disables Confirm until it's filled in. */
  reasonRequired?: boolean;
  reason?: string;
  onReasonChange?: (value: string) => void;
  reasonLabel?: string;
  /** Disables + shows a loading state on the confirm button while the action is in flight. */
  confirmLoading?: boolean;
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  onConfirm,
  onCancel,
  reasonRequired = false,
  reason = '',
  onReasonChange,
  reasonLabel = 'Reason',
  confirmLoading = false,
}: ConfirmModalProps) {
  const reasonMissing = reasonRequired && !reason.trim();

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={title}>
      <div className={styles.card}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.message}>{message}</p>
        {reasonRequired && <Textarea label={reasonLabel} rows={3} value={reason} onChange={(e) => onReasonChange?.(e.target.value)} />}
        <div className={styles.actions}>
          <Button variant="outline" tone="neutral" onClick={onCancel} disabled={confirmLoading}>
            {cancelLabel}
          </Button>
          <Button variant="solid" tone={tone} onClick={onConfirm} disabled={reasonMissing} loading={confirmLoading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

import { Button } from '../Button';
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
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={title}>
      <div className={styles.card}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <Button variant="outline" tone="neutral" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="solid" tone={tone} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

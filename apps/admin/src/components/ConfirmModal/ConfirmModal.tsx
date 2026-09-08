import { useEffect, useRef } from 'react';
import { Button } from '../Button';
import { Textarea } from '../Textarea';
import styles from './ConfirmModal.module.css';

const FOCUSABLE_SELECTOR = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

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
  const cardRef = useRef<HTMLDivElement>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const card = cardRef.current;
    card?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancelRef.current();
        return;
      }
      if (e.key !== 'Tab' || !card) return;
      const focusable = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={title}>
      <div className={styles.card} ref={cardRef}>
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

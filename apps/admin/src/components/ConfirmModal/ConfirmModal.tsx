import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from '../Button';
import { Textarea } from '../Textarea';
import { ErrorBanner } from '../ErrorBanner';
import styles from './ConfirmModal.module.css';

const FOCUSABLE_SELECTOR = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * A "no entry" glyph for the small set of danger actions with real livelihood/access
 * consequences (Suspend driver, Block passenger, Disable PSO user) — passed via the
 * `icon` override at those specific call sites. Everything else stays on the plain
 * warning-triangle DefaultIcon below: the 2026-09 critique's Minor Observation was
 * that "revoke one session" and "suspend a driver's livelihood" looked visually
 * identical, not that every danger action needs its own icon.
 */
export function SevereIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M5.5 5.5 18.5 18.5" />
    </svg>
  );
}

/** Icon glyphs are tone-based defaults (§12 "red is spent only on the confirm button" — the tile itself never turns red), overridable per call site via `icon`. */
function DefaultIcon({ tone }: { tone: 'primary' | 'danger' }) {
  if (tone === 'danger') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3.5 21.5 20h-19L12 3.5Z" />
        <path d="M12 10v4" />
        <circle cx="12" cy="17" r="0.15" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15.5 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7.5a2 2 0 0 0 2-2v-2" />
      <path d="M9.5 12H21M21 12l-3-3M21 12l-3 3" />
    </svg>
  );
}

/** README §12 "Destructive confirm" — one shape for log out, suspend, block and delete: icon tile + title + consequence sentence, footer on --bg with Cancel + the tone's action button. */
export interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  /** Overrides the tone's default icon (log-out glyph for primary, warning triangle for danger). */
  icon?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  /** Renders a required reason field (account_actions.reason is NOT NULL) and disables Confirm until it's filled in. */
  reasonRequired?: boolean;
  reason?: string;
  onReasonChange?: (value: string) => void;
  reasonLabel?: string;
  /** Disables + shows a loading state on the confirm button while the action is in flight. */
  confirmLoading?: boolean;
  /** README §4a "submission-wide refusal" — keeps the modal open and shows the failure here instead of a page-top banner. */
  error?: string | null;
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  icon,
  onConfirm,
  onCancel,
  reasonRequired = false,
  reason = '',
  onReasonChange,
  reasonLabel = 'Reason',
  confirmLoading = false,
  error,
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
        <div className={styles.body}>
          <span className={`${styles.iconTile} ${tone === 'danger' ? styles.iconTileDanger : styles.iconTilePrimary}`}>
            {icon ?? <DefaultIcon tone={tone} />}
          </span>
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.message}>{message}</p>
          {reasonRequired && <Textarea label={reasonLabel} rows={3} value={reason} onChange={(e) => onReasonChange?.(e.target.value)} />}
          <ErrorBanner message={error} />
        </div>
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

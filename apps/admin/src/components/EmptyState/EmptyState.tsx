import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  /** The one heading line — "No account actions recorded yet." / "Couldn't load account actions." */
  message: string;
  /** Optional second, quieter line — support copy or the one-sentence cause. */
  hint?: string;
  /** 'danger' is README §12's "Page-level failure" — same dashed shape, a danger icon tile, and a Retry action. */
  tone?: 'neutral' | 'danger';
  /** e.g. a Retry button for the page-level-failure case. */
  action?: ReactNode;
  /** False for the plain "Select a record to…" workbench placeholders, which aren't an empty-table state. */
  icon?: boolean;
}

export function EmptyState({ message, hint, tone = 'neutral', action, icon = true }: EmptyStateProps) {
  return (
    <div className={styles.wrap}>
      {icon && <span className={`${styles.icon} ${tone === 'danger' ? styles.iconDanger : ''}`} aria-hidden="true" />}
      <span className={styles.message}>{message}</span>
      {hint && <span className={styles.hint}>{hint}</span>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}

import styles from './Badge.module.css';

/** Status pill — wireframe kit §Part 0 "Status badge" (.badge). Icon-free, monospace, uppercase-feel. */
export type BadgeTone = 'neutral' | 'success' | 'warn' | 'danger' | 'info';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
}

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{label}</span>;
}

import styles from './StatTile.module.css';

export type StatTileTone = 'primary' | 'success' | 'warn' | 'danger' | 'neutral';

/** Dashboard/Reports metric card. */
export interface StatTileProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: StatTileTone;
}

export function StatTile({ label, value, hint, tone = 'neutral' }: StatTileProps) {
  return (
    <div className={`${styles.tile} ${styles[tone]}`}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}

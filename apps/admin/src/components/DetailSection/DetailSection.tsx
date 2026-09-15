import type { ReactNode, SVGProps } from 'react';
import styles from './DetailSection.module.css';

export interface DetailField {
  label: string;
  value: ReactNode;
}

export interface DetailSectionProps {
  title: string;
  icon: (props: SVGProps<SVGSVGElement>) => ReactNode;
  fields: DetailField[];
}

/**
 * One labeled group inside a driver/passenger detail Modal — replaces the
 * flat, ungrouped `.field` list every "View" modal used before (2026-09-16
 * follow-up to the launch audit: "lacks information and the UI is so bland").
 * A 16px section icon plus a 2-column field grid; icons live on the section
 * header only, not per field, to keep the density product surfaces call for
 * without tipping into decoration.
 */
export function DetailSection({ title, icon: Icon, fields }: DetailSectionProps) {
  return (
    <div className={styles.section}>
      <div className={styles.heading}>
        <Icon className={styles.icon} />
        <span>{title}</span>
      </div>
      <div className={styles.grid}>
        {fields.map((f) => (
          <div className={styles.field} key={f.label}>
            <span className={styles.fieldLabel}>{f.label}</span>
            <span className={styles.fieldValue}>{f.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

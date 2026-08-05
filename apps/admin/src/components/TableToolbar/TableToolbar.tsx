import type { ReactNode } from 'react';
import { TextField } from '../TextField';
import styles from './TableToolbar.module.css';

/** Search + filter selects + an Export/action slot — sits above every wireframe list table. */
export interface TableToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  actions?: ReactNode;
}

export function TableToolbar({ search, onSearchChange, searchPlaceholder = 'Search…', filters, actions }: TableToolbarProps) {
  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <TextField
          aria-label="Search"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className={styles.search}
        />
        {filters}
      </div>
      {actions && <div className={styles.right}>{actions}</div>}
    </div>
  );
}

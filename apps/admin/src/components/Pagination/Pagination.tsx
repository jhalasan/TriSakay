import { Button } from '../Button';
import styles from './Pagination.module.css';

/** Wireframe pattern: "Prev  ·  1 / 8  ·  Next" on every list screen. */
export interface PaginationProps {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, pageCount, onChange }: PaginationProps) {
  const safeCount = Math.max(1, pageCount);
  return (
    <div className={styles.row}>
      <Button variant="outline" tone="neutral" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Prev
      </Button>
      <span className={styles.count}>
        {page} / {safeCount}
      </span>
      <Button
        variant="outline"
        tone="neutral"
        size="sm"
        disabled={page >= safeCount}
        onClick={() => onChange(page + 1)}
      >
        Next
      </Button>
    </div>
  );
}

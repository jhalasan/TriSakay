import { Button } from '../Button';
import styles from './Pagination.module.css';

/** README §05 footer pattern: "Previous  1  2  3  Next", current page a filled navy pill. */
export interface PaginationProps {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}

/** A sliding 3-wide window of page numbers around the current page, clamped to [1, pageCount]. */
function pageWindow(page: number, pageCount: number, size = 3): number[] {
  let start = Math.max(1, page - 1);
  const end = Math.min(pageCount, start + size - 1);
  start = Math.max(1, end - size + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function Pagination({ page, pageCount, onChange }: PaginationProps) {
  const safeCount = Math.max(1, pageCount);
  const safePage = Math.min(Math.max(1, page), safeCount);

  return (
    <div className={styles.row}>
      <Button variant="outline" tone="neutral" size="sm" disabled={safePage <= 1} onClick={() => onChange(safePage - 1)}>
        Previous
      </Button>
      {pageWindow(safePage, safeCount).map((n) => (
        <button
          key={n}
          type="button"
          className={`${styles.pageButton} ${n === safePage ? styles.pageButtonActive : ''}`}
          aria-current={n === safePage ? 'page' : undefined}
          onClick={() => onChange(n)}
        >
          {n}
        </button>
      ))}
      <Button variant="outline" tone="neutral" size="sm" disabled={safePage >= safeCount} onClick={() => onChange(safePage + 1)}>
        Next
      </Button>
    </div>
  );
}

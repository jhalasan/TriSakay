import { useMemo, useState, type ReactNode } from 'react';
import { EmptyState } from '../EmptyState';
import styles from './DataTable.module.css';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  align?: 'left' | 'right' | 'center';
  width?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  emptyMessage?: string;
  loading?: boolean;
}

/**
 * Generic sortable table — every wireframe list screen (Driver/Passenger
 * management, Complaints, Reports, PSO users) is one of these plus a
 * TableToolbar + Pagination. Wide tables scroll inside their own container
 * (`.scroll-x`, src/styles/globals.css) — the page body never scrolls
 * sideways.
 */
export function DataTable<T>({ columns, rows, getRowKey, emptyMessage = 'No records found.', loading = false }: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    const sortValue = col.sortValue;
    const sorted = [...rows].sort((a, b) => {
      const av = sortValue(a);
      const bv = sortValue(b);
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    });
    return sortDir === 'asc' ? sorted : sorted.reverse();
  }, [rows, sortKey, sortDir, columns]);

  function toggleSort(key: string) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
    } else {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    }
  }

  if (loading) {
    return <div className={styles.loading}>Loading…</div>;
  }

  if (rows.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <div className={`scroll-x ${styles.wrap}`}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ width: col.width, textAlign: col.align ?? 'left' }}
                className={col.sortValue ? styles.sortable : undefined}
                onClick={col.sortValue ? () => toggleSort(col.key) : undefined}
              >
                {col.header}
                {sortKey === col.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((col) => (
                <td key={col.key} style={{ textAlign: col.align ?? 'left' }}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

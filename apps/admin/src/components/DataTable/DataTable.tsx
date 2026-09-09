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
  /** Opt-in row-selection checkboxes (e.g. for bulk actions). Omit all three to render exactly as before. */
  selectedIds?: Set<string>;
  onToggleRow?: (id: string) => void;
  onToggleAll?: (checked: boolean) => void;
}

/**
 * Generic sortable table — every wireframe list screen (Driver/Passenger
 * management, Complaints, Reports, PSO users) is one of these plus a
 * TableToolbar + Pagination. Wide tables scroll inside their own container
 * (`.scroll-x`, src/styles/globals.css) — the page body never scrolls
 * sideways.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  emptyMessage = 'No records found.',
  loading = false,
  selectedIds,
  onToggleRow,
  onToggleAll,
}: DataTableProps<T>) {
  const selectable = selectedIds !== undefined && onToggleRow !== undefined && onToggleAll !== undefined;
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

  const allOnPageSelected = selectable && sortedRows.every((row) => selectedIds!.has(getRowKey(row)));

  return (
    <div className={`scroll-x ${styles.wrap}`}>
      <table className={styles.table}>
        <thead>
          <tr>
            {selectable && (
              <th style={{ width: 32 }}>
                <input
                  type="checkbox"
                  aria-label="Select all rows on this page"
                  checked={allOnPageSelected}
                  onChange={(e) => onToggleAll!(e.target.checked)}
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ width: col.width, textAlign: col.align ?? 'left' }}
                aria-sort={col.sortValue ? (sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
              >
                {col.sortValue ? (
                  <button type="button" className={styles.sortable} onClick={() => toggleSort(col.key)}>
                    {col.header}
                    {sortKey === col.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={getRowKey(row)}>
              {selectable && (
                <td>
                  <input
                    type="checkbox"
                    aria-label="Select row"
                    checked={selectedIds!.has(getRowKey(row))}
                    onChange={() => onToggleRow!(getRowKey(row))}
                  />
                </td>
              )}
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

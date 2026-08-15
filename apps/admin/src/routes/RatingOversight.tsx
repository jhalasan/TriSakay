import { useEffect } from 'react';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { RatingSquares } from '../components/RatingSquares';
import { useRatingOversightStore } from '../store/useRatingOversightStore';
import type { FlaggedLowRatingRow } from '../services/ratings';

const columns: DataTableColumn<FlaggedLowRatingRow>[] = [
  { key: 'name', header: 'Driver', sortValue: (d) => d.fullName, render: (d) => <span style={{ fontWeight: 600 }}>{d.fullName}</span> },
  {
    key: 'rating',
    header: 'Rating',
    sortValue: (d) => d.ratingAvg,
    render: (d) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <RatingSquares value={d.ratingAvg} />
        <span style={{ color: 'var(--ink-faint)', fontSize: 11 }}>{d.ratingAvg.toFixed(1)}</span>
      </div>
    ),
  },
  { key: 'count', header: 'Total Ratings', sortValue: (d) => d.ratingCount, render: (d) => d.ratingCount, align: 'right' },
];

/**
 * FR-10.3/10.4 — drivers with 5+ ratings averaging below the configured
 * low-rating threshold (system_settings.low_rating_threshold). Read-only:
 * there is no oversight action defined yet beyond surfacing the list for
 * PSO review (e.g. via Driver Management's own Flag/Suspend).
 */
export function RatingOversight() {
  const { drivers, loading, error, fetch } = useRatingOversightStore();

  useEffect(() => {
    fetch();
  }, [fetch]);

  return (
    <div className="page">
      {error && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--danger)',
            background: 'var(--danger-soft)',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--r-sm)',
            padding: 'var(--sp-sm)',
            marginBottom: 'var(--sp-sm)',
          }}
        >
          {error}
        </div>
      )}
      <DataTable columns={columns} rows={drivers} getRowKey={(d) => d.driverId} loading={loading} emptyMessage="No drivers currently flagged for a low rating." />
    </div>
  );
}

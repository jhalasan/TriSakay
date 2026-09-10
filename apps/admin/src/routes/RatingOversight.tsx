import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { RatingSquares } from '../components/RatingSquares';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { useRatingOversightStore } from '../store/useRatingOversightStore';
import { useSettingsStore } from '../store/useSettingsStore';
import type { FlaggedLowRatingRow } from '../services/ratings';
import { titleCaseLabel } from '../lib/format';
import styles from './RatingOversight.module.css';

const ACCOUNT_STATUS_TONE: Record<FlaggedLowRatingRow['accountStatus'], 'neutral' | 'success' | 'warn' | 'danger'> = {
  active: 'success',
  flagged: 'warn',
  suspended: 'danger',
  deactivated: 'neutral',
};

const MIN_RATINGS = 5; // v_flagged_low_ratings' own rating_count >= 5 floor (docs/SCHEMA.MD)

const columns: DataTableColumn<FlaggedLowRatingRow>[] = [
  { key: 'name', header: 'Driver', sortValue: (d) => d.fullName, render: (d) => <span style={{ fontWeight: 600 }}>{d.fullName}</span> },
  { key: 'plate', header: 'Tricycle', render: (d) => <span className="mono">{d.plateNo ?? '—'}</span> },
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
  { key: 'count', header: 'Ratings', sortValue: (d) => d.ratingCount, render: (d) => d.ratingCount, align: 'right' },
  { key: 'trips', header: 'Trips', sortValue: (d) => d.tripCount, render: (d) => d.tripCount, align: 'right' },
  { key: 'account', header: 'Account', render: (d) => <Badge label={titleCaseLabel(d.accountStatus)} tone={ACCOUNT_STATUS_TONE[d.accountStatus]} /> },
];

/**
 * FR-10.3/10.4 — drivers with 5+ ratings averaging below the configured
 * low-rating threshold (system_settings.low_rating_threshold). Read-only:
 * there is no oversight action defined yet beyond surfacing the list for
 * PSO review (e.g. via Driver Management's own Flag/Suspend), per README
 * §08's ghost "Open driver management" link — enforcement lives there, not
 * here.
 */
export function RatingOversight() {
  const { drivers, fleetAverage, loading, error, fetch } = useRatingOversightStore();
  const systemSettings = useSettingsStore((state) => state.systemSettings);
  const fetchSettings = useSettingsStore((state) => state.fetch);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    if (!systemSettings) fetchSettings();
  }, [systemSettings, fetchSettings]);

  if (error && drivers.length === 0 && !loading) {
    return (
      <div className="page">
        <EmptyState
          message="Couldn't load rating oversight."
          hint={error}
          tone="danger"
          action={
            <Button variant="outline" tone="neutral" size="sm" onClick={fetch}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="page">
      <div className={styles.split}>
        <div className="panel">
          <div className="pane-header">
            <h2 className="panel-title" style={{ marginBottom: 0 }}>
              Drivers below the rating threshold
            </h2>
            <Badge label={`${drivers.length} driver${drivers.length === 1 ? '' : 's'}`} tone="neutral" />
          </div>
          <DataTable
            columns={columns}
            rows={drivers}
            getRowKey={(d) => d.driverId}
            loading={loading}
            emptyMessage="No drivers currently flagged for a low rating."
            emptyHint="Good news — every driver is at or above the rating threshold."
          />
        </div>

        <div className="panel detail-panel">
          <h2 className="panel-title">How this list is built</h2>
          <p className={styles.explainer}>
            A driver appears here once they have at least {MIN_RATINGS} ratings and their average rating falls under the threshold set in
            System Settings. This list is read-only by design — the action lives in Driver Management, with a reason and an audit trail.
          </p>

          <div className="field">
            <span className="field-label">Threshold</span>
            <span>{systemSettings ? `${systemSettings.lowRatingThreshold.toFixed(1)}★` : '—'}</span>
          </div>
          <div className="field">
            <span className="field-label">Minimum ratings</span>
            <span>{MIN_RATINGS}</span>
          </div>
          <div className="field">
            <span className="field-label">Fleet average</span>
            <span>{fleetAverage != null ? `${fleetAverage.toFixed(1)}★` : '—'}</span>
          </div>

          <Link to="/drivers">
            <Button variant="ghost" tone="neutral" size="sm">
              Open driver management
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

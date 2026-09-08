import { useState } from 'react';
import { LiveMap } from '../components/LiveMap';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { getActiveTricycleLocations, listActiveTricycles, type ActiveTricycleLocationCell } from '../services/monitoring';
import { useAutoRefresh } from '../lib/useAutoRefresh';
import type { ActiveTricycleRow } from '../types/ride';
import styles from './RideMonitoring.module.css';

const REFRESH_MS = 15_000;

/**
 * Wireframe screen 6 "Ride monitoring" (FR-5.1, 5.2). Privacy-aware: only
 * coarse on-trip/idle state is shown here, never exact live coordinates
 * broadcast to unmatched parties (NFR-2.5) — this view is PSO oversight
 * only, distinct from the Passenger/Driver apps' own matched-pair map.
 */
export function RideMonitoring() {
  const [tricycles, setTricycles] = useState<ActiveTricycleRow[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [cells, setCells] = useState<ActiveTricycleLocationCell[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const { refresh, refreshing } = useAutoRefresh(async (isStale) => {
    const [tricyclesRes, cellsRes] = await Promise.all([listActiveTricycles(), getActiveTricycleLocations()]);
    if (isStale()) return;
    setTricycles(tricyclesRes.data);
    setListError(tricyclesRes.error);
    setCells(cellsRes.data);
    setMapError(cellsRes.error);
    setUpdatedAt(new Date());
    setInitialLoading(false);
  }, REFRESH_MS);

  return (
    <div className="page">
      <div className={styles.layout}>
        <div className="panel">
          <div className={styles.mapHeader}>
            <h2 className="panel-title" style={{ marginBottom: 0 }}>
              Active Tricycles
            </h2>
            <div className={styles.mapHeaderRight}>
              <Badge label={refreshing ? 'Updating…' : 'Live'} tone={listError || mapError ? 'danger' : 'success'} />
              <span className={styles.stamp} aria-live="polite">
                Updated {updatedAt ? updatedAt.toLocaleTimeString('en-PH', { hour12: false }) : '—'}
              </span>
              <Button size="sm" variant="outline" tone="neutral" onClick={refresh} disabled={refreshing}>
                Refresh
              </Button>
            </div>
          </div>
          {mapError && <div className="form-error">{mapError}</div>}
          <LiveMap cells={cells} loading={initialLoading} />
          <p className={styles.caption}>
            Locations shown are coarse and update only while a Driver is available or on an active trip — no continuous GPS trail is
            persisted (NFR-2.5).
          </p>
        </div>

        <div className={`panel ${styles.list}`}>
          <h2 className="panel-title">On the Clock</h2>
          {listError && <div className="form-error">{listError}</div>}
          {initialLoading && <div style={{ color: 'var(--ink-faint)', fontSize: 12 }}>Loading…</div>}
          {!initialLoading && tricycles.length === 0 && <EmptyState message="No tricycles on the clock right now." />}
          {tricycles.map((t) => (
            <div key={t.driverId} className={styles.row}>
              <Avatar fullName={t.driverFullName} size={28} />
              <div className={styles.rowInfo}>
                <div className={styles.rowName}>{t.driverFullName}</div>
                <div className={styles.rowPlate}>{t.plateNo}</div>
              </div>
              <Badge
                label={t.tripStatus === 'active' ? 'On Trip' : 'Idle'}
                tone={t.tripStatus === 'active' ? 'success' : 'neutral'}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

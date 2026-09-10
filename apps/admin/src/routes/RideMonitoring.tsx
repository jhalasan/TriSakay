import { useEffect, useState } from 'react';
import { LiveMap } from '../components/LiveMap';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Select } from '../components/Select';
import { EmptyState } from '../components/EmptyState';
import { getActiveTricycleLocations, listActiveTricycles, type ActiveTricycleLocationCell } from '../services/monitoring';
import { useAutoRefresh } from '../lib/useAutoRefresh';
import type { ActiveTricycleRow } from '../types/ride';
import { titleCaseLabel } from '../lib/format';
import styles from './RideMonitoring.module.css';

const REFRESH_MS = 15_000;

const CLUSTER_OPTIONS = [
  { label: 'All clusters', value: '' },
  { label: 'Red', value: 'red' },
  { label: 'White', value: 'white' },
  { label: 'Apple Green', value: 'apple_green' },
  { label: 'Melting Pot', value: 'melting_pot' },
];

/** "Updated Ns ago", ticking every second — the map/list data itself still only refreshes every REFRESH_MS. */
function secondsAgoLabel(date: Date | null): string {
  if (!date) return '—';
  const secs = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (secs < 1) return 'Updated just now';
  if (secs < 60) return `Updated ${secs} second${secs === 1 ? '' : 's'} ago`;
  const mins = Math.floor(secs / 60);
  return `Updated ${mins} minute${mins === 1 ? '' : 's'} ago`;
}

/**
 * Wireframe screen 6 "Ride monitoring" (FR-5.1, 5.2). Privacy-aware: only
 * coarse on-trip/idle state is shown here, never exact live coordinates
 * broadcast to unmatched parties (NFR-2.5) — this view is PSO oversight
 * only, distinct from the Passenger/Driver apps' own matched-pair map.
 *
 * The mock's map panel replaces this real Leaflet/OSM view with a static
 * illustration of named barangay cells, which isn't reproducible: the
 * `barangays` table carries no boundary geometry to resolve a GPS point to
 * a barangay, and the "Available" cell state it shows doesn't exist
 * alongside on-trip/idle in the data model. Kept the real, working map
 * (grid-snapped counted markers, per NFR-2.5) and restyled the surrounding
 * chrome instead — confirmed with product.
 */
export function RideMonitoring() {
  const [tricycles, setTricycles] = useState<ActiveTricycleRow[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [cells, setCells] = useState<ActiveTricycleLocationCell[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [cluster, setCluster] = useState('');
  const [, forceTick] = useState(0);

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

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const visibleTricycles = cluster ? tricycles.filter((t) => t.cluster === cluster) : tricycles;
  const onTripCount = visibleTricycles.filter((t) => t.tripStatus === 'active').length;

  return (
    <div className="page">
      <div className={styles.layout}>
        <div className="panel">
          <div className={styles.mapHeader}>
            <div className={styles.mapHeaderLeft}>
              <h2 className="panel-title" style={{ marginBottom: 0 }}>
                Active tricycles
              </h2>
              <Badge label={refreshing ? 'Updating…' : `Live · ${onTripCount} on trip`} tone={listError || mapError ? 'danger' : 'success'} />
            </div>
            <div className={styles.mapHeaderRight}>
              <Select value={cluster} onChange={(e) => setCluster(e.target.value)} options={CLUSTER_OPTIONS} />
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
          <div className="pane-header">
            <h2 className="panel-title" style={{ marginBottom: 0 }}>
              On the clock
            </h2>
            <Badge label={String(visibleTricycles.length)} tone="neutral" />
          </div>
          {listError && <div className="form-error">{listError}</div>}
          {initialLoading && <div style={{ color: 'var(--ink-faint)', fontSize: 12 }}>Loading…</div>}
          {!initialLoading && visibleTricycles.length === 0 && <EmptyState message="No tricycles on the clock right now." />}
          {visibleTricycles.map((t) => (
            <div key={t.driverId} className={styles.row}>
              <Avatar fullName={t.driverFullName} size={28} />
              <div className={styles.rowInfo}>
                <div className={styles.rowName}>{t.driverFullName}</div>
                <div className={styles.rowPlate}>
                  {t.plateNo}
                  {t.cluster ? ` · ${titleCaseLabel(t.cluster)}` : ''}
                </div>
              </div>
              <Badge
                label={t.tripStatus === 'active' ? 'On trip' : 'Idle'}
                tone={t.tripStatus === 'active' ? 'success' : 'neutral'}
              />
            </div>
          ))}
          <span className={styles.stamp}>{secondsAgoLabel(updatedAt)}</span>
        </div>
      </div>
    </div>
  );
}

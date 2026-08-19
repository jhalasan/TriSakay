import { useEffect, useState } from 'react';
import { LiveMap } from '../components/LiveMap';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { getActiveTricycleLocations, listActiveTricycles, type ActiveTricycleLocationCell } from '../services/monitoring';
import type { ActiveTricycleRow } from '../types/ride';
import styles from './RideMonitoring.module.css';

/**
 * Wireframe screen 6 "Ride monitoring" (FR-5.1, 5.2). Privacy-aware: only
 * coarse on-trip/idle state is shown here, never exact live coordinates
 * broadcast to unmatched parties (NFR-2.5) — this view is PSO oversight
 * only, distinct from the Passenger/Driver apps' own matched-pair map.
 */
export function RideMonitoring() {
  const [tricycles, setTricycles] = useState<ActiveTricycleRow[]>([]);
  const [cells, setCells] = useState<ActiveTricycleLocationCell[]>([]);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    listActiveTricycles().then((res) => setTricycles(res.data));
    getActiveTricycleLocations().then((res) => {
      setCells(res.data);
      setMapError(res.error);
      setMapLoading(false);
    });
  }, []);

  return (
    <div className="page">
      <div className={styles.layout}>
        <div className="panel">
          <div className={styles.mapHeader}>
            <div className="panel-title" style={{ marginBottom: 0 }}>
              Active Tricycles
            </div>
            <Badge label="Live" tone="success" />
          </div>
          {mapError && <div className="form-error">{mapError}</div>}
          <LiveMap cells={cells} loading={mapLoading} />
          <p className={styles.caption}>
            Locations shown are coarse and update only while a Driver is available or on an active trip — no continuous GPS trail is
            persisted (NFR-2.5).
          </p>
        </div>

        <div className={`panel ${styles.list}`}>
          <div className="panel-title">On the Clock</div>
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

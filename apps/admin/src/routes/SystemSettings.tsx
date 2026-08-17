import { useEffect, useState } from 'react';
import { Toggle } from '../components/Toggle';
import { TextField } from '../components/TextField';
import { Button } from '../components/Button';
import { useSettingsStore } from '../store/useSettingsStore';
import styles from './SystemSettings.module.css';

/** Wireframe screen 10 "System settings" (FR-8.1). Admin-only screen; route access is gated in App.tsx. */
export function SystemSettings() {
  const { fareConfig, featureToggles, systemSettings, loading, saving, savedAt, fetch, saveFareConfig, toggleFeature } =
    useSettingsStore();
  const [baseFare, setBaseFare] = useState('');
  const [baseKm, setBaseKm] = useState('');
  const [ratePerKm, setRatePerKm] = useState('');

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    if (fareConfig) {
      setBaseFare(String(fareConfig.baseFare));
      setBaseKm(String(fareConfig.baseKm));
      setRatePerKm(String(fareConfig.ratePerKm));
    }
  }, [fareConfig]);

  if (loading || !fareConfig || !featureToggles || !systemSettings) {
    return <div className="page">Loading…</div>;
  }

  return (
    <div className="page">
      <div className={styles.layout}>
        <div className="panel">
          <div className="panel-title">Feature Toggles</div>
          <div className={styles.toggleList}>
            <Toggle label="GCash payments (PayMongo, test mode)" checked={featureToggles.gcashEnabled} onChange={() => toggleFeature('gcashEnabled')} />
            <Toggle label="Cash payments" checked={featureToggles.cashEnabled} onChange={() => toggleFeature('cashEnabled')} />
            <Toggle
              label="MTOP franchise-expiry notifications"
              checked={featureToggles.franchiseExpiryNotifications}
              onChange={() => toggleFeature('franchiseExpiryNotifications')}
            />
          </div>

          <div className="panel-title" style={{ marginTop: 20 }}>
            Matching Heuristic (FR-2.5)
          </div>
          <div className={styles.readonlyGrid}>
            <span>Bearing tolerance</span>
            <span>{systemSettings.bearingToleranceDeg}°</span>
            <span>Detour ratio max</span>
            <span>{systemSettings.detourRatioMax}×</span>
            <span>Search radius</span>
            <span>{systemSettings.searchRadiusKm} km</span>
            <span>Low rating threshold</span>
            <span>{systemSettings.lowRatingThreshold} ★</span>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Fare Matrix (Ordinance 08-2023)</div>
          <div className={styles.fareForm}>
            <TextField label="Base Fare (₱)" type="number" step="0.01" value={baseFare} onChange={(e) => setBaseFare(e.target.value)} />
            <TextField label="Base Distance (km)" type="number" step="0.1" value={baseKm} onChange={(e) => setBaseKm(e.target.value)} />
            <TextField label="Rate per Succeeding km (₱)" type="number" step="0.01" value={ratePerKm} onChange={(e) => setRatePerKm(e.target.value)} />
            <p className={styles.ordinance}>{fareConfig.ordinanceRef ?? 'No ordinance reference on file.'}</p>
            <Button
              loading={saving}
              onClick={() =>
                saveFareConfig({ baseFare: Number(baseFare), baseKm: Number(baseKm), ratePerKm: Number(ratePerKm) })
              }
            >
              Save changes
            </Button>
            {savedAt && <span className={styles.savedNote}>Saved.</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

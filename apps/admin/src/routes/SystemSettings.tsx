import { useEffect, useState } from 'react';
import { Toggle } from '../components/Toggle';
import { TextField } from '../components/TextField';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { useSettingsStore } from '../store/useSettingsStore';
import { formatCurrency, formatDate } from '../lib/format';
import styles from './SystemSettings.module.css';

const WORKED_EXAMPLE_KM = 4.2;

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

  const parsedBaseFare = Number(baseFare);
  const parsedBaseKm = Number(baseKm);
  const parsedRatePerKm = Number(ratePerKm);
  const workedExampleExcessKm = Math.max(0, WORKED_EXAMPLE_KM - parsedBaseKm);
  const workedExampleExcessCost = workedExampleExcessKm * parsedRatePerKm;
  const workedExampleTotal = parsedBaseFare + workedExampleExcessCost;
  const workedExampleValid = [parsedBaseFare, parsedBaseKm, parsedRatePerKm].every((n) => Number.isFinite(n));

  return (
    <div className="page">
      <div className={styles.layout}>
        <div className={styles.leftCol}>
          <div className="panel">
            <div className="pane-header">
              <h2 className="panel-title" style={{ marginBottom: 0 }}>
                Payments &amp; Notifications
              </h2>
              <Badge label="Administrator only" tone="info" />
            </div>
            <div className={styles.toggleList}>
              <Toggle label="GCash payments" hint="PayMongo, test mode" checked={featureToggles.gcashEnabled} onChange={() => toggleFeature('gcashEnabled')} />
              <Toggle label="Cash payments" hint="Driver confirms collection in-app" checked={featureToggles.cashEnabled} onChange={() => toggleFeature('cashEnabled')} />
              <Toggle
                label="MTOP franchise-expiry notices"
                hint="Drivers are warned 30 days out"
                checked={featureToggles.franchiseExpiryNotifications}
                onChange={() => toggleFeature('franchiseExpiryNotifications')}
              />
            </div>
          </div>

          <div className="panel">
            <div className="pane-header">
              <h2 className="panel-title" style={{ marginBottom: 0 }}>
                Matching Heuristic
              </h2>
              <Badge label="Read-only" tone="neutral" />
            </div>
            <p className={styles.heuristicNote}>Tuned in deployment config, shown here for reference.</p>
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
        </div>

        <div className="panel">
          <div className={styles.fareHeader}>
            <div>
              <h2 className="panel-title" style={{ marginBottom: 2 }}>
                Fare Matrix
              </h2>
              <p className={styles.ordinance}>{fareConfig.ordinanceRef ?? 'No ordinance reference on file'} — applies to every new booking.</p>
            </div>
            <Badge label="Affects live fares" tone="warn" />
          </div>
          <div className={styles.fareForm}>
            <TextField label="Base Fare (₱)" type="number" step="0.01" value={baseFare} onChange={(e) => setBaseFare(e.target.value)} />
            <TextField label="Base Distance (km)" type="number" step="0.1" value={baseKm} onChange={(e) => setBaseKm(e.target.value)} />
            <TextField label="Rate per Succeeding km (₱)" type="number" step="0.01" value={ratePerKm} onChange={(e) => setRatePerKm(e.target.value)} />

            {workedExampleValid && (
              <div className={styles.workedExample}>
                <span className="field-label">Worked example</span>
                <p>
                  A {WORKED_EXAMPLE_KM} km trip charges {formatCurrency(parsedBaseFare)} for the first {parsedBaseKm} km
                  {workedExampleExcessKm > 0 && (
                    <>
                      {' '}
                      plus {formatCurrency(workedExampleExcessCost)} for the remaining {workedExampleExcessKm.toFixed(1)} km
                    </>
                  )}
                  {' — '}
                  {formatCurrency(workedExampleTotal)} before any statutory discount.
                </p>
              </div>
            )}

            <Button
              loading={saving}
              onClick={() =>
                saveFareConfig({ baseFare: parsedBaseFare, baseKm: parsedBaseKm, ratePerKm: parsedRatePerKm })
              }
            >
              Save changes
            </Button>
            <span className={styles.auditLine}>
              {savedAt ? 'Saved. ' : ''}
              Last changed {formatDate(fareConfig.effectiveFrom)}
              {fareConfig.updatedByName ? ` by ${fareConfig.updatedByName}` : ''}.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

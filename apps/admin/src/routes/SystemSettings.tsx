import { useEffect, useState } from 'react';
import { Toggle } from '../components/Toggle';
import { TextField } from '../components/TextField';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { ErrorBanner } from '../components/ErrorBanner';
import { EmptyState } from '../components/EmptyState';
import { ConfirmModal } from '../components/ConfirmModal';
import { useSettingsStore } from '../store/useSettingsStore';
import { formatCurrency, formatDate } from '../lib/format';
import styles from './SystemSettings.module.css';

const WORKED_EXAMPLE_KM = 4.2;

/** Wireframe screen 10 "System settings" (FR-8.1). Admin-only screen; route access is gated in App.tsx. */
export function SystemSettings() {
  const {
    fareConfig,
    featureToggles,
    systemSettings,
    loading,
    saving,
    savedAt,
    error,
    fetch,
    saveFareConfig,
    toggleFeature,
  } = useSettingsStore();
  const [baseFare, setBaseFare] = useState('');
  const [baseKm, setBaseKm] = useState('');
  const [ratePerKm, setRatePerKm] = useState('');
  const [confirmingFareSave, setConfirmingFareSave] = useState(false);

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

  if (loading) {
    return <div className="page">Loading…</div>;
  }

  // P1-16 (2026-09-15 launch audit): a fetch failure used to hold this
  // screen on "Loading…" forever (fareConfig/etc. stay null, loading goes
  // false, and the guard above never falls through) — no message, no Retry.
  if (error && (!fareConfig || !featureToggles || !systemSettings)) {
    return (
      <div className="page">
        <EmptyState
          message="Couldn't load system settings."
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

  if (!fareConfig || !featureToggles || !systemSettings) {
    return <div className="page">Loading…</div>;
  }

  const parsedBaseFare = Number(baseFare);
  const parsedBaseKm = Number(baseKm);
  const parsedRatePerKm = Number(ratePerKm);
  const workedExampleExcessKm = Math.max(0, WORKED_EXAMPLE_KM - parsedBaseKm);
  const workedExampleExcessCost = workedExampleExcessKm * parsedRatePerKm;
  const workedExampleTotal = parsedBaseFare + workedExampleExcessCost;
  const workedExampleValid = [parsedBaseFare, parsedBaseKm, parsedRatePerKm].every((n) => Number.isFinite(n));
  // P1-15 (2026-09-15 launch audit): Number('') === 0 and Number.isFinite(0)
  // is true, so an emptied field previously saved as a live ₱0 fare with no
  // guard. Base fare may legitimately be 0 in theory (the DB CHECK allows
  // it) but base_km and rate_per_km must be strictly positive for the
  // ordinance formula to mean anything, and none of the three fields may be
  // blank/non-numeric.
  const fareFormValid =
    workedExampleValid &&
    baseFare.trim() !== '' &&
    baseKm.trim() !== '' &&
    ratePerKm.trim() !== '' &&
    parsedBaseFare >= 0 &&
    parsedBaseKm > 0 &&
    parsedRatePerKm >= 0;

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

            <ErrorBanner message={error} />

            <Button disabled={!fareFormValid} onClick={() => setConfirmingFareSave(true)}>
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

      {confirmingFareSave && (
        <ConfirmModal
          title="Save fare changes?"
          message={`Base fare ${formatCurrency(fareConfig.baseFare)} → ${formatCurrency(parsedBaseFare)}, base distance ${fareConfig.baseKm} km → ${parsedBaseKm} km, rate per km ${formatCurrency(fareConfig.ratePerKm)} → ${formatCurrency(parsedRatePerKm)}. This applies to every new booking immediately.`}
          confirmLabel="Save changes"
          tone="danger"
          confirmLoading={saving}
          error={error}
          onConfirm={async () => {
            await saveFareConfig({ baseFare: parsedBaseFare, baseKm: parsedBaseKm, ratePerKm: parsedRatePerKm });
            if (!useSettingsStore.getState().error) setConfirmingFareSave(false);
          }}
          onCancel={() => setConfirmingFareSave(false)}
        />
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Textarea } from '../components/Textarea';
import { RoleGate } from '../components/RoleGate';
import { ErrorBanner } from '../components/ErrorBanner';
import { EmptyState } from '../components/EmptyState';
import { useEmergencyAlertsStore } from '../store/useEmergencyAlertsStore';
import type { EmergencyAlertRow, EmergencyStatus } from '../types/emergency';
import { formatDateTime, formatRelativeTime, titleCaseLabel } from '../lib/format';
import styles from './EmergencyAlerts.module.css';

const STATUS_TONE: Record<EmergencyStatus, 'neutral' | 'success' | 'warn' | 'danger' | 'info'> = {
  logged: 'danger',
  reviewed: 'success',
  closed: 'neutral',
};

const ROLE_LABEL: Record<EmergencyAlertRow['triggeredRole'], string> = {
  passenger: 'Passenger',
  driver: 'Driver',
};

/**
 * FR-12.4/12.5 (wireframe review item 10) — list + detail view of triggered
 * SOS alerts, visible to any PSO Staff+ account; "Mark Reviewed" gated to
 * Supervisor+. A one-shot fetch on load, not Realtime — matches every other
 * admin screen, and FR-12.7 explicitly says this isn't meant to be
 * 24/7-monitored. Restyled per README §07 — 60/40 split, unreviewed banner,
 * and the danger-accent selected row (DataTable's isRowHighlighted/onRowClick).
 *
 * The detail panel keeps exact coordinates + a real Google Maps link,
 * unlike Ride Monitoring's intentionally-coarse map: an SOS location is
 * safety-critical, so softening its precision to match that screen's
 * privacy rule would work against the feature's purpose.
 */
export function EmergencyAlerts() {
  const { alerts, loading, error, fetch, markReviewed } = useEmergencyAlertsStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');

  useEffect(() => {
    fetch();
  }, [fetch]);

  const selected = alerts.find((a) => a.id === selectedId) ?? null;
  const unreviewed = alerts.filter((a) => a.status === 'logged').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const newest = unreviewed[0] ?? null;

  function openDetail(a: EmergencyAlertRow) {
    setSelectedId(a.id);
    setNotesDraft(a.notes ?? '');
  }

  const columns: DataTableColumn<EmergencyAlertRow>[] = [
    {
      key: 'triggeredBy',
      header: 'Triggered by',
      sortValue: (a) => a.triggeredByName,
      render: (a) => <div style={{ fontWeight: 600 }}>{a.triggeredByName}</div>,
    },
    { key: 'role', header: 'Role', sortValue: (a) => a.triggeredRole, render: (a) => ROLE_LABEL[a.triggeredRole] },
    { key: 'time', header: 'Time', sortValue: (a) => a.createdAt, render: (a) => formatDateTime(a.createdAt) },
    { key: 'linkedRide', header: 'Linked ride', render: (a) => <span className="mono">{a.rideRequestId ?? '—'}</span> },
    { key: 'status', header: 'Status', sortValue: (a) => a.status, render: (a) => <Badge label={titleCaseLabel(a.status)} tone={STATUS_TONE[a.status]} /> },
    {
      key: 'actions',
      header: 'Actions',
      render: (a) => (
        <Button variant="outline" tone="neutral" size="sm" onClick={() => openDetail(a)}>
          {a.status === 'logged' ? 'Review' : 'View'}
        </Button>
      ),
    },
  ];

  return (
    <div className="page">
      <ErrorBanner message={error} />

      {newest && (
        <div className={styles.banner}>
          <div>
            <div className={styles.bannerTitle}>{unreviewed.length === 1 ? '1 alert is still unreviewed' : `${unreviewed.length} alerts are still unreviewed`}</div>
            <p className={styles.bannerBody}>
              Triggered {formatRelativeTime(newest.createdAt)} by a {newest.triggeredRole} on an active trip. SOS is not 24/7-monitored
              (FR-12.7) — review during office hours.
            </p>
          </div>
          <Button variant="solid" tone="primary" size="sm" onClick={() => openDetail(newest)}>
            Open newest alert
          </Button>
        </div>
      )}

      <div className={styles.split}>
        <DataTable
          columns={columns}
          rows={alerts}
          getRowKey={(a) => a.id}
          loading={loading}
          emptyMessage="No emergency alerts on record."
          onRowClick={openDetail}
          isRowHighlighted={(a) => a.id === selectedId}
        />

        <div className={`panel ${styles.detail}`}>
          {selected ? (
            <>
              <div className={styles.detailHeader}>
                <h2 className="panel-title" style={{ marginBottom: 0 }}>
                  {selected.triggeredByName} · {ROLE_LABEL[selected.triggeredRole]}
                </h2>
                <Badge label={titleCaseLabel(selected.status)} tone={STATUS_TONE[selected.status]} />
              </div>

              <div className="two-col">
                <div className="field">
                  <span className="field-label">Triggered at</span>
                  <span>{formatDateTime(selected.createdAt)}</span>
                </div>
                <div className="field">
                  <span className="field-label">Linked ride</span>
                  <span className="mono">{selected.rideRequestId ?? '—'}</span>
                </div>
                <div className="field">
                  <span className="field-label">Counterpart</span>
                  <span>{selected.counterpartName ?? '—'}</span>
                </div>
                <div className="field">
                  <span className="field-label">Tricycle</span>
                  <span className="mono">{selected.tricyclePlateNo ?? '—'}</span>
                </div>
              </div>

              <div className="field">
                <span className="field-label">Location</span>
                <div className={`ph-box ${styles.locationBox}`}>
                  <span className={styles.locationPill}>
                    {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
                  </span>
                </div>
                <a
                  className={styles.mapsLink}
                  href={`https://www.google.com/maps?q=${selected.lat},${selected.lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Google Maps
                </a>
              </div>

              {selected.status !== 'logged' && (
                <div className="field">
                  <span className="field-label">Reviewed by</span>
                  <span>
                    {selected.reviewedByName ?? '—'}
                    {selected.reviewedAt ? ` · ${formatDateTime(selected.reviewedAt)}` : ''}
                  </span>
                </div>
              )}

              <Textarea
                label="Review notes"
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Optional notes on the review…"
              />

              <RoleGate
                min="supervisor"
                fallback={<div className="read-only-note">Mark Reviewed — PSO Supervisor &amp; Administrator only.</div>}
              >
                <Button
                  variant="solid"
                  tone="primary"
                  size="sm"
                  superscript="S+"
                  disabled={selected.status !== 'logged'}
                  onClick={() => markReviewed(selected.id, notesDraft || undefined)}
                  style={{ alignSelf: 'flex-start' }}
                >
                  Mark reviewed
                </Button>
              </RoleGate>
            </>
          ) : (
            <EmptyState message="Select an alert to see its detail." />
          )}
        </div>
      </div>
    </div>
  );
}

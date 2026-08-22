import { useEffect, useState } from 'react';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Textarea } from '../components/Textarea';
import { RoleGate } from '../components/RoleGate';
import { useEmergencyAlertsStore } from '../store/useEmergencyAlertsStore';
import type { EmergencyAlertRow, EmergencyStatus } from '../types/emergency';
import { formatDateTime, titleCaseLabel } from '../lib/format';
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
 * 24/7-monitored.
 */
export function EmergencyAlerts() {
  const { alerts, loading, error, fetch, markReviewed } = useEmergencyAlertsStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');

  useEffect(() => {
    fetch();
  }, [fetch]);

  const selected = alerts.find((a) => a.id === selectedId) ?? null;

  function openDetail(a: EmergencyAlertRow) {
    setSelectedId(a.id);
    setNotesDraft(a.notes ?? '');
  }

  const columns: DataTableColumn<EmergencyAlertRow>[] = [
    {
      key: 'triggeredBy',
      header: 'Triggered by',
      sortValue: (a) => a.triggeredByName,
      render: (a) => (
        <div>
          <div style={{ fontWeight: 600 }}>{a.triggeredByName}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{ROLE_LABEL[a.triggeredRole]}</div>
        </div>
      ),
    },
    { key: 'time', header: 'Time', sortValue: (a) => a.createdAt, render: (a) => formatDateTime(a.createdAt) },
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

      <DataTable columns={columns} rows={alerts} getRowKey={(a) => a.id} loading={loading} emptyMessage="No emergency alerts on record." />

      {selected && (
        <div className={`panel ${styles.review}`}>
          <div className="panel-title">Alert — {selected.triggeredByName} ({ROLE_LABEL[selected.triggeredRole]})</div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Triggered at</span>
            <span>{formatDateTime(selected.createdAt)}</span>
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Location</span>
            <span>
              {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
              {' — '}
              <a href={`https://www.google.com/maps?q=${selected.lat},${selected.lng}`} target="_blank" rel="noreferrer">
                View on map
              </a>
            </span>
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Linked ride</span>
            <span>{selected.rideRequestId ?? '—'}</span>
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Counterpart</span>
            <span>{selected.counterpartName ?? '—'}</span>
          </div>

          {selected.status !== 'logged' && (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Reviewed by</span>
              <span>
                {selected.reviewedByName ?? '—'}
                {selected.reviewedAt ? ` · ${formatDateTime(selected.reviewedAt)}` : ''}
              </span>
            </div>
          )}

          <Textarea
            label="Notes"
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="Optional notes on the review…"
          />

          <RoleGate
            min="supervisor"
            fallback={<div className={styles.readOnlyNote}>Mark Reviewed — PSO Supervisor &amp; Administrator only.</div>}
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
              Mark Reviewed
            </Button>
          </RoleGate>
        </div>
      )}
    </div>
  );
}

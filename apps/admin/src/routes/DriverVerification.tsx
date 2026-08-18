import { useEffect } from 'react';
import { DocumentPanel } from '../components/DocumentPanel';
import { TextField } from '../components/TextField';
import { Select } from '../components/Select';
import { Textarea } from '../components/Textarea';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { RoleGate } from '../components/RoleGate';
import { useVerificationStore } from '../store/useVerificationStore';
import type { TricycleCluster } from '../types/driver';
import { titleCaseLabel } from '../lib/format';
import styles from './DriverVerification.module.css';

const CLUSTER_OPTIONS: { label: string; value: TricycleCluster | '' }[] = [
  { label: 'Select cluster…', value: '' },
  { label: 'Red', value: 'red' },
  { label: 'White', value: 'white' },
  { label: 'Apple Green', value: 'apple_green' },
  { label: 'Melting Pot', value: 'melting_pot' },
];

/**
 * Wireframe screen 4 "Driver & tricycle verification" (FR-1.5). MTOP
 * number / expiry / cluster inputs implement FR-1.4a — the app does not
 * OCR the uploaded Franchise/Permit document, so PSO Supervisor/Admin
 * transcribes these fields by hand while reviewing it (docs/CONTEXT.MD
 * §11 item 6).
 */
export function DriverVerification() {
  const { cases, selectedDriverId, loading, fetch, select, updateFields, approve, reject } = useVerificationStore();

  useEffect(() => {
    fetch();
  }, [fetch]);

  const selectedCase = cases.find((c) => c.driverId === selectedDriverId) ?? null;

  return (
    <div className="page">
      <div className="panel">
        <div className="panel-title">Pending Cases</div>
        <div className={styles.caseList}>
          {loading && <div style={{ color: 'var(--ink-faint)', fontSize: 12 }}>Loading…</div>}
          {!loading && cases.length === 0 && <div style={{ color: 'var(--ink-faint)', fontSize: 12 }}>No pending verifications.</div>}
          {cases.map((c) => (
            <button
              key={c.driverId}
              className={c.driverId === selectedDriverId ? styles.caseActive : styles.case}
              onClick={() => select(c.driverId)}
            >
              <span>
                {c.driverFullName} <span className={styles.plate}>{c.plateNo}</span>
              </span>
              <Badge label={titleCaseLabel(c.overallStatus)} tone={c.overallStatus === 'approved' ? 'success' : c.overallStatus === 'rejected' ? 'danger' : 'warn'} />
            </button>
          ))}
        </div>
      </div>

      {selectedCase && (
        <div className={styles.review}>
          <div className={styles.documents}>
            {selectedCase.documents.map((doc) => (
              <DocumentPanel key={doc.docType} label={doc.label} status={doc.status} />
            ))}
          </div>

          <div className={`panel ${styles.sidebar}`}>
            <div className="panel-title">Franchise / Permit (Ordinance 21, s.2024)</div>

            <RoleGate
              min="supervisor"
              fallback={
                <>
                  <div className={styles.readOnlyField}><span>MTOP Number</span>{selectedCase.mtopNo || '—'}</div>
                  <div className={styles.readOnlyField}><span>MTOP Expiry Date</span>{selectedCase.mtopExpiryDate || '—'}</div>
                  <div className={styles.readOnlyField}><span>Cluster</span>{selectedCase.cluster || '—'}</div>
                  <div className={styles.readOnlyField}><span>Notes</span>{selectedCase.notes || '—'}</div>
                  <div className={styles.readOnlyNote}>
                    Editing &amp; Approve / Reject — PSO Supervisor &amp; Administrator only. PSO Staff: read-only review.
                  </div>
                </>
              }
            >
              <TextField
                label="MTOP Number"
                value={selectedCase.mtopNo}
                onChange={(e) => updateFields(selectedCase.driverId, { mtopNo: e.target.value })}
                placeholder="e.g. MTOP-2026-00123"
              />
              <TextField
                label="MTOP Expiry Date"
                type="date"
                value={selectedCase.mtopExpiryDate}
                onChange={(e) => updateFields(selectedCase.driverId, { mtopExpiryDate: e.target.value })}
              />
              <Select
                label="Cluster"
                value={selectedCase.cluster}
                onChange={(e) => updateFields(selectedCase.driverId, { cluster: e.target.value as TricycleCluster | '' })}
                options={CLUSTER_OPTIONS}
              />
              <Textarea
                label="Notes"
                value={selectedCase.notes}
                onChange={(e) => updateFields(selectedCase.driverId, { notes: e.target.value })}
                placeholder="Reviewer notes, required if rejecting…"
              />

              <div className={styles.decisionRow}>
                <Button
                  variant="solid"
                  tone="primary"
                  superscript="S+"
                  fullWidth
                  onClick={() => approve(selectedCase.driverId, selectedCase.notes || undefined)}
                >
                  Approve
                </Button>
                <Button
                  variant="outline"
                  tone="danger"
                  superscript="S+"
                  fullWidth
                  disabled={!selectedCase.notes.trim()}
                  onClick={() => reject(selectedCase.driverId, selectedCase.notes)}
                >
                  Reject
                </Button>
              </div>
            </RoleGate>
          </div>
        </div>
      )}
    </div>
  );
}

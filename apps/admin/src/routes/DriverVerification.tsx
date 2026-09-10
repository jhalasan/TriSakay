import { useEffect, useState } from 'react';
import { DocumentPanel } from '../components/DocumentPanel';
import { TextField } from '../components/TextField';
import { Select } from '../components/Select';
import { Textarea } from '../components/Textarea';
import { Button } from '../components/Button';
import { Badge, type BadgeTone } from '../components/Badge';
import { Avatar } from '../components/Avatar';
import { RoleGate } from '../components/RoleGate';
import { ErrorBanner } from '../components/ErrorBanner';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { useVerificationStore } from '../store/useVerificationStore';
import type { VerificationCase } from '../types/verification';
import type { TricycleCluster } from '../types/driver';
import { formatRelativeTime, titleCaseLabel } from '../lib/format';
import styles from './DriverVerification.module.css';

const CLUSTER_OPTIONS: { label: string; value: TricycleCluster | '' }[] = [
  { label: 'Select cluster…', value: '' },
  { label: 'Red', value: 'red' },
  { label: 'White', value: 'white' },
  { label: 'Apple Green', value: 'apple_green' },
  { label: 'Melting Pot', value: 'melting_pot' },
];

function daysUntil(isoDate: string): number {
  return Math.round((new Date(isoDate).getTime() - Date.now()) / 86_400_000);
}

/**
 * README §06 queue row context clause. "Resubmitted" (a driver replacing a
 * previously-rejected document) appears in the mock but isn't derivable —
 * nothing in this data model records that a document was ever replaced, so
 * it's not implemented here; flagged as an open item.
 */
function queueContext(c: VerificationCase): string {
  if (c.mtopExpiryDate) {
    const days = daysUntil(c.mtopExpiryDate);
    return days < 0 ? `MTOP lapsed ${Math.abs(days)}d ago` : `MTOP expires in ${days}d`;
  }
  return `submitted ${formatRelativeTime(c.updatedAt)}`;
}

function queueBadge(c: VerificationCase): { label: string; tone: BadgeTone } {
  if (c.overallStatus === 'approved') return { label: 'Approved', tone: 'success' };
  if (c.overallStatus === 'rejected') return { label: 'Rejected', tone: 'danger' };
  if (c.mtopExpiryDate && daysUntil(c.mtopExpiryDate) < 0) return { label: 'Expired', tone: 'danger' };
  return { label: 'Pending', tone: 'warn' };
}

/**
 * Wireframe screen 4 "Driver & tricycle verification" (FR-1.5). MTOP
 * number / expiry / cluster inputs implement FR-1.4a — the app does not
 * OCR the uploaded Franchise/Permit document, so PSO Supervisor/Admin
 * transcribes these fields by hand while reviewing it (docs/CONTEXT.MD
 * §11 item 6). Restyled per docs/design_handoff_trisakay_admin/README.md
 * §06 — three independently-scrolling panes (queue / evidence / decision),
 * no page scroll.
 */
export function DriverVerification() {
  const { cases, selectedDriverId, loading, error, fetch, select, updateFields, approve, reject } = useVerificationStore();
  const [deciding, setDeciding] = useState<'approve' | 'reject' | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    fetch();
  }, [fetch]);

  const selectedCase = cases.find((c) => c.driverId === selectedDriverId) ?? null;
  const verifiedCount = selectedCase ? selectedCase.documents.filter((d) => d.status === 'approved').length : 0;

  async function handleApprove() {
    if (!selectedCase) return;
    setDeciding('approve');
    const ok = await approve(selectedCase.driverId, selectedCase.notes || undefined);
    setDeciding(null);
    if (ok) showToast({ message: `${selectedCase.driverFullName} approved.` });
  }

  async function handleReject() {
    if (!selectedCase) return;
    setDeciding('reject');
    const ok = await reject(selectedCase.driverId, selectedCase.notes);
    setDeciding(null);
    if (ok) showToast({ message: `${selectedCase.driverFullName} rejected.` });
  }

  if (error && cases.length === 0 && !loading) {
    return (
      <div className="page">
        <EmptyState
          message="Couldn't load verification cases."
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
    <div className="review-page">
      <div className="review-grid review-grid-3">
        <div className="panel review-pane">
          <div className="pane-header">
            <h2 className="panel-title" style={{ marginBottom: 0 }}>
              Pending Cases
            </h2>
            <Badge label={String(cases.length)} tone="neutral" />
          </div>
          <div className="pane-scroll">
            {loading && <div style={{ color: 'var(--ink-faint)', fontSize: 12 }}>Loading…</div>}
            {!loading && cases.length === 0 && <EmptyState message="No pending verifications." hint="New driver submissions appear here." />}
            <div className="case-list">
              {cases.map((c) => {
                const badge = queueBadge(c);
                return (
                  <button
                    key={c.driverId}
                    className={`case-row ${c.driverId === selectedDriverId ? 'case-row-active' : ''}`}
                    onClick={() => select(c.driverId)}
                  >
                    <div className="case-top">
                      <span className="case-name">{c.driverFullName}</span>
                      <Badge label={badge.label} tone={badge.tone} />
                    </div>
                    <span className="case-sub">
                      {c.plateNo} · {queueContext(c)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="panel review-pane">
          {selectedCase ? (
            <>
              <div className="evidence-header">
                <Avatar fullName={selectedCase.driverFullName} size={34} />
                <div className="evidence-header-text">
                  <span className="evidence-name">{selectedCase.driverFullName}</span>
                  <span className="case-sub">
                    {selectedCase.plateNo}
                    {selectedCase.cluster ? ` · ${titleCaseLabel(selectedCase.cluster)} cluster` : ''}
                    {selectedCase.contactNo ? ` · ${selectedCase.contactNo}` : ''}
                  </span>
                </div>
                <Badge label={`${verifiedCount} of ${selectedCase.documents.length} documents verified`} tone="neutral" />
              </div>
              <div className="pane-scroll">
                <div className="evidence-grid">
                  {selectedCase.documents.map((doc) => (
                    <DocumentPanel key={doc.docType} label={doc.label} status={doc.status} storagePath={doc.storagePath} />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <EmptyState message="Select a case to review its documents." icon={false} />
          )}
        </div>

        <div className="panel review-pane">
          {selectedCase ? (
            <>
              <div className="pane-header-stack">
                <h2 className="panel-title" style={{ marginBottom: 2 }}>
                  Franchise details
                </h2>
                <p className="pane-subtitle">Ordinance 21, s.2024 — transcribed by hand from the permit.</p>
              </div>
              <div className="pane-scroll decision-body">
                <RoleGate
                  min="supervisor"
                  fallback={
                    <>
                      <div className={styles.readOnlyField}>
                        <span>MTOP Number</span>
                        {selectedCase.mtopNo || '—'}
                      </div>
                      <div className={styles.readOnlyField}>
                        <span>MTOP Expiry Date</span>
                        {selectedCase.mtopExpiryDate || '—'}
                      </div>
                      <div className={styles.readOnlyField}>
                        <span>Cluster</span>
                        {selectedCase.cluster || '—'}
                      </div>
                      <div className={styles.readOnlyField}>
                        <span>Notes</span>
                        {selectedCase.notes || '—'}
                      </div>
                      <div className="read-only-note">
                        Editing &amp; Approve / Reject — PSO Supervisor &amp; Administrator only. PSO Staff sees this panel read-only.
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
                    label="Reviewer Notes"
                    value={selectedCase.notes}
                    onChange={(e) => updateFields(selectedCase.driverId, { notes: e.target.value })}
                    placeholder="Required if rejecting…"
                  />

                  <ErrorBanner message={error} />
                  <div className="decision-row">
                    <Button
                      variant="solid"
                      tone="primary"
                      superscript="S+"
                      fullWidth
                      loading={deciding === 'approve'}
                      disabled={deciding !== null}
                      onClick={handleApprove}
                    >
                      {deciding === 'approve' ? 'Approving…' : 'Approve'}
                    </Button>
                    <Button
                      variant="outline"
                      tone="danger"
                      superscript="S+"
                      fullWidth
                      loading={deciding === 'reject'}
                      disabled={deciding !== null || !selectedCase.notes.trim()}
                      onClick={handleReject}
                    >
                      {deciding === 'reject' ? 'Rejecting…' : 'Reject'}
                    </Button>
                  </div>
                  <p className="footnote">
                    Approve / Reject is limited to PSO Supervisor and Administrator. PSO Staff sees this panel read-only.
                  </p>
                </RoleGate>
              </div>
            </>
          ) : (
            <EmptyState message="Select a case to decide it." icon={false} />
          )}
        </div>
      </div>
    </div>
  );
}

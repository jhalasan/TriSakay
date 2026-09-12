import { useEffect, useState } from 'react';
import { DocumentPanel } from '../components/DocumentPanel';
import { TextField } from '../components/TextField';
import { Select } from '../components/Select';
import { Textarea } from '../components/Textarea';
import { Button } from '../components/Button';
import { Badge, type BadgeTone } from '../components/Badge';
import { Avatar } from '../components/Avatar';
import { RoleGate } from '../components/RoleGate';
import { ConfirmModal } from '../components/ConfirmModal';
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

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`case-chevron ${open ? 'case-chevron-open' : ''}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/**
 * Wireframe screen 4 "Driver & tricycle verification" (FR-1.5). MTOP
 * number / expiry / cluster inputs implement FR-1.4a — the app does not
 * OCR the uploaded Franchise/Permit document, so PSO Supervisor/Admin
 * transcribes these fields by hand while reviewing it (docs/CONTEXT.MD
 * §11 item 6).
 *
 * Single-column accordion: cases are grouped into "Pending Review" and
 * "Decided" so a completed case never gets mistaken for one still needing
 * a decision, and each case expands in place — evidence and the decision
 * form appear directly under the row a reviewer opened, not off in a
 * separate pane requiring a second glance.
 */
type PendingDecision = { kind: 'approve' | 'reject'; case: VerificationCase };

/** Names what each decision actually does, per the P0 finding from the 2026-09 critique: Approve/Reject
 * previously fired straight from the button with no checkpoint, unlike every other S+ action in this app. */
const DECISION_COPY: Record<PendingDecision['kind'], { title: string; confirmLabel: string; tone: 'primary' | 'danger'; message: (c: VerificationCase) => string }> = {
  approve: {
    title: 'Approve verification',
    confirmLabel: 'Approve',
    tone: 'primary',
    message: (c) => `Approve ${c.driverFullName}'s verification? Their MTOP and tricycle details are marked verified and they can go online immediately.`,
  },
  reject: {
    title: 'Reject verification',
    confirmLabel: 'Reject',
    tone: 'danger',
    message: (c) => `Reject ${c.driverFullName}'s verification? They'll need to resubmit documents before they can go online.`,
  },
};

export function DriverVerification() {
  const { cases, selectedDriverId, loading, error, fetch, select, updateFields, approve, reject } = useVerificationStore();
  const [deciding, setDeciding] = useState<'approve' | 'reject' | null>(null);
  const [pendingDecision, setPendingDecision] = useState<PendingDecision | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    fetch();
  }, [fetch]);

  const selectedCase = cases.find((c) => c.driverId === selectedDriverId) ?? null;
  const verifiedCount = selectedCase ? selectedCase.documents.filter((d) => d.status === 'approved').length : 0;

  const pendingCases = cases.filter((c) => c.overallStatus === 'pending');
  const decidedCases = cases.filter((c) => c.overallStatus === 'approved' || c.overallStatus === 'rejected');

  async function handleConfirmDecision() {
    if (!pendingDecision) return;
    const { kind, case: c } = pendingDecision;
    setDeciding(kind);
    const ok = kind === 'approve' ? await approve(c.driverId, c.notes || undefined) : await reject(c.driverId, c.notes);
    setDeciding(null);
    if (!ok) return;
    setPendingDecision(null);
    showToast({ message: `${c.driverFullName} ${kind === 'approve' ? 'approved' : 'rejected'}.` });
    // Move straight to the next case still needing a decision — approve/reject
    // already refetched, so read the store directly rather than the stale
    // `cases` this closure captured at render time.
    const next = useVerificationStore.getState().cases.find((other) => other.overallStatus === 'pending' && other.driverId !== c.driverId);
    select(next?.driverId ?? null);
  }

  function toggle(driverId: string) {
    select(driverId === selectedDriverId ? null : driverId);
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

  function renderCaseDetail(c: VerificationCase) {
    return (
      <div className="case-detail" id={`verification-case-detail-${c.driverId}`}>
        <div className="evidence-header">
          <Avatar fullName={c.driverFullName} size={34} />
          <div className="evidence-header-text">
            <span className="evidence-name">{c.driverFullName}</span>
            <span className="case-sub">
              {c.plateNo}
              {c.cluster ? ` · ${titleCaseLabel(c.cluster)} cluster` : ''}
              {c.contactNo ? ` · ${c.contactNo}` : ''}
            </span>
          </div>
          <Badge label={`${verifiedCount} of ${c.documents.length} documents verified`} tone="neutral" />
        </div>

        <div className="evidence-grid">
          {c.documents.map((doc) => (
            <DocumentPanel key={doc.docType} label={doc.label} status={doc.status} storagePath={doc.storagePath} />
          ))}
        </div>

        <div className="pane-header-stack">
          <h3 className="panel-title" style={{ marginBottom: 2, fontSize: 13 }}>
            Franchise details
          </h3>
          <p className="pane-subtitle">Ordinance 21, s.2024 — transcribed by hand from the permit.</p>
        </div>

        <RoleGate
          min="supervisor"
          fallback={
            <>
              <div className={styles.readOnlyField}>
                <span>MTOP Number</span>
                {c.mtopNo || '—'}
              </div>
              <div className={styles.readOnlyField}>
                <span>MTOP Expiry Date</span>
                {c.mtopExpiryDate || '—'}
              </div>
              <div className={styles.readOnlyField}>
                <span>Cluster</span>
                {c.cluster || '—'}
              </div>
              <div className={styles.readOnlyField}>
                <span>Notes</span>
                {c.notes || '—'}
              </div>
              <div className="read-only-note">
                Editing &amp; Approve / Reject — PSO Supervisor &amp; Administrator only. PSO Staff sees this panel read-only.
              </div>
            </>
          }
        >
          <div className="decision-body">
            <TextField
              label="MTOP Number"
              value={c.mtopNo}
              onChange={(e) => updateFields(c.driverId, { mtopNo: e.target.value })}
              placeholder="e.g. MTOP-2026-00123"
            />
            <TextField
              label="MTOP Expiry Date"
              type="date"
              value={c.mtopExpiryDate}
              onChange={(e) => updateFields(c.driverId, { mtopExpiryDate: e.target.value })}
            />
            <Select
              label="Cluster"
              value={c.cluster}
              onChange={(e) => updateFields(c.driverId, { cluster: e.target.value as TricycleCluster | '' })}
              options={CLUSTER_OPTIONS}
            />
            <Textarea
              label="Reviewer Notes"
              value={c.notes}
              onChange={(e) => updateFields(c.driverId, { notes: e.target.value })}
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
                disabled={deciding !== null || c.overallStatus !== 'pending'}
                onClick={() => setPendingDecision({ kind: 'approve', case: c })}
              >
                {deciding === 'approve' ? 'Approving…' : 'Approve'}
              </Button>
              <Button
                variant="outline"
                tone="danger"
                superscript="S+"
                fullWidth
                loading={deciding === 'reject'}
                disabled={deciding !== null || c.overallStatus !== 'pending' || !c.notes.trim()}
                onClick={() => setPendingDecision({ kind: 'reject', case: c })}
              >
                {deciding === 'reject' ? 'Rejecting…' : 'Reject'}
              </Button>
            </div>
            <p className="footnote">
              {c.overallStatus === 'pending'
                ? 'Approve / Reject is limited to PSO Supervisor and Administrator. PSO Staff sees this panel read-only.'
                : `This case was already ${c.overallStatus}. Decisions can't be changed here.`}
            </p>
          </div>
        </RoleGate>
      </div>
    );
  }

  function renderSection(title: string, list: VerificationCase[]) {
    return (
      <div className="review-section">
        <div className="review-section-header">
          <span className="review-section-title">{title}</span>
          <Badge label={String(list.length)} tone="neutral" />
        </div>
        <div className="case-list">
          {list.map((c) => {
            const badge = queueBadge(c);
            const isOpen = c.driverId === selectedDriverId;
            return (
              <div key={c.driverId} className={`case-item ${isOpen ? 'case-item-active' : ''}`}>
                <button
                  className="case-row"
                  onClick={() => toggle(c.driverId)}
                  aria-expanded={isOpen}
                  aria-controls={`verification-case-detail-${c.driverId}`}
                >
                  <div className="case-row-left">
                    <div className="case-top">
                      <span className="case-name">{c.driverFullName}</span>
                      <Badge label={badge.label} tone={badge.tone} />
                    </div>
                    <span className="case-sub">
                      {c.plateNo} · {queueContext(c)}
                    </span>
                  </div>
                  <div className="case-row-right">
                    <ChevronIcon open={isOpen} />
                  </div>
                </button>
                {isOpen && renderCaseDetail(c)}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="review-page">
        {loading && cases.length === 0 && <div style={{ color: 'var(--ink-faint)', fontSize: 12 }}>Loading…</div>}
        {!loading && cases.length === 0 && <EmptyState message="No verification cases yet." hint="New driver submissions appear here." />}
        {pendingCases.length > 0 && renderSection('Pending Review', pendingCases)}
        {decidedCases.length > 0 && renderSection('Decided', decidedCases)}
      </div>

      {pendingDecision && (
        <ConfirmModal
          title={DECISION_COPY[pendingDecision.kind].title}
          message={DECISION_COPY[pendingDecision.kind].message(pendingDecision.case)}
          confirmLabel={DECISION_COPY[pendingDecision.kind].confirmLabel}
          tone={DECISION_COPY[pendingDecision.kind].tone}
          confirmLoading={deciding !== null}
          error={error}
          onCancel={() => setPendingDecision(null)}
          onConfirm={handleConfirmDecision}
        />
      )}
    </div>
  );
}

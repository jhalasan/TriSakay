import { useEffect, useState } from 'react';
import { DocumentImage } from '../components/DocumentImage';
import { TextField } from '../components/TextField';
import { Textarea } from '../components/Textarea';
import { Button } from '../components/Button';
import { Badge, type BadgeTone } from '../components/Badge';
import { Avatar } from '../components/Avatar';
import { RoleGate } from '../components/RoleGate';
import { ConfirmModal } from '../components/ConfirmModal';
import { Modal } from '../components/Modal';
import { ErrorBanner } from '../components/ErrorBanner';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { useDiscountsStore } from '../store/useDiscountsStore';
import { useSettingsStore } from '../store/useSettingsStore';
import type { DiscountRow } from '../types/discount';
import { formatRelativeTime, titleCaseLabel } from '../lib/format';
import styles from './DiscountReview.module.css';

const CATEGORY_LABEL: Record<DiscountRow['category'], string> = {
  senior_citizen: 'Senior Citizen',
  pwd: 'PWD',
  student: 'Student',
};

function queueBadge(d: DiscountRow): { label: string; tone: BadgeTone } {
  if (d.status === 'approved') return { label: 'Approved', tone: 'success' };
  if (d.status === 'rejected') return { label: 'Rejected', tone: 'danger' };
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
 * FR-3.10-3.15/UC48 — Senior/PWD/Student fare discount review.
 *
 * Single-column accordion, mirroring DriverVerification.tsx: applications
 * are grouped into "Pending Review" and "Decided" rather than mixed
 * together, and each one expands in place instead of opening in a
 * separate pane — a reviewer reads one ID and decides it before moving
 * to the next, so there's nothing to gain from tiling queue/evidence/
 * decision side by side.
 */
type DecisionKind = 'approve' | 'reject';

/** Names what each decision actually does, per the P0 finding from the 2026-09 critique: Approve/Reject
 * previously fired straight from the button with no checkpoint, unlike every other S+ action in this app. */
const DECISION_COPY: Record<DecisionKind, { title: string; confirmLabel: string; tone: 'primary' | 'danger'; message: (d: DiscountRow) => string }> = {
  approve: {
    title: 'Approve discount',
    confirmLabel: 'Approve',
    tone: 'primary',
    message: (d) => `Approve ${d.passengerName}'s ${CATEGORY_LABEL[d.category]} discount? This sets their fare discount for every future booking.`,
  },
  reject: {
    title: 'Reject discount',
    confirmLabel: 'Reject',
    tone: 'danger',
    message: (d) => `Reject ${d.passengerName}'s ${CATEGORY_LABEL[d.category]} discount application? They'll see your remarks in the app.`,
  },
};

export function DiscountReview() {
  const { items, selectedId, loading, error, fetch, select, updateFields, approve, reject } = useDiscountsStore();
  const fareConfig = useSettingsStore((state) => state.fareConfig);
  const fetchSettings = useSettingsStore((state) => state.fetch);
  const [remarksDraft, setRemarksDraft] = useState('');
  const [deciding, setDeciding] = useState<'approve' | 'reject' | null>(null);
  const [pendingDecision, setPendingDecision] = useState<DecisionKind | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    if (!fareConfig) fetchSettings();
  }, [fareConfig, fetchSettings]);

  const selected = items.find((d) => d.id === selectedId) ?? null;
  const pending = items.filter((d) => d.status === 'pending');
  const decided = items.filter((d) => d.status === 'approved' || d.status === 'rejected');

  async function handleConfirmDecision() {
    if (!selected || !pendingDecision) return;
    setDeciding(pendingDecision);
    const ok =
      pendingDecision === 'approve' ? await approve(selected.id, remarksDraft || undefined) : await reject(selected.id, remarksDraft);
    setDeciding(null);
    if (!ok) return;
    setPendingDecision(null);
    showToast({ message: `${selected.passengerName}'s discount ${pendingDecision === 'approve' ? 'approved' : 'rejected'}.` });
    // Move straight to the next application still needing a decision —
    // approve/reject already refetched, so read the store directly rather
    // than the stale `items` this closure captured at render time.
    const next = useDiscountsStore.getState().items.find((other) => other.status === 'pending' && other.id !== selected.id);
    select(next?.id ?? null);
    setRemarksDraft(next?.remarks ?? '');
  }

  function toggle(d: DiscountRow) {
    setPendingDecision(null);
    if (d.id === selectedId) {
      select(null);
      return;
    }
    select(d.id);
    setRemarksDraft(d.remarks ?? '');
  }

  if (error && items.length === 0 && !loading) {
    return (
      <div className="page">
        <EmptyState
          message="Couldn't load discount applications."
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

  function renderDetail(d: DiscountRow) {
    return (
      <div className="case-detail-modal">
        <div className="evidence-header">
          <Avatar fullName={d.passengerName} size={34} />
          <div className="evidence-header-text">
            <span className="evidence-name">{d.passengerName}</span>
            <span className="case-sub">
              {CATEGORY_LABEL[d.category]} · OSCA ID: {d.idNumber || '—'}
            </span>
          </div>
          {fareConfig && <Badge label={`${fareConfig.discountRatePercent}% statutory discount`} tone="info" />}
        </div>

        <div className="evidence-grid">
          <div>
            <div className="doc-label">ID — Front</div>
            <DocumentImage bucket="discount-ids" path={d.idPhotoFrontPath} alt={`${d.passengerName} — ID front`} height={160} />
          </div>
          <div>
            <div className="doc-label">ID — Back</div>
            <DocumentImage bucket="discount-ids" path={d.idPhotoBackPath} alt={`${d.passengerName} — ID back`} height={160} />
          </div>
        </div>

        <div className={styles.transcription}>
          <TextField
            label="ID Number"
            value={d.idNumber}
            onChange={(e) => updateFields(d.id, { idNumber: e.target.value })}
            placeholder="e.g. OSCA-GSC-114-2019"
          />
          <TextField
            label="Date of Birth"
            type="date"
            value={d.dateOfBirth}
            onChange={(e) => updateFields(d.id, { dateOfBirth: e.target.value })}
          />
          <TextField
            label="Issuing Office"
            value={d.issuingOffice}
            onChange={(e) => updateFields(d.id, { issuingOffice: e.target.value })}
            placeholder="e.g. OSCA General Santos"
          />
        </div>

        <div className="decision-body">
          <Textarea
            label="Remarks"
            value={remarksDraft}
            onChange={(e) => setRemarksDraft(e.target.value)}
            placeholder="Notes on the application, required if rejecting…"
          />

          <ErrorBanner message={error} />

          <RoleGate
            min="supervisor"
            fallback={<div className="read-only-note">Approve / Reject — PSO Supervisor &amp; Administrator only. PSO Staff: read-only review.</div>}
          >
            <div className="decision-row">
              <Button
                variant="solid"
                tone="primary"
                superscript="S+"
                fullWidth
                loading={deciding === 'approve'}
                disabled={deciding !== null || d.status !== 'pending'}
                onClick={() => setPendingDecision('approve')}
              >
                {deciding === 'approve' ? 'Approving…' : 'Approve'}
              </Button>
              <Button
                variant="outline"
                tone="danger"
                superscript="S+"
                fullWidth
                loading={deciding === 'reject'}
                disabled={deciding !== null || d.status !== 'pending' || !remarksDraft.trim()}
                onClick={() => setPendingDecision('reject')}
              >
                {deciding === 'reject' ? 'Rejecting…' : 'Reject'}
              </Button>
            </div>
            <p className="footnote">
              {d.status === 'pending' ? 'Rejecting requires remarks — the passenger sees them in the app.' : `This application was already ${d.status}. Decisions can't be changed here.`}
            </p>
          </RoleGate>
        </div>
      </div>
    );
  }

  function renderSection(title: string, list: DiscountRow[]) {
    return (
      <div className="review-section">
        <div className="review-section-header">
          <span className="review-section-title">{title}</span>
          <Badge label={String(list.length)} tone="neutral" />
        </div>
        <div className="case-list">
          {list.map((d) => {
            const badge = queueBadge(d);
            const isOpen = d.id === selectedId;
            return (
              <div key={d.id} className={`case-item ${isOpen ? 'case-item-active' : ''}`}>
                <button className="case-row" onClick={() => toggle(d)}>
                  <div className="case-row-left">
                    <div className="case-top">
                      <span className="case-name">{d.passengerName}</span>
                      <Badge label={badge.label} tone={badge.tone} />
                    </div>
                    <span className="case-sub">
                      {CATEGORY_LABEL[d.category]} · applied {formatRelativeTime(d.submittedAt)}
                    </span>
                  </div>
                  <div className="case-row-right">
                    <ChevronIcon open={isOpen} />
                  </div>
                </button>
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
        {loading && items.length === 0 && <div style={{ color: 'var(--ink-faint)', fontSize: 12 }}>Loading…</div>}
        {!loading && items.length === 0 && (
          <EmptyState message="No discount applications to review." hint="New senior, PWD, and student applications appear here." />
        )}
        {pending.length > 0 && renderSection('Pending Review', pending)}
        {decided.length > 0 && renderSection('Decided', decided)}
      </div>

      {selected && !pendingDecision && (
        <Modal title={selected.passengerName} onClose={() => toggle(selected)} size="lg">
          {renderDetail(selected)}
        </Modal>
      )}

      {selected && pendingDecision && (
        <ConfirmModal
          title={DECISION_COPY[pendingDecision].title}
          message={DECISION_COPY[pendingDecision].message(selected)}
          confirmLabel={DECISION_COPY[pendingDecision].confirmLabel}
          tone={DECISION_COPY[pendingDecision].tone}
          confirmLoading={deciding !== null}
          error={error}
          onCancel={() => setPendingDecision(null)}
          onConfirm={handleConfirmDecision}
        />
      )}
    </div>
  );
}

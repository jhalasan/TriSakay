import { useEffect, useState } from 'react';
import { DocumentImage } from '../components/DocumentImage';
import { TextField } from '../components/TextField';
import { Textarea } from '../components/Textarea';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Avatar } from '../components/Avatar';
import { RoleGate } from '../components/RoleGate';
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

const RECENTLY_DECIDED_LIMIT = 5;

/**
 * FR-3.10-3.15/UC48 — Senior/PWD/Student fare discount review. Restyled
 * per docs/design_handoff_trisakay_admin/README.md §06 — three
 * independently-scrolling panes (queue / evidence / decision), mirroring
 * DriverVerification.tsx's layout since this is also an S+-gated document
 * review, not a status-toggle list like Driver/Passenger Management.
 */
export function DiscountReview() {
  const { items, selectedId, loading, error, fetch, select, updateFields, approve, reject } = useDiscountsStore();
  const fareConfig = useSettingsStore((state) => state.fareConfig);
  const fetchSettings = useSettingsStore((state) => state.fetch);
  const [remarksDraft, setRemarksDraft] = useState('');
  const [deciding, setDeciding] = useState<'approve' | 'reject' | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    if (!fareConfig) fetchSettings();
  }, [fareConfig, fetchSettings]);

  const selected = items.find((d) => d.id === selectedId) ?? null;

  async function handleApprove() {
    if (!selected) return;
    setDeciding('approve');
    const ok = await approve(selected.id, remarksDraft || undefined);
    setDeciding(null);
    if (ok) showToast({ message: `${selected.passengerName}'s discount approved.` });
  }

  async function handleReject() {
    if (!selected) return;
    setDeciding('reject');
    const ok = await reject(selected.id, remarksDraft);
    setDeciding(null);
    if (ok) showToast({ message: `${selected.passengerName}'s discount rejected.` });
  }
  const pending = items.filter((d) => d.status === 'pending');
  const recentlyDecided = items
    .filter((d) => d.status === 'approved' || d.status === 'rejected')
    .slice(-RECENTLY_DECIDED_LIMIT)
    .reverse();

  function openReview(d: DiscountRow) {
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

  return (
    <div className="review-page">
      <div className="review-grid review-grid-3">
        <div className="panel review-pane">
          <div className="pane-header">
            <h2 className="panel-title" style={{ marginBottom: 0 }}>
              Pending Applications
            </h2>
            <Badge label={String(pending.length)} tone="neutral" />
          </div>
          <div className="pane-scroll">
            {loading && <div style={{ color: 'var(--ink-faint)', fontSize: 12 }}>Loading…</div>}
            {!loading && pending.length === 0 && <EmptyState message="No discount applications to review." hint="New senior, PWD, and student applications appear here." />}
            <div className="case-list">
              {pending.map((d) => (
                <button key={d.id} className={`case-row ${d.id === selectedId ? 'case-row-active' : ''}`} onClick={() => openReview(d)}>
                  <div className="case-top">
                    <span className="case-name">{d.passengerName}</span>
                    <Badge label={titleCaseLabel(d.status)} tone="warn" />
                  </div>
                  <span className="case-sub">
                    {CATEGORY_LABEL[d.category]} · applied {formatRelativeTime(d.submittedAt)}
                  </span>
                </button>
              ))}
            </div>

            {recentlyDecided.length > 0 && (
              <div className={styles.recentlyDecided}>
                <span className="field-label">Recently decided</span>
                {recentlyDecided.map((d) => (
                  <div key={d.id} className={styles.recentRow}>
                    <span>{d.passengerName}</span>
                    <Badge label={titleCaseLabel(d.status)} tone={d.status === 'approved' ? 'success' : 'danger'} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="panel review-pane">
          {selected ? (
            <>
              <div className="evidence-header">
                <Avatar fullName={selected.passengerName} size={34} />
                <div className="evidence-header-text">
                  <span className="evidence-name">{selected.passengerName}</span>
                  <span className="case-sub">
                    {CATEGORY_LABEL[selected.category]} · OSCA ID: {selected.idNumber || '—'}
                  </span>
                </div>
                {fareConfig && <Badge label={`${fareConfig.discountRatePercent}% statutory discount`} tone="info" />}
              </div>
              <div className="pane-scroll">
                <div className="evidence-grid">
                  <div>
                    <div className="doc-label">ID — Front</div>
                    <DocumentImage bucket="discount-ids" path={selected.idPhotoFrontPath} alt={`${selected.passengerName} — ID front`} height={160} />
                  </div>
                  <div>
                    <div className="doc-label">ID — Back</div>
                    <DocumentImage bucket="discount-ids" path={selected.idPhotoBackPath} alt={`${selected.passengerName} — ID back`} height={160} />
                  </div>
                </div>
                <div className={styles.transcription}>
                  <TextField
                    label="ID Number"
                    value={selected.idNumber}
                    onChange={(e) => updateFields(selected.id, { idNumber: e.target.value })}
                    placeholder="e.g. OSCA-GSC-114-2019"
                  />
                  <TextField
                    label="Date of Birth"
                    type="date"
                    value={selected.dateOfBirth}
                    onChange={(e) => updateFields(selected.id, { dateOfBirth: e.target.value })}
                  />
                  <TextField
                    label="Issuing Office"
                    value={selected.issuingOffice}
                    onChange={(e) => updateFields(selected.id, { issuingOffice: e.target.value })}
                    placeholder="e.g. OSCA General Santos"
                  />
                </div>
              </div>
            </>
          ) : (
            <EmptyState message="Select an application to review its ID." icon={false} />
          )}
        </div>

        <div className="panel review-pane">
          {selected ? (
            <>
              <div className="pane-header-stack">
                <h2 className="panel-title" style={{ marginBottom: 2 }}>
                  Decision
                </h2>
                <p className="pane-subtitle">Approval sets the passenger's fare discount for every future booking.</p>
              </div>
              <div className="pane-scroll decision-body">
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
                      disabled={deciding !== null || !remarksDraft.trim()}
                      onClick={handleReject}
                    >
                      {deciding === 'reject' ? 'Rejecting…' : 'Reject'}
                    </Button>
                  </div>
                  <p className="footnote">Rejecting requires remarks — the passenger sees them in the app.</p>
                </RoleGate>
              </div>
            </>
          ) : (
            <EmptyState message="Select an application to decide it." icon={false} />
          )}
        </div>
      </div>
    </div>
  );
}

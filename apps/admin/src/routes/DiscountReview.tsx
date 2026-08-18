import { useEffect, useState } from 'react';
import { PlaceholderBox } from '../components/PlaceholderBox';
import { Textarea } from '../components/Textarea';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { RoleGate } from '../components/RoleGate';
import { useDiscountsStore } from '../store/useDiscountsStore';
import type { DiscountRow } from '../types/discount';
import { titleCaseLabel } from '../lib/format';
import styles from './DiscountReview.module.css';

const CATEGORY_LABEL: Record<DiscountRow['category'], string> = {
  senior_citizen: 'Senior Citizen',
  pwd: 'PWD',
  student: 'Student',
};

/**
 * FR-3.10-3.15/UC48 — Senior/PWD/Student fare discount review. Mirrors
 * DriverVerification.tsx's case-list + review-panel layout rather than a
 * plain DataTable, since this is also an S+-gated document review, not a
 * status-toggle list like Driver/Passenger Management.
 */
export function DiscountReview() {
  const { items, selectedId, loading, error, fetch, select, approve, reject } = useDiscountsStore();
  const [remarksDraft, setRemarksDraft] = useState('');

  useEffect(() => {
    fetch();
  }, [fetch]);

  const selected = items.find((d) => d.id === selectedId) ?? null;

  function openReview(d: DiscountRow) {
    select(d.id);
    setRemarksDraft(d.remarks ?? '');
  }

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

      <div className="panel">
        <div className="panel-title">Pending Applications</div>
        <div className={styles.caseList}>
          {loading && <div style={{ color: 'var(--ink-faint)', fontSize: 12 }}>Loading…</div>}
          {!loading && items.length === 0 && <div style={{ color: 'var(--ink-faint)', fontSize: 12 }}>No discount applications to review.</div>}
          {items.map((d) => (
            <button key={d.id} className={d.id === selectedId ? styles.caseActive : styles.case} onClick={() => openReview(d)}>
              <span>
                {d.passengerName} <span style={{ color: 'var(--ink-faint)' }}>· {CATEGORY_LABEL[d.category]}</span>
              </span>
              <Badge
                label={titleCaseLabel(d.status)}
                tone={d.status === 'approved' ? 'success' : d.status === 'rejected' ? 'danger' : 'warn'}
              />
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className={styles.review}>
          <div className={styles.documents}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginBottom: 6 }}>ID — Front</div>
              <PlaceholderBox label="ID Photo" height={160} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginBottom: 6 }}>ID — Back</div>
              <PlaceholderBox label="ID Photo" height={160} />
            </div>
          </div>

          <div className={`panel ${styles.sidebar}`}>
            <div className="panel-title">
              {selected.passengerName} — {CATEGORY_LABEL[selected.category]}
            </div>
            <Textarea
              label="Remarks"
              value={remarksDraft}
              onChange={(e) => setRemarksDraft(e.target.value)}
              placeholder="Notes on the application, required if rejecting…"
            />

            <RoleGate
              min="supervisor"
              fallback={<div className={styles.readOnlyNote}>Approve / Reject — PSO Supervisor &amp; Administrator only. PSO Staff: read-only review.</div>}
            >
              <div className={styles.decisionRow}>
                <Button variant="solid" tone="primary" superscript="S+" fullWidth onClick={() => approve(selected.id, remarksDraft || undefined)}>
                  Approve
                </Button>
                <Button
                  variant="outline"
                  tone="danger"
                  superscript="S+"
                  fullWidth
                  disabled={!remarksDraft.trim()}
                  onClick={() => reject(selected.id, remarksDraft)}
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

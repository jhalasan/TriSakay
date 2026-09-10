import { useEffect, useMemo, useState } from 'react';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Badge, type BadgeTone } from '../components/Badge';
import { Button } from '../components/Button';
import { Select } from '../components/Select';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { useAuditLogStore } from '../store/useAuditLogStore';
import type { AccountActionRow, ReviewDecisionRow } from '../services/auditLog';
import { formatDateTime, titleCaseLabel } from '../lib/format';
import { downloadCsv, toCsv } from '../lib/csv';
import styles from './AuditLog.module.css';

const ACTION_TONE: Record<AccountActionRow['actionType'], BadgeTone> = {
  flag: 'warn',
  unflag: 'neutral',
  suspend: 'danger',
  reactivate: 'success',
  deactivate: 'danger',
};

const columns: DataTableColumn<AccountActionRow>[] = [
  { key: 'when', header: 'When', sortValue: (a) => a.createdAt, render: (a) => formatDateTime(a.createdAt) },
  {
    key: 'action',
    header: 'Action',
    sortValue: (a) => a.actionType,
    render: (a) => <Badge label={titleCaseLabel(a.actionType)} tone={ACTION_TONE[a.actionType]} />,
  },
  { key: 'target', header: 'Target', sortValue: (a) => a.targetUserName ?? '', render: (a) => <span style={{ fontWeight: 600 }}>{a.targetUserName ?? '—'}</span> },
  { key: 'by', header: 'Performed By', sortValue: (a) => a.performedByName ?? '', render: (a) => a.performedByName ?? '—' },
  { key: 'reason', header: 'Reason', render: (a) => a.reason },
  { key: 'complaint', header: 'Linked Complaint', render: (a) => (a.complaintId ? <span className="mono">{a.complaintId}</span> : '—') },
];

const DECISION_TONE: Record<ReviewDecisionRow['status'], BadgeTone> = {
  approved: 'success',
  rejected: 'danger',
};

const DECISION_TYPE_LABEL: Record<ReviewDecisionRow['type'], string> = {
  driver_verification: 'Driver Verification',
  discount: 'Fare Discount',
};

const decisionColumns: DataTableColumn<ReviewDecisionRow>[] = [
  { key: 'when', header: 'When', sortValue: (r) => r.reviewedAt, render: (r) => formatDateTime(r.reviewedAt) },
  { key: 'type', header: 'Type', sortValue: (r) => r.type, render: (r) => DECISION_TYPE_LABEL[r.type] },
  { key: 'subject', header: 'Subject', sortValue: (r) => r.subjectName ?? '', render: (r) => <span style={{ fontWeight: 600 }}>{r.subjectName ?? '—'}</span> },
  { key: 'detail', header: 'Category', render: (r) => (r.detail ? titleCaseLabel(r.detail) : '—') },
  { key: 'status', header: 'Decision', sortValue: (r) => r.status, render: (r) => <Badge label={titleCaseLabel(r.status)} tone={DECISION_TONE[r.status]} /> },
  { key: 'by', header: 'Reviewed By', sortValue: (r) => r.reviewedByName ?? '', render: (r) => r.reviewedByName ?? '—' },
];

type ActionFilter = 'all' | 'flags' | 'suspensions' | 'reinstatements';

const ACTION_FILTER_TABS: { label: string; value: ActionFilter }[] = [
  { label: 'All actions', value: 'all' },
  { label: 'Flags', value: 'flags' },
  { label: 'Suspensions', value: 'suspensions' },
  { label: 'Reinstatements', value: 'reinstatements' },
];

/** flag/unflag/suspend/deactivate/reactivate collapse into the strip's four tabs — "Suspensions" covers both punitive actions, "Reinstatements" both restorative ones. */
function matchesActionFilter(a: AccountActionRow, filter: ActionFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'flags') return a.actionType === 'flag';
  if (filter === 'suspensions') return a.actionType === 'suspend' || a.actionType === 'deactivate';
  return a.actionType === 'reactivate' || a.actionType === 'unflag';
}

const DATE_RANGE_OPTIONS = [
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 30 days', value: '30' },
  { label: 'All time', value: 'all' },
];

function withinDays(iso: string, days: string): boolean {
  if (days === 'all') return true;
  const cutoff = Date.now() - Number(days) * 24 * 60 * 60 * 1000;
  return new Date(iso).getTime() >= cutoff;
}

/**
 * Reads account_actions (docs/SCHEMA.MD §3.2) — the audit trail every
 * Flag/Suspend/Reactivate/Deactivate/Unflag on Driver/Passenger/PSO User
 * management already writes to, surfaced here for the first time. Read-only,
 * visible to every signed-in PSO role (min: 'staff' in lib/navigation.ts),
 * matching the account_actions RLS policy (`actions_read_pso`) which already
 * lets any is_pso() account read every row — transparency across tiers is
 * the point, not an Administrator-only view. Restyled per README §10 — a
 * filter strip scopes only the Account Actions table; Verification &
 * Discount Decisions has none, which its own header states.
 *
 * Second table merges driver-verification (driver_profiles.verified_by/
 * verified_at) and fare-discount (passenger_discounts.reviewed_by/
 * reviewed_at) decisions — the other reviewed_by/verified_by stamps this
 * app already writes on every Approve/Reject but never read back, called
 * out as a known gap when the account_actions table above was added.
 */
export function AuditLog() {
  const { actions, loading, error, decisions, decisionsLoading, fetch } = useAuditLogStore();
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const [dateRange, setDateRange] = useState('7');
  const [performedBy, setPerformedBy] = useState('all');
  const { showToast } = useToast();

  useEffect(() => {
    fetch();
  }, [fetch]);

  const performerOptions = useMemo(() => {
    const names = [...new Set(actions.map((a) => a.performedByName).filter((n): n is string => !!n))].sort();
    return [{ label: 'Any PSO user', value: 'all' }, ...names.map((n) => ({ label: n, value: n }))];
  }, [actions]);

  const filteredActions = useMemo(
    () =>
      actions.filter(
        (a) =>
          matchesActionFilter(a, actionFilter) &&
          withinDays(a.createdAt, dateRange) &&
          (performedBy === 'all' || a.performedByName === performedBy)
      ),
    [actions, actionFilter, dateRange, performedBy]
  );

  function exportCsv() {
    const csv = toCsv(filteredActions, [
      { header: 'When', value: (a) => a.createdAt },
      { header: 'Action', value: (a) => titleCaseLabel(a.actionType) },
      { header: 'Target', value: (a) => a.targetUserName ?? '' },
      { header: 'Performed By', value: (a) => a.performedByName ?? '' },
      { header: 'Reason', value: (a) => a.reason },
      { header: 'Linked Complaint', value: (a) => a.complaintId ?? '' },
    ]);
    const filename = `account-actions-${new Date().toISOString().slice(0, 10)}.csv`;
    const url = downloadCsv(filename, csv);
    showToast({ message: `Export ready — ${filename}`, action: { label: 'Open', onClick: () => window.open(url, '_blank') } });
  }

  if (error && actions.length === 0 && decisions.length === 0 && !loading && !decisionsLoading) {
    return (
      <div className="page">
        <EmptyState
          message="Couldn't load account actions."
          hint="The audit service didn't respond. Nothing has changed — try again."
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
    <div className="page">
      <div className={`panel ${styles.filterStrip}`}>
        <div className="segmented">
          {ACTION_FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={`segment-button ${actionFilter === tab.value ? 'segment-button-active' : ''}`}
              onClick={() => setActionFilter(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Select aria-label="Date range" value={dateRange} onChange={(e) => setDateRange(e.target.value)} options={DATE_RANGE_OPTIONS} />
        <Select aria-label="Performed by" value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} options={performerOptions} />
      </div>

      <div className="panel">
        <div className={styles.tableHeader}>
          <h2 className="panel-title" style={{ marginBottom: 0 }}>
            Account Actions
          </h2>
          <div className={styles.tableHeaderRight}>
            <span className={styles.recordCount}>{filteredActions.length} recorded · newest first</span>
            <Badge label="Read-only · all PSO roles" tone="neutral" />
            <Button variant="outline" tone="neutral" size="sm" disabled={filteredActions.length === 0} onClick={exportCsv}>
              Export CSV
            </Button>
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={filteredActions}
          getRowKey={(a) => a.id}
          loading={loading}
          emptyMessage="No account actions recorded yet."
          emptyHint="Flags, suspensions and reinstatements appear here the moment they're made."
        />
      </div>

      <div className="panel">
        <div className={styles.tableHeader}>
          <h2 className="panel-title" style={{ marginBottom: 0 }}>
            Verification &amp; Discount Decisions
          </h2>
          <span className={styles.recordCount}>Approvals and rejections, both queues — not filtered above.</span>
        </div>
        <DataTable
          columns={decisionColumns}
          rows={decisions}
          getRowKey={(r) => r.id}
          loading={decisionsLoading}
          emptyMessage="No verification or discount decisions recorded yet."
        />
      </div>
    </div>
  );
}

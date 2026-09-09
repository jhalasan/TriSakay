import { useEffect } from 'react';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Badge, type BadgeTone } from '../components/Badge';
import { ErrorBanner } from '../components/ErrorBanner';
import { useAuditLogStore } from '../store/useAuditLogStore';
import type { AccountActionRow, ReviewDecisionRow } from '../services/auditLog';
import { formatDateTime, titleCaseLabel } from '../lib/format';

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
  { key: 'target', header: 'Target', sortValue: (a) => a.targetUserName ?? '', render: (a) => a.targetUserName ?? '—' },
  { key: 'by', header: 'Performed By', sortValue: (a) => a.performedByName ?? '', render: (a) => a.performedByName ?? '—' },
  { key: 'reason', header: 'Reason', render: (a) => a.reason },
  { key: 'complaint', header: 'Linked Complaint', render: (a) => a.complaintId ?? '—' },
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
  { key: 'subject', header: 'Subject', sortValue: (r) => r.subjectName ?? '', render: (r) => r.subjectName ?? '—' },
  { key: 'detail', header: 'Category', render: (r) => (r.detail ? titleCaseLabel(r.detail) : '—') },
  { key: 'status', header: 'Decision', sortValue: (r) => r.status, render: (r) => <Badge label={titleCaseLabel(r.status)} tone={DECISION_TONE[r.status]} /> },
  { key: 'by', header: 'Reviewed By', sortValue: (r) => r.reviewedByName ?? '', render: (r) => r.reviewedByName ?? '—' },
];

/**
 * Reads account_actions (docs/SCHEMA.MD §3.2) — the audit trail every
 * Flag/Suspend/Reactivate/Deactivate/Unflag on Driver/Passenger/PSO User
 * management already writes to, surfaced here for the first time. Read-only,
 * visible to every signed-in PSO role (min: 'staff' in lib/navigation.ts),
 * matching the account_actions RLS policy (`actions_read_pso`) which already
 * lets any is_pso() account read every row — transparency across tiers is
 * the point, not an Administrator-only view.
 *
 * Second table merges driver-verification (driver_profiles.verified_by/
 * verified_at) and fare-discount (passenger_discounts.reviewed_by/
 * reviewed_at) decisions — the other reviewed_by/verified_by stamps this
 * app already writes on every Approve/Reject but never read back, called
 * out as a known gap when the account_actions table above was added.
 */
export function AuditLog() {
  const { actions, loading, error, decisions, decisionsLoading, fetch } = useAuditLogStore();

  useEffect(() => {
    fetch();
  }, [fetch]);

  return (
    <div className="page">
      <ErrorBanner message={error} />
      <DataTable columns={columns} rows={actions} getRowKey={(a) => a.id} loading={loading} emptyMessage="No account actions recorded yet." />

      <h2 className="panel-title">Verification &amp; Discount Decisions</h2>
      <DataTable
        columns={decisionColumns}
        rows={decisions}
        getRowKey={(r) => r.id}
        loading={decisionsLoading}
        emptyMessage="No verification or discount decisions recorded yet."
      />
    </div>
  );
}

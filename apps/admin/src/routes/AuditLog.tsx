import { useEffect } from 'react';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Badge, type BadgeTone } from '../components/Badge';
import { ErrorBanner } from '../components/ErrorBanner';
import { useAuditLogStore } from '../store/useAuditLogStore';
import type { AccountActionRow } from '../services/auditLog';
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

/**
 * Reads account_actions (docs/SCHEMA.MD §3.2) — the audit trail every
 * Flag/Suspend/Reactivate/Deactivate/Unflag on Driver/Passenger/PSO User
 * management already writes to, surfaced here for the first time. Read-only,
 * visible to every signed-in PSO role (min: 'staff' in lib/navigation.ts),
 * matching the account_actions RLS policy (`actions_read_pso`) which already
 * lets any is_pso() account read every row — transparency across tiers is
 * the point, not an Administrator-only view.
 */
export function AuditLog() {
  const { actions, loading, error, fetch } = useAuditLogStore();

  useEffect(() => {
    fetch();
  }, [fetch]);

  return (
    <div className="page">
      <ErrorBanner message={error} />
      <DataTable columns={columns} rows={actions} getRowKey={(a) => a.id} loading={loading} emptyMessage="No account actions recorded yet." />
    </div>
  );
}

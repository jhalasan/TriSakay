import { useEffect, useMemo, useState } from 'react';
import { TableToolbar } from '../components/TableToolbar';
import { Select } from '../components/Select';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { Badge } from '../components/Badge';
import { Avatar } from '../components/Avatar';
import { RatingSquares } from '../components/RatingSquares';
import { Button } from '../components/Button';
import { RoleGate } from '../components/RoleGate';
import { ConfirmModal } from '../components/ConfirmModal';
import { useDriversStore } from '../store/useDriversStore';
import type { DriverRow } from '../types/driver';
import { titleCaseLabel } from '../lib/format';

type PendingActionKind = 'flag' | 'suspend' | 'reactivate';

interface PendingAction {
  driver: DriverRow;
  kind: PendingActionKind;
}

const ACTION_COPY: Record<PendingActionKind, { title: string; confirmLabel: string; tone: 'primary' | 'danger'; message: (name: string) => string }> = {
  flag: {
    title: 'Flag driver',
    confirmLabel: 'Flag',
    tone: 'primary',
    message: (name) => `Flag ${name}'s account? This is visible to other PSO staff reviewing this driver.`,
  },
  suspend: {
    title: 'Suspend driver',
    confirmLabel: 'Suspend',
    tone: 'danger',
    message: (name) => `Suspend ${name}'s account? They won't be able to accept ride requests until reactivated.`,
  },
  reactivate: {
    title: 'Reactivate driver',
    confirmLabel: 'Reactivate',
    tone: 'primary',
    message: (name) => `Reactivate ${name}'s account?`,
  },
};

const STATUS_TONE: Record<DriverRow['accountStatus'], 'neutral' | 'success' | 'warn' | 'danger'> = {
  active: 'success',
  flagged: 'warn',
  suspended: 'danger',
  deactivated: 'neutral',
};

const PAGE_SIZE = 5;

/** Wireframe screen 3 "Driver management" (FR-6.1, 6.2). */
export function Drivers() {
  const { drivers, loading, error, search, statusFilter, page, fetch, setSearch, setStatusFilter, setPage, flag, suspend, reactivate } =
    useDriversStore();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch();
  }, [fetch]);

  function closeModal() {
    setPendingAction(null);
    setReason('');
  }

  async function handleConfirm() {
    if (!pendingAction) return;
    setSubmitting(true);
    const action = pendingAction.kind === 'flag' ? flag : pendingAction.kind === 'suspend' ? suspend : reactivate;
    const ok = await action(pendingAction.driver.id, reason);
    setSubmitting(false);
    if (ok) closeModal();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return drivers.filter((d) => {
      const matchesSearch = !q || d.fullName.toLowerCase().includes(q) || d.plateNo.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || d.accountStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [drivers, search, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: DataTableColumn<DriverRow>[] = [
    {
      key: 'name',
      header: 'Driver',
      sortValue: (d) => d.fullName,
      render: (d) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar fullName={d.fullName} />
          <div>
            <div style={{ fontWeight: 600 }}>{d.fullName}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{d.plateNo}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'rating',
      header: 'Rating',
      sortValue: (d) => d.ratingAvg,
      render: (d) => (d.ratingCount > 0 ? <RatingSquares value={d.ratingAvg} /> : <span style={{ color: 'var(--ink-faint)' }}>—</span>),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (d) => d.accountStatus,
      render: (d) => <Badge label={titleCaseLabel(d.accountStatus)} tone={STATUS_TONE[d.accountStatus]} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (d) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <Button variant="outline" tone="neutral" size="sm">
            View
          </Button>
          <Button variant="outline" tone="neutral" size="sm" onClick={() => setPendingAction({ driver: d, kind: 'flag' })}>
            Flag
          </Button>
          <RoleGate min="supervisor">
            {d.accountStatus === 'suspended' ? (
              <Button
                variant="outline"
                tone="primary"
                size="sm"
                superscript="S+"
                onClick={() => setPendingAction({ driver: d, kind: 'reactivate' })}
              >
                Reactivate
              </Button>
            ) : (
              <Button
                variant="solid"
                tone="danger"
                size="sm"
                superscript="S+"
                onClick={() => setPendingAction({ driver: d, kind: 'suspend' })}
              >
                Suspend
              </Button>
            )}
          </RoleGate>
        </div>
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
      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name or plate no…"
        filters={
          <Select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            options={[
              { label: 'All statuses', value: 'all' },
              { label: 'Active', value: 'active' },
              { label: 'Flagged', value: 'flagged' },
              { label: 'Suspended', value: 'suspended' },
              { label: 'Deactivated', value: 'deactivated' },
            ]}
          />
        }
        actions={
          <Button variant="outline" tone="neutral" size="sm">
            Export
          </Button>
        }
      />
      <DataTable columns={columns} rows={pageRows} getRowKey={(d) => d.id} loading={loading} emptyMessage="No drivers match your filters." />
      <Pagination page={page} pageCount={pageCount} onChange={setPage} />
      {pendingAction && (
        <ConfirmModal
          title={ACTION_COPY[pendingAction.kind].title}
          message={ACTION_COPY[pendingAction.kind].message(pendingAction.driver.fullName)}
          confirmLabel={ACTION_COPY[pendingAction.kind].confirmLabel}
          tone={ACTION_COPY[pendingAction.kind].tone}
          reasonRequired
          reason={reason}
          onReasonChange={setReason}
          confirmLoading={submitting}
          onCancel={closeModal}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}

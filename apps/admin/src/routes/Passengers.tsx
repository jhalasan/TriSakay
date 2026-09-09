import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TableToolbar } from '../components/TableToolbar';
import { Select } from '../components/Select';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { Badge } from '../components/Badge';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { RoleGate } from '../components/RoleGate';
import { ConfirmModal } from '../components/ConfirmModal';
import { ErrorBanner } from '../components/ErrorBanner';
import { usePassengersStore } from '../store/usePassengersStore';
import type { PassengerRow } from '../types/passenger';
import { formatDate, passengerStatusLabel } from '../lib/format';
import { downloadCsv, toCsv } from '../lib/csv';
import { passengerCsvColumns, exportFilename } from '../lib/exports';

const STATUS_TONE: Record<PassengerRow['accountStatus'], 'neutral' | 'success' | 'warn' | 'danger'> = {
  active: 'success',
  flagged: 'warn',
  suspended: 'danger',
  deactivated: 'neutral',
};

const PAGE_SIZE = 5;

type PendingActionKind = 'block' | 'unblock';

interface PendingAction {
  passenger: PassengerRow;
  kind: PendingActionKind;
}

const ACTION_COPY: Record<PendingActionKind, { title: string; confirmLabel: string; tone: 'primary' | 'danger'; message: (name: string) => string }> = {
  block: {
    title: 'Block passenger',
    confirmLabel: 'Block',
    tone: 'danger',
    message: (name) => `Block ${name}'s account? They won't be able to request rides until unblocked.`,
  },
  unblock: {
    title: 'Unblock passenger',
    confirmLabel: 'Unblock',
    tone: 'primary',
    message: (name) => `Unblock ${name}'s account?`,
  },
};

const BULK_ACTION_COPY: Record<PendingActionKind, { title: string; confirmLabel: string; tone: 'primary' | 'danger'; message: (count: number) => string }> = {
  block: {
    title: 'Block selected passengers',
    confirmLabel: 'Block',
    tone: 'danger',
    message: (count) => `Block ${count} selected passenger(s)? They won't be able to request rides until unblocked.`,
  },
  unblock: {
    title: 'Unblock selected passengers',
    confirmLabel: 'Unblock',
    tone: 'primary',
    message: (count) => `Unblock ${count} selected passenger(s)?`,
  },
};

/** Wireframe screen 5 "Passenger management" (FR-6.1, 6.2). Wireframe labels account_status='suspended' as "Blocked" here. */
export function Passengers() {
  const { passengers, loading, error, search, statusFilter, page, fetch, setSearch, setStatusFilter, setPage, block, unblock, bulkBlock, bulkUnblock } =
    usePassengersStore();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [pendingBulkKind, setPendingBulkKind] = useState<PendingActionKind | null>(null);
  const [bulkReason, setBulkReason] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // From TopBar's global search (?highlight=<id>) — opens that passenger's detail panel, then clears the param so it doesn't re-trigger on a later manual close/re-search.
  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (!highlightId) return;
    setSelectedId(highlightId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('highlight');
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams]);

  function closeModal() {
    setPendingAction(null);
    setReason('');
  }

  async function handleConfirm() {
    if (!pendingAction) return;
    setSubmitting(true);
    const action = pendingAction.kind === 'block' ? block : unblock;
    const ok = await action(pendingAction.passenger.id, reason);
    setSubmitting(false);
    if (ok) closeModal();
  }

  function toggleRow(id: string) {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllOnPage(checked: boolean) {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      for (const row of pageRows) {
        if (checked) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });
  }

  function closeBulkModal() {
    setPendingBulkKind(null);
    setBulkReason('');
  }

  async function handleConfirmBulk() {
    if (!pendingBulkKind) return;
    setBulkSubmitting(true);
    const ids = [...selectedRowIds];
    const action = pendingBulkKind === 'block' ? bulkBlock : bulkUnblock;
    await action(ids, bulkReason);
    setBulkSubmitting(false);
    setSelectedRowIds(new Set());
    closeBulkModal();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return passengers.filter((p) => {
      const matchesSearch = !q || p.fullName.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || p.accountStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [passengers, search, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function exportCsv() {
    // DataTable's column sort is internal state, not lifted here, so this exports in store order (not the on-screen sort order).
    const csv = toCsv(filtered, passengerCsvColumns);
    downloadCsv(exportFilename('passengers', statusFilter), csv);
  }

  const selected = passengers.find((p) => p.id === selectedId) ?? null;

  const detailFields: { label: string; value: ReactNode }[] = selected
    ? [
        { label: 'Contact No', value: selected.contactNo },
        { label: 'Email', value: selected.email },
        { label: 'Total Rides', value: selected.totalRides },
        { label: 'Fare Discount', value: selected.hasApprovedDiscount ? <Badge label="Approved" tone="success" /> : '—' },
        { label: 'Registered', value: formatDate(selected.createdAt) },
        { label: 'Passenger ID', value: <span className="mono">{selected.id}</span> },
      ]
    : [];

  const columns: DataTableColumn<PassengerRow>[] = [
    {
      key: 'name',
      header: 'Passenger',
      sortValue: (p) => p.fullName,
      render: (p) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar fullName={p.fullName} />
          <div>
            <div style={{ fontWeight: 600 }}>{p.fullName}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{p.contactNo}</div>
          </div>
        </div>
      ),
    },
    { key: 'rides', header: 'Total Rides', sortValue: (p) => p.totalRides, render: (p) => p.totalRides, align: 'right' },
    {
      key: 'discount',
      header: 'Fare Discount',
      render: (p) => (p.hasApprovedDiscount ? <Badge label="Approved" tone="success" /> : <span style={{ color: 'var(--ink-faint)' }}>—</span>),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (p) => p.accountStatus,
      render: (p) => <Badge label={passengerStatusLabel(p.accountStatus)} tone={STATUS_TONE[p.accountStatus]} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (p) => (
        <div className="row-actions">
          <Button
            variant={selectedId === p.id ? 'solid' : 'outline'}
            tone="neutral"
            size="sm"
            onClick={() => setSelectedId((prev) => (prev === p.id ? null : p.id))}
          >
            View
          </Button>
          <RoleGate min="supervisor">
            {p.accountStatus === 'suspended' ? (
              <Button
                variant="outline"
                tone="primary"
                size="sm"
                superscript="S+"
                onClick={() => setPendingAction({ passenger: p, kind: 'unblock' })}
              >
                Unblock
              </Button>
            ) : (
              <Button
                variant="solid"
                tone="danger"
                size="sm"
                superscript="S+"
                onClick={() => setPendingAction({ passenger: p, kind: 'block' })}
              >
                Block
              </Button>
            )}
          </RoleGate>
        </div>
      ),
    },
  ];

  return (
    <div className="page">
      <ErrorBanner message={error} />
      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name or email…"
        filters={
          <Select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            options={[
              { label: 'All statuses', value: 'all' },
              { label: 'Active', value: 'active' },
              { label: 'Blocked', value: 'suspended' },
              { label: 'Deactivated', value: 'deactivated' },
            ]}
          />
        }
        actions={
          <Button variant="outline" tone="neutral" size="sm" disabled={filtered.length === 0} onClick={exportCsv}>
            Export
          </Button>
        }
      />
      {selectedRowIds.size > 0 && (
        <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{selectedRowIds.size} selected</span>
          <RoleGate min="supervisor">
            <Button variant="outline" tone="danger" size="sm" superscript="S+" onClick={() => setPendingBulkKind('block')}>
              Block
            </Button>
            <Button variant="outline" tone="primary" size="sm" superscript="S+" onClick={() => setPendingBulkKind('unblock')}>
              Unblock
            </Button>
          </RoleGate>
          <Button variant="ghost" tone="neutral" size="sm" onClick={() => setSelectedRowIds(new Set())} style={{ marginLeft: 'auto' }}>
            Clear selection
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={pageRows}
        getRowKey={(p) => p.id}
        loading={loading}
        emptyMessage="No passengers match your filters."
        selectedIds={selectedRowIds}
        onToggleRow={toggleRow}
        onToggleAll={toggleAllOnPage}
      />
      <Pagination page={safePage} pageCount={pageCount} onChange={setPage} />

      {selected && (
        <div className="panel detail-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Avatar fullName={selected.fullName} />
            <div>
              <h2 className="panel-title" style={{ marginBottom: 2 }}>
                {selected.fullName}
              </h2>
              <Badge label={passengerStatusLabel(selected.accountStatus)} tone={STATUS_TONE[selected.accountStatus]} />
            </div>
          </div>

          {detailFields.map((f) => (
            <div className="field" key={f.label}>
              <span className="field-label">{f.label}</span>
              <span>{f.value}</span>
            </div>
          ))}

          <div className="read-only-note">Showing the record loaded with this list. Full ride history isn't available in the admin portal yet.</div>

          <Button variant="outline" tone="neutral" size="sm" onClick={() => setSelectedId(null)} style={{ alignSelf: 'flex-start' }}>
            Close
          </Button>
        </div>
      )}

      {pendingAction && (
        <ConfirmModal
          title={ACTION_COPY[pendingAction.kind].title}
          message={ACTION_COPY[pendingAction.kind].message(pendingAction.passenger.fullName)}
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

      {pendingBulkKind && (
        <ConfirmModal
          title={BULK_ACTION_COPY[pendingBulkKind].title}
          message={BULK_ACTION_COPY[pendingBulkKind].message(selectedRowIds.size)}
          confirmLabel={BULK_ACTION_COPY[pendingBulkKind].confirmLabel}
          tone={BULK_ACTION_COPY[pendingBulkKind].tone}
          reasonRequired
          reason={bulkReason}
          onReasonChange={setBulkReason}
          confirmLoading={bulkSubmitting}
          onCancel={closeBulkModal}
          onConfirm={handleConfirmBulk}
        />
      )}
    </div>
  );
}

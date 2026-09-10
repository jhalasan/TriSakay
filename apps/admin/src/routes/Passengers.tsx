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
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { usePassengersStore, type PassengerStatusFilter } from '../store/usePassengersStore';
import type { PassengerRow } from '../types/passenger';
import { formatDate, passengerStatusLabel, titleCaseLabel } from '../lib/format';
import { downloadCsv, toCsv } from '../lib/csv';
import { passengerCsvColumns, exportFilename } from '../lib/exports';

const STATUS_TONE: Record<PassengerRow['accountStatus'], 'neutral' | 'success' | 'warn' | 'danger'> = {
  active: 'success',
  flagged: 'warn',
  suspended: 'danger',
  deactivated: 'neutral',
};

const DISCOUNT_STATUS_TONE: Record<string, 'neutral' | 'success' | 'warn' | 'danger'> = {
  approved: 'success',
  pending: 'warn',
  rejected: 'danger',
  unsubmitted: 'neutral',
};

const PAGE_SIZE = 7;

/** README §05 item 1 "Status strip = the filter" — Passengers' fourth cell filters on discount, not account status. */
function StatusStrip({ passengers, active, onSelect }: { passengers: PassengerRow[]; active: PassengerStatusFilter; onSelect: (value: PassengerStatusFilter) => void }) {
  const cells: { label: string; value: PassengerStatusFilter; count: number }[] = [
    { label: 'All passengers', value: 'all', count: passengers.length },
    { label: 'Active', value: 'active', count: passengers.filter((p) => p.accountStatus === 'active').length },
    { label: 'Fare discount approved', value: 'discount_approved', count: passengers.filter((p) => p.discount?.status === 'approved').length },
    { label: 'Blocked', value: 'suspended', count: passengers.filter((p) => p.accountStatus === 'suspended').length },
  ];
  return (
    <div className="panel status-strip">
      {cells.map((cell) => (
        <button
          key={cell.value}
          type="button"
          className={`status-cell ${active === cell.value ? 'status-cell-active' : ''}`}
          onClick={() => onSelect(cell.value)}
        >
          <span className="field-label">{cell.label}</span>
          <span className="status-count">{cell.count}</span>
        </button>
      ))}
    </div>
  );
}

type PendingActionKind = 'block' | 'unblock';

interface PendingAction {
  passenger: PassengerRow;
  kind: PendingActionKind;
}

const ACTION_COPY: Record<
  PendingActionKind,
  { title: string; confirmLabel: string; tone: 'primary' | 'danger'; message: (name: string) => string; pastTense: string }
> = {
  block: {
    title: 'Block passenger',
    confirmLabel: 'Block',
    tone: 'danger',
    message: (name) => `Block ${name}'s account? They won't be able to request rides until unblocked.`,
    pastTense: 'blocked',
  },
  unblock: {
    title: 'Unblock passenger',
    confirmLabel: 'Unblock',
    tone: 'primary',
    message: (name) => `Unblock ${name}'s account?`,
    pastTense: 'unblocked',
  },
};

const BULK_ACTION_COPY: Record<
  PendingActionKind,
  { title: string; confirmLabel: string; tone: 'primary' | 'danger'; message: (count: number) => string; pastTense: string }
> = {
  block: {
    title: 'Block selected passengers',
    confirmLabel: 'Block',
    tone: 'danger',
    message: (count) => `Block ${count} selected passenger(s)? They won't be able to request rides until unblocked.`,
    pastTense: 'blocked',
  },
  unblock: {
    title: 'Unblock selected passengers',
    confirmLabel: 'Unblock',
    tone: 'primary',
    message: (count) => `Unblock ${count} selected passenger(s)?`,
    pastTense: 'unblocked',
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
  const { showToast } = useToast();

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
    if (!ok) return;
    showToast({ message: `${pendingAction.passenger.fullName} ${ACTION_COPY[pendingAction.kind].pastTense}.` });
    closeModal();
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
    const summary = await action(ids, bulkReason);
    setBulkSubmitting(false);
    if (summary.failed > 0) return; // keep the modal open — store.error (shown in the modal) already names the count that failed
    showToast({ message: `${summary.succeeded} passenger(s) ${BULK_ACTION_COPY[pendingBulkKind].pastTense}.` });
    setSelectedRowIds(new Set());
    closeBulkModal();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return passengers.filter((p) => {
      const matchesSearch = !q || p.fullName.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === 'all' ? true : statusFilter === 'discount_approved' ? p.discount?.status === 'approved' : p.accountStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [passengers, search, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function exportCsv() {
    // DataTable's column sort is internal state, not lifted here, so this exports in store order (not the on-screen sort order).
    const csv = toCsv(filtered, passengerCsvColumns);
    const filename = exportFilename('passengers', statusFilter);
    const url = downloadCsv(filename, csv);
    showToast({ message: `Export ready — ${filename}`, action: { label: 'Open', onClick: () => window.open(url, '_blank') } });
  }

  const selected = passengers.find((p) => p.id === selectedId) ?? null;

  const detailFields: { label: string; value: ReactNode }[] = selected
    ? [
        { label: 'Contact No', value: selected.contactNo },
        { label: 'Email', value: selected.email },
        { label: 'Total Rides', value: selected.totalRides },
        {
          label: 'Fare Discount',
          value: selected.discount ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {titleCaseLabel(selected.discount.category)}
              <Badge label={titleCaseLabel(selected.discount.status)} tone={DISCOUNT_STATUS_TONE[selected.discount.status]} />
            </span>
          ) : (
            '—'
          ),
        },
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
          <div style={{ fontWeight: 600 }}>{p.fullName}</div>
        </div>
      ),
    },
    { key: 'contact', header: 'Contact', sortValue: (p) => p.contactNo, render: (p) => p.contactNo },
    { key: 'rides', header: 'Total Rides', sortValue: (p) => p.totalRides, render: (p) => p.totalRides, align: 'right' },
    {
      key: 'discount',
      header: 'Fare Discount',
      render: (p) =>
        p.discount ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {titleCaseLabel(p.discount.category)}
            <Badge label={titleCaseLabel(p.discount.status)} tone={DISCOUNT_STATUS_TONE[p.discount.status]} />
          </span>
        ) : (
          <span style={{ color: 'var(--ink-faint)' }}>—</span>
        ),
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

  if (error && passengers.length === 0 && !loading) {
    return (
      <div className="page">
        <EmptyState
          message="Couldn't load passengers."
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
    <div className="page">
      <StatusStrip passengers={passengers} active={statusFilter} onSelect={setStatusFilter} />
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
      <div className="list-footer">
        <span className="list-footer-count">
          {filtered.length === 0
            ? 'Showing 0 of 0 passengers'
            : `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)} of ${filtered.length} passengers`}
        </span>
        <Pagination page={safePage} pageCount={pageCount} onChange={setPage} />
      </div>

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
          error={error}
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
          error={error}
          onCancel={closeBulkModal}
          onConfirm={handleConfirmBulk}
        />
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { TableToolbar } from '../components/TableToolbar';
import { Select } from '../components/Select';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { Badge } from '../components/Badge';
import { Avatar } from '../components/Avatar';
import { RatingSquares } from '../components/RatingSquares';
import { Button } from '../components/Button';
import { RoleGate } from '../components/RoleGate';
import { ConfirmModal, SevereIcon } from '../components/ConfirmModal';
import { Modal } from '../components/Modal';
import { DetailSection, AccountIcon, ContactIcon, PerformanceIcon, VehicleIcon } from '../components/DetailSection';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { useDriversStore } from '../store/useDriversStore';
import type { DriverRow } from '../types/driver';
import { formatDate, titleCaseLabel } from '../lib/format';
import { downloadCsv, toCsv } from '../lib/csv';
import { formatBulkTargets } from '../lib/bulkActions';
import { driverCsvColumns, exportFilename } from '../lib/exports';

type PendingActionKind = 'flag' | 'suspend' | 'reactivate';

interface PendingAction {
  driver: DriverRow;
  kind: PendingActionKind;
}

const ACTION_COPY: Record<
  PendingActionKind,
  { title: string; confirmLabel: string; tone: 'primary' | 'danger'; message: (name: string) => string; pastTense: string }
> = {
  flag: {
    title: 'Flag driver',
    confirmLabel: 'Flag',
    tone: 'primary',
    message: (name) => `Flag ${name}'s account? This is visible to other PSO staff reviewing this driver.`,
    pastTense: 'flagged',
  },
  suspend: {
    title: 'Suspend driver',
    confirmLabel: 'Suspend',
    tone: 'danger',
    message: (name) => `Suspend ${name}'s account? They won't be able to accept ride requests until reactivated.`,
    pastTense: 'suspended',
  },
  reactivate: {
    title: 'Reactivate driver',
    confirmLabel: 'Reactivate',
    tone: 'primary',
    message: (name) => `Reactivate ${name}'s account?`,
    pastTense: 'reactivated',
  },
};

const BULK_ACTION_COPY: Record<
  PendingActionKind,
  { title: string; confirmLabel: string; tone: 'primary' | 'danger'; message: (rows: DriverRow[]) => string; pastTense: string }
> = {
  flag: {
    title: 'Flag selected drivers',
    confirmLabel: 'Flag',
    tone: 'primary',
    message: (rows) => `Flag ${rows.length} selected driver(s)? This is visible to other PSO staff reviewing them. ${formatBulkTargets(rows.map((r) => r.fullName))}`,
    pastTense: 'flagged',
  },
  suspend: {
    title: 'Suspend selected drivers',
    confirmLabel: 'Suspend',
    tone: 'danger',
    message: (rows) =>
      `Suspend ${rows.length} selected driver(s)? They won't be able to accept ride requests until reactivated. ${formatBulkTargets(rows.map((r) => r.fullName))}`,
    pastTense: 'suspended',
  },
  reactivate: {
    title: 'Reactivate selected drivers',
    confirmLabel: 'Reactivate',
    tone: 'primary',
    message: (rows) => `Reactivate ${rows.length} selected driver(s)? ${formatBulkTargets(rows.map((r) => r.fullName))}`,
    pastTense: 'reactivated',
  },
};

const STATUS_TONE: Record<DriverRow['accountStatus'], 'neutral' | 'success' | 'warn' | 'danger'> = {
  active: 'success',
  flagged: 'warn',
  suspended: 'danger',
  deactivated: 'neutral',
};

const PAGE_SIZE = 7;

type StripValue = DriverRow['accountStatus'] | 'all';

/** README §05 item 1 "Status strip = the filter" — four clickable cells sharing one panel. */
function StatusStrip({ drivers, active, onSelect }: { drivers: DriverRow[]; active: StripValue; onSelect: (value: StripValue) => void }) {
  const cells: { label: string; value: StripValue; count: number }[] = [
    { label: 'All drivers', value: 'all', count: drivers.length },
    { label: 'Active', value: 'active', count: drivers.filter((d) => d.accountStatus === 'active').length },
    { label: 'Flagged', value: 'flagged', count: drivers.filter((d) => d.accountStatus === 'flagged').length },
    { label: 'Suspended', value: 'suspended', count: drivers.filter((d) => d.accountStatus === 'suspended').length },
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

/** Wireframe screen 3 "Driver management" (FR-6.1, 6.2). */
export function Drivers() {
  const {
    drivers,
    loading,
    error,
    search,
    statusFilter,
    page,
    fetch,
    setSearch,
    setStatusFilter,
    setPage,
    flag,
    suspend,
    reactivate,
    bulkFlag,
    bulkSuspend,
    bulkReactivate,
  } = useDriversStore();
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

  // From TopBar's global search (?highlight=<id>) — opens that driver's detail panel, then clears the param so it doesn't re-trigger on a later manual close/re-search.
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
    const action = pendingAction.kind === 'flag' ? flag : pendingAction.kind === 'suspend' ? suspend : reactivate;
    const ok = await action(pendingAction.driver.id, reason);
    setSubmitting(false);
    if (!ok) return;
    showToast({ message: `${pendingAction.driver.fullName} ${ACTION_COPY[pendingAction.kind].pastTense}.` });
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
    const action = pendingBulkKind === 'flag' ? bulkFlag : pendingBulkKind === 'suspend' ? bulkSuspend : bulkReactivate;
    const summary = await action(ids, bulkReason);
    setBulkSubmitting(false);
    if (summary.failed > 0) return; // keep the modal open — store.error (shown in the modal) already names the count that failed
    showToast({ message: `${summary.succeeded} driver(s) ${BULK_ACTION_COPY[pendingBulkKind].pastTense}.` });
    setSelectedRowIds(new Set());
    closeBulkModal();
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
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function exportCsv() {
    // DataTable's column sort is internal state, not lifted here, so this exports in store order (not the on-screen sort order).
    const csv = toCsv(filtered, driverCsvColumns);
    const filename = exportFilename('drivers', statusFilter);
    const url = downloadCsv(filename, csv);
    showToast({ message: `Export ready — ${filename}`, action: { label: 'Open', onClick: () => window.open(url, '_blank') } });
  }

  const selected = drivers.find((d) => d.id === selectedId) ?? null;

  // 2026-09-16 follow-up to the launch audit ("this part lacks information
  // and the UI is so bland"): the flat, ungrouped field list — one plain
  // column of labels with no hierarchy — is replaced by DetailSection
  // groups below, and tripCount (already loaded for the Trips table column,
  // just never surfaced in this modal) is now shown too.
  const ratingValue =
    selected && selected.ratingCount > 0 ? (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <RatingSquares value={selected.ratingAvg} />
        <span style={{ color: 'var(--ink-faint)', fontSize: 11 }}>
          {selected.ratingAvg.toFixed(1)} ({selected.ratingCount})
        </span>
      </span>
    ) : (
      '—'
    );

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
            <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{d.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'tricycle',
      header: 'Tricycle',
      sortValue: (d) => d.plateNo,
      render: (d) => (
        <div>
          <div className="mono">{d.plateNo}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{d.cluster ? titleCaseLabel(d.cluster) : '—'}</div>
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
      key: 'trips',
      header: 'Trips',
      align: 'right',
      sortValue: (d) => d.tripCount,
      render: (d) => d.tripCount.toLocaleString(),
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
        <div className="row-actions">
          <Button
            variant={selectedId === d.id ? 'solid' : 'outline'}
            tone="neutral"
            size="sm"
            onClick={() => setSelectedId((prev) => (prev === d.id ? null : d.id))}
          >
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

  if (error && drivers.length === 0 && !loading) {
    return (
      <div className="page">
        <EmptyState
          message="Couldn't load drivers."
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
      <StatusStrip drivers={drivers} active={statusFilter} onSelect={setStatusFilter} />
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
          <Button variant="outline" tone="neutral" size="sm" disabled={filtered.length === 0} onClick={exportCsv}>
            Export
          </Button>
        }
      />
      {selectedRowIds.size > 0 && (
        <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{selectedRowIds.size} selected</span>
          <Button variant="outline" tone="neutral" size="sm" onClick={() => setPendingBulkKind('flag')}>
            Flag
          </Button>
          <RoleGate min="supervisor">
            <Button variant="outline" tone="danger" size="sm" superscript="S+" onClick={() => setPendingBulkKind('suspend')}>
              Suspend
            </Button>
            <Button variant="outline" tone="primary" size="sm" superscript="S+" onClick={() => setPendingBulkKind('reactivate')}>
              Reactivate
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
        getRowKey={(d) => d.id}
        loading={loading}
        emptyMessage="No drivers match your filters."
        selectedIds={selectedRowIds}
        onToggleRow={toggleRow}
        onToggleAll={toggleAllOnPage}
      />
      <div className="list-footer">
        <span className="list-footer-count">
          {filtered.length === 0
            ? 'Showing 0 of 0 drivers'
            : `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)} of ${filtered.length} drivers`}
        </span>
        <Pagination page={safePage} pageCount={pageCount} onChange={setPage} />
      </div>

      {selected && (
        <Modal
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar fullName={selected.fullName} />
              {selected.fullName}
            </span>
          }
          subtitle={<Badge label={titleCaseLabel(selected.accountStatus)} tone={STATUS_TONE[selected.accountStatus]} />}
          onClose={() => setSelectedId(null)}
        >
          <DetailSection
            title="Contact"
            icon={ContactIcon}
            fields={[
              { label: 'Contact No', value: selected.contactNo },
              { label: 'Email', value: selected.email },
            ]}
          />
          <DetailSection
            title="Vehicle"
            icon={VehicleIcon}
            fields={[
              { label: 'Plate No', value: selected.plateNo },
              { label: 'Cluster', value: selected.cluster ? titleCaseLabel(selected.cluster) : '—' },
              {
                label: 'Verification',
                value: (
                  <Badge
                    label={titleCaseLabel(selected.verificationStatus)}
                    tone={selected.verificationStatus === 'approved' ? 'success' : selected.verificationStatus === 'rejected' ? 'danger' : 'warn'}
                  />
                ),
              },
            ]}
          />
          <DetailSection
            title="Performance"
            icon={PerformanceIcon}
            fields={[
              { label: 'Rating', value: ratingValue },
              { label: 'Trips', value: selected.tripCount.toLocaleString() },
            ]}
          />
          <DetailSection
            title="Account"
            icon={AccountIcon}
            fields={[
              { label: 'Registered', value: formatDate(selected.createdAt) },
              { label: 'Driver ID', value: <span className="mono">{selected.id}</span> },
            ]}
          />

          {selected.verificationStatus === 'pending' && (
            <Link to="/verification" style={{ fontSize: 12 }}>
              Open in Verification queue →
            </Link>
          )}

          <div className="row-actions">
            <Button variant="outline" tone="neutral" size="sm" onClick={() => setPendingAction({ driver: selected, kind: 'flag' })}>
              Flag
            </Button>
            <RoleGate min="supervisor">
              {selected.accountStatus === 'suspended' ? (
                <Button
                  variant="outline"
                  tone="primary"
                  size="sm"
                  superscript="S+"
                  onClick={() => setPendingAction({ driver: selected, kind: 'reactivate' })}
                >
                  Reactivate
                </Button>
              ) : (
                <Button
                  variant="solid"
                  tone="danger"
                  size="sm"
                  superscript="S+"
                  onClick={() => setPendingAction({ driver: selected, kind: 'suspend' })}
                >
                  Suspend
                </Button>
              )}
            </RoleGate>
          </div>

          <div className="read-only-note">Showing the record loaded with this list. Full ride history isn't available in the admin portal yet.</div>
        </Modal>
      )}

      {pendingAction && (
        <ConfirmModal
          title={ACTION_COPY[pendingAction.kind].title}
          message={ACTION_COPY[pendingAction.kind].message(pendingAction.driver.fullName)}
          confirmLabel={ACTION_COPY[pendingAction.kind].confirmLabel}
          tone={ACTION_COPY[pendingAction.kind].tone}
          icon={pendingAction.kind === 'suspend' ? <SevereIcon /> : undefined}
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
          message={BULK_ACTION_COPY[pendingBulkKind].message(drivers.filter((d) => selectedRowIds.has(d.id)))}
          confirmLabel={BULK_ACTION_COPY[pendingBulkKind].confirmLabel}
          tone={BULK_ACTION_COPY[pendingBulkKind].tone}
          icon={pendingBulkKind === 'suspend' ? <SevereIcon /> : undefined}
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

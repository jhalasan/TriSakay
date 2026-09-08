import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
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
import { ErrorBanner } from '../components/ErrorBanner';
import { useDriversStore } from '../store/useDriversStore';
import type { DriverRow } from '../types/driver';
import { formatDate, titleCaseLabel } from '../lib/format';
import { downloadCsv, toCsv } from '../lib/csv';
import { driverCsvColumns, exportFilename } from '../lib/exports';

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
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function exportCsv() {
    // DataTable's column sort is internal state, not lifted here, so this exports in store order (not the on-screen sort order).
    const csv = toCsv(filtered, driverCsvColumns);
    downloadCsv(exportFilename('drivers', statusFilter), csv);
  }

  const selected = drivers.find((d) => d.id === selectedId) ?? null;

  const detailFields: { label: string; value: ReactNode }[] = selected
    ? [
        { label: 'Contact No', value: selected.contactNo },
        { label: 'Email', value: selected.email },
        { label: 'Plate No', value: selected.plateNo },
        { label: 'Cluster', value: selected.cluster ? titleCaseLabel(selected.cluster) : '—' },
        {
          label: 'Verification',
          value: <Badge label={titleCaseLabel(selected.verificationStatus)} tone={selected.verificationStatus === 'approved' ? 'success' : selected.verificationStatus === 'rejected' ? 'danger' : 'warn'} />,
        },
        {
          label: 'Rating',
          value:
            selected.ratingCount > 0 ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <RatingSquares value={selected.ratingAvg} />
                <span style={{ color: 'var(--ink-faint)', fontSize: 11 }}>
                  {selected.ratingAvg.toFixed(1)} ({selected.ratingCount})
                </span>
              </span>
            ) : (
              '—'
            ),
        },
        { label: 'Registered', value: formatDate(selected.createdAt) },
        { label: 'Driver ID', value: <span className="mono">{selected.id}</span> },
      ]
    : [];

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

  return (
    <div className="page">
      <ErrorBanner message={error} />
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
      <DataTable columns={columns} rows={pageRows} getRowKey={(d) => d.id} loading={loading} emptyMessage="No drivers match your filters." />
      <Pagination page={safePage} pageCount={pageCount} onChange={setPage} />

      {selected && (
        <div className="panel detail-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Avatar fullName={selected.fullName} />
            <div>
              <h2 className="panel-title" style={{ marginBottom: 2 }}>
                {selected.fullName}
              </h2>
              <Badge label={titleCaseLabel(selected.accountStatus)} tone={STATUS_TONE[selected.accountStatus]} />
            </div>
          </div>

          {detailFields.map((f) => (
            <div className="field" key={f.label}>
              <span className="field-label">{f.label}</span>
              <span>{f.value}</span>
            </div>
          ))}

          {selected.verificationStatus === 'pending' && (
            <Link to="/verification" style={{ fontSize: 12 }}>
              Open in Verification queue →
            </Link>
          )}

          <div className="read-only-note">Showing the record loaded with this list. Full ride history isn't available in the admin portal yet.</div>

          <Button variant="outline" tone="neutral" size="sm" onClick={() => setSelectedId(null)} style={{ alignSelf: 'flex-start' }}>
            Close
          </Button>
        </div>
      )}

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

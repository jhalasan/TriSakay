import { useEffect, useMemo, useState } from 'react';
import { TableToolbar } from '../components/TableToolbar';
import { Select } from '../components/Select';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { DetailSection, AccountIcon, ContactIcon, RidesIcon } from '../components/DetailSection';
import { EmptyState } from '../components/EmptyState';
import { useRideLogStore, type RideLogStatusFilter } from '../store/useRideLogStore';
import type { RideLogRow } from '../types/ride';
import { formatCurrency, formatDateTime, getReferenceCode, titleCaseLabel } from '../lib/format';
import type { ReportDateRange } from '../services/reports';

const STATUS_TONE: Record<RideLogRow['status'], 'neutral' | 'success' | 'warn' | 'danger' | 'info'> = {
  pending: 'warn',
  assigned: 'info',
  ongoing: 'info',
  completed: 'success',
  cancelled: 'danger',
};

const STATUS_OPTIONS: { label: string; value: RideLogStatusFilter }[] = [
  { label: 'All statuses', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Assigned', value: 'assigned' },
  { label: 'Ongoing', value: 'ongoing' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
];

const DATE_RANGE_OPTIONS: { label: string; value: ReportDateRange }[] = [
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'This quarter', value: 'quarter' },
];

const PAGE_SIZE = 10;

/**
 * UAT A3 — a searchable, all-status ride history, distinct from Ride
 * Monitoring's live-only tricycle roster and Reports' paid-transactions-only
 * view. Same list+toolbar+modal shape as Complaints/Passengers/Drivers.
 */
export function RideLog() {
  const { rides, loading, error, search, statusFilter, dateRange, page, fetch, setSearch, setStatusFilter, setDateRange, setPage } =
    useRideLogStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rides.filter((r) => {
      const reference = getReferenceCode(r.id) ?? '';
      const matchesSearch =
        !q ||
        (r.passengerName ?? '').toLowerCase().includes(q) ||
        (r.driverName ?? '').toLowerCase().includes(q) ||
        reference.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' ? true : r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rides, search, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const selected = rides.find((r) => r.id === selectedId) ?? null;

  const columns: DataTableColumn<RideLogRow>[] = [
    {
      key: 'reference',
      header: 'Ref.',
      render: (r) => <span className="mono">#{getReferenceCode(r.id) ?? '—'}</span>,
    },
    { key: 'passenger', header: 'Passenger', sortValue: (r) => r.passengerName ?? '', render: (r) => r.passengerName ?? '—' },
    { key: 'driver', header: 'Driver', sortValue: (r) => r.driverName ?? '', render: (r) => r.driverName ?? '—' },
    { key: 'requestedAt', header: 'Requested', sortValue: (r) => r.requestedAt, render: (r) => formatDateTime(r.requestedAt) },
    {
      key: 'status',
      header: 'Status',
      sortValue: (r) => r.status,
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Badge label={titleCaseLabel(r.status)} tone={STATUS_TONE[r.status]} />
          {r.hasEmergencyAlert && <Badge label="SOS" tone="danger" />}
        </div>
      ),
    },
    { key: 'fare', header: 'Fare', align: 'right', render: (r) => (r.finalFare != null ? formatCurrency(r.finalFare) : '—') },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <Button variant="outline" tone="neutral" size="sm" onClick={() => setSelectedId(r.id)}>
          View
        </Button>
      ),
    },
  ];

  if (error && rides.length === 0 && !loading) {
    return (
      <div className="page">
        <EmptyState
          message="Couldn't load the ride log."
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
      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by passenger, driver, or reference…"
        filters={
          <>
            <Select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as RideLogStatusFilter)}
              options={STATUS_OPTIONS}
            />
            <Select
              aria-label="Date range"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as ReportDateRange)}
              options={DATE_RANGE_OPTIONS}
            />
          </>
        }
      />

      <DataTable
        columns={columns}
        rows={pageRows}
        getRowKey={(r) => r.id}
        loading={loading}
        emptyMessage="No rides match your filters."
        onRowClick={(r) => setSelectedId(r.id)}
        isRowHighlighted={(r) => r.id === selectedId}
      />
      <div className="list-footer">
        <span className="list-footer-count">
          {filtered.length === 0
            ? 'Showing 0 of 0 rides'
            : `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)} of ${filtered.length} rides`}
        </span>
        <Pagination page={safePage} pageCount={pageCount} onChange={setPage} />
      </div>

      {selected && (
        <Modal
          title={`#${getReferenceCode(selected.id) ?? '—'}`}
          subtitle={
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Badge label={titleCaseLabel(selected.status)} tone={STATUS_TONE[selected.status]} />
              {selected.hasEmergencyAlert && <Badge label="SOS" tone="danger" />}
            </div>
          }
          onClose={() => setSelectedId(null)}
        >
          <DetailSection
            title="People"
            icon={ContactIcon}
            fields={[
              { label: 'Passenger', value: selected.passengerName ?? '—' },
              { label: 'Driver', value: selected.driverName ?? '—' },
            ]}
          />
          <DetailSection
            title="Route"
            icon={RidesIcon}
            fields={[
              { label: 'Pickup', value: selected.pickupLabel ?? '—' },
              { label: 'Drop-off', value: selected.destLabel ?? '—' },
              { label: 'Fare', value: selected.finalFare != null ? formatCurrency(selected.finalFare) : '—' },
            ]}
          />
          <DetailSection
            title="Timeline"
            icon={AccountIcon}
            fields={[
              { label: 'Requested', value: formatDateTime(selected.requestedAt) },
              { label: 'Completed', value: selected.completedAt ? formatDateTime(selected.completedAt) : '—' },
              { label: 'Cancelled', value: selected.cancelledAt ? formatDateTime(selected.cancelledAt) : '—' },
              { label: 'Ride ID', value: <span className="mono">{selected.id}</span> },
            ]}
          />
        </Modal>
      )}
    </div>
  );
}

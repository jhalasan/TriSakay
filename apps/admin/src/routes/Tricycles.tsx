import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { TableToolbar } from '../components/TableToolbar';
import { Select } from '../components/Select';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { Badge, type BadgeTone } from '../components/Badge';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { DetailSection, AccountIcon, ContactIcon, FranchiseIcon, VehicleIcon } from '../components/DetailSection';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { useTricyclesStore, type ExpiryFilter } from '../store/useTricyclesStore';
import type { TricycleRow } from '../types/tricycle';
import { daysUntilExpiry } from '../types/tricycle';
import type { TricycleCluster, VerificationStatus } from '../types/driver';
import { formatDate, titleCaseLabel } from '../lib/format';
import { downloadCsv, toCsv } from '../lib/csv';
import { exportFilename, tricycleCsvColumns } from '../lib/exports';

const PAGE_SIZE = 10;

const VERIFICATION_TONE: Record<VerificationStatus, BadgeTone> = {
  unsubmitted: 'neutral',
  pending: 'warn',
  approved: 'success',
  rejected: 'danger',
};

const CLUSTER_OPTIONS: { label: string; value: TricycleCluster | 'all' }[] = [
  { label: 'All clusters', value: 'all' },
  { label: 'Red', value: 'red' },
  { label: 'White', value: 'white' },
  { label: 'Apple Green', value: 'apple_green' },
  { label: 'Melting Pot', value: 'melting_pot' },
];

/** Days-until-expiry -> a short badge, shared by the table column and the detail modal. Null = never transcribed (F4 is manual; docs/CONTEXT.MD §11 item 6). */
function expiryBadge(days: number | null): { label: string; tone: BadgeTone } {
  if (days === null) return { label: 'Not on file', tone: 'neutral' };
  if (days < 0) return { label: `Lapsed ${Math.abs(days)}d ago`, tone: 'danger' };
  if (days === 0) return { label: 'Expires today', tone: 'danger' };
  if (days <= 30) return { label: `Expires in ${days}d`, tone: 'warn' };
  return { label: formatDate(new Date(Date.now() + days * 86_400_000).toISOString()), tone: 'neutral' };
}

function matchesExpiryFilter(days: number | null, filter: ExpiryFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'lapsed') return days !== null && days < 0;
  if (filter === 'expiring') return days !== null && days >= 0 && days <= 30;
  if (filter === 'dueSoon') return days !== null && days <= 30;
  return days === null || days > 30; // 'ok'
}

/** README-style status strip (see Drivers.tsx's StatusStrip) but over franchise expiry urgency, not account status — that's this page's whole reason for existing: the Dashboard's "Expiring franchises" count had nowhere for PSO to click through to the actual list. */
function ExpiryStrip({
  tricycles,
  active,
  onSelect,
}: {
  tricycles: TricycleRow[];
  active: ExpiryFilter;
  onSelect: (value: ExpiryFilter) => void;
}) {
  const days = tricycles.map((t) => daysUntilExpiry(t.mtopExpiryDate));
  const cells: { label: string; value: ExpiryFilter; count: number }[] = [
    { label: 'All tricycles', value: 'all', count: tricycles.length },
    { label: 'Lapsed', value: 'lapsed', count: days.filter((d) => d !== null && d < 0).length },
    { label: 'Expiring ≤ 30 days', value: 'expiring', count: days.filter((d) => d !== null && d >= 0 && d <= 30).length },
    { label: 'Not expiring soon', value: 'ok', count: days.filter((d) => d === null || d > 30).length },
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

/**
 * Fleet-wide monitoring roster — every active tricycle, joined with its
 * driver's identity, so PSO can trace an expiring or lapsed franchise back
 * to a name and contact number without scrolling the general Verification
 * queue. Read-only by design: MTOP transcription and verification decisions
 * stay owned by DriverVerification.tsx (F4), which already writes those
 * columns under PSO's existing RLS path — this page links there rather than
 * duplicating that write surface.
 */
export function Tricycles() {
  const { tricycles, loading, error, search, expiryFilter, verificationFilter, clusterFilter, page, fetch, setSearch, setExpiryFilter, setVerificationFilter, setClusterFilter, setPage } =
    useTricyclesStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();

  useEffect(() => {
    fetch();
  }, [fetch]);

  // From the Dashboard's "Expiring franchises" card (?expiry=dueSoon) — lands already filtered, then clears the param.
  useEffect(() => {
    const expiryParam = searchParams.get('expiry');
    if (expiryParam === 'dueSoon' || expiryParam === 'expiring' || expiryParam === 'lapsed') {
      setExpiryFilter(expiryParam);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('expiry');
          return next;
        },
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams, setExpiryFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tricycles.filter((t) => {
      const matchesSearch =
        !q || t.plateNo.toLowerCase().includes(q) || t.mtopNo.toLowerCase().includes(q) || t.driverName.toLowerCase().includes(q);
      const matchesVerification = verificationFilter === 'all' || t.verificationStatus === verificationFilter;
      const matchesCluster = clusterFilter === 'all' || t.cluster === clusterFilter;
      const matchesExpiry = matchesExpiryFilter(daysUntilExpiry(t.mtopExpiryDate), expiryFilter);
      return matchesSearch && matchesVerification && matchesCluster && matchesExpiry;
    });
  }, [tricycles, search, verificationFilter, clusterFilter, expiryFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function exportCsv() {
    const csv = toCsv(filtered, tricycleCsvColumns);
    const filename = exportFilename('tricycles', expiryFilter);
    const url = downloadCsv(filename, csv);
    showToast({ message: `Export ready — ${filename}`, action: { label: 'Open', onClick: () => window.open(url, '_blank') } });
  }

  const selected = tricycles.find((t) => t.id === selectedId) ?? null;
  const selectedDays = selected ? daysUntilExpiry(selected.mtopExpiryDate) : null;

  const columns: DataTableColumn<TricycleRow>[] = [
    {
      key: 'tricycle',
      header: 'Tricycle',
      sortValue: (t) => t.plateNo,
      render: (t) => (
        <div>
          <div className="mono" style={{ fontWeight: 600 }}>
            {t.plateNo}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{t.bodyNo || '—'}</div>
        </div>
      ),
    },
    {
      key: 'driver',
      header: 'Driver',
      sortValue: (t) => t.driverName,
      render: (t) => (
        <div>
          <div>{t.driverName}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{t.driverContactNo || '—'}</div>
        </div>
      ),
    },
    {
      key: 'cluster',
      header: 'Cluster',
      sortValue: (t) => t.cluster ?? '',
      render: (t) => (t.cluster ? titleCaseLabel(t.cluster) : '—'),
    },
    {
      key: 'verification',
      header: 'Verification',
      sortValue: (t) => t.verificationStatus,
      render: (t) => <Badge label={titleCaseLabel(t.verificationStatus)} tone={VERIFICATION_TONE[t.verificationStatus]} />,
    },
    {
      key: 'mtop',
      header: 'MTOP No',
      sortValue: (t) => t.mtopNo,
      render: (t) => <span className="mono">{t.mtopNo || '—'}</span>,
    },
    {
      key: 'expiry',
      header: 'Franchise Expiry',
      sortValue: (t) => daysUntilExpiry(t.mtopExpiryDate) ?? Infinity,
      render: (t) => {
        const days = daysUntilExpiry(t.mtopExpiryDate);
        const badge = expiryBadge(days);
        return (
          <div>
            <Badge label={badge.label} tone={badge.tone} />
            {t.mtopExpiryDate && <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>{formatDate(t.mtopExpiryDate)}</div>}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (t) => (
        <Button
          variant={selectedId === t.id ? 'solid' : 'outline'}
          tone="neutral"
          size="sm"
          onClick={() => setSelectedId((prev) => (prev === t.id ? null : t.id))}
        >
          View
        </Button>
      ),
    },
  ];

  if (error && tricycles.length === 0 && !loading) {
    return (
      <div className="page">
        <EmptyState
          message="Couldn't load tricycles."
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
      <ExpiryStrip tricycles={tricycles} active={expiryFilter} onSelect={setExpiryFilter} />
      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by plate, MTOP no, or driver…"
        filters={
          <>
            <Select
              aria-label="Filter by verification status"
              value={verificationFilter}
              onChange={(e) => setVerificationFilter(e.target.value as typeof verificationFilter)}
              options={[
                { label: 'All verification', value: 'all' },
                { label: 'Unsubmitted', value: 'unsubmitted' },
                { label: 'Pending', value: 'pending' },
                { label: 'Approved', value: 'approved' },
                { label: 'Rejected', value: 'rejected' },
              ]}
            />
            <Select
              aria-label="Filter by cluster"
              value={clusterFilter}
              onChange={(e) => setClusterFilter(e.target.value as typeof clusterFilter)}
              options={CLUSTER_OPTIONS}
            />
          </>
        }
        actions={
          <Button variant="outline" tone="neutral" size="sm" disabled={filtered.length === 0} onClick={exportCsv}>
            Export
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={pageRows}
        getRowKey={(t) => t.id}
        loading={loading}
        emptyMessage="No tricycles match your filters."
        onRowClick={(t) => setSelectedId(t.id)}
        isRowHighlighted={(t) => selectedId === t.id}
      />
      <div className="list-footer">
        <span className="list-footer-count">
          {filtered.length === 0
            ? 'Showing 0 of 0 tricycles'
            : `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)} of ${filtered.length} tricycles`}
        </span>
        <Pagination page={safePage} pageCount={pageCount} onChange={setPage} />
      </div>

      {selected && (
        <Modal title={selected.plateNo} subtitle={<Badge label={titleCaseLabel(selected.verificationStatus)} tone={VERIFICATION_TONE[selected.verificationStatus]} />} onClose={() => setSelectedId(null)}>
          <DetailSection
            title="Driver"
            icon={ContactIcon}
            fields={[
              { label: 'Name', value: <Link to={`/drivers?highlight=${selected.driverId}`}>{selected.driverName}</Link> },
              { label: 'Contact No', value: selected.driverContactNo || '—' },
            ]}
          />
          <DetailSection
            title="Vehicle"
            icon={VehicleIcon}
            fields={[
              { label: 'Plate No', value: <span className="mono">{selected.plateNo}</span> },
              { label: 'Body No', value: selected.bodyNo || '—' },
              { label: 'Seat Capacity', value: selected.seatCapacity },
              { label: 'Cluster', value: selected.cluster ? titleCaseLabel(selected.cluster) : '—' },
            ]}
          />
          <DetailSection
            title="Franchise"
            icon={FranchiseIcon}
            fields={[
              { label: 'MTOP No', value: <span className="mono">{selected.mtopNo || '—'}</span> },
              { label: 'MTOP Expiry', value: selected.mtopExpiryDate ? formatDate(selected.mtopExpiryDate) : '—' },
              { label: 'Status', value: <Badge {...expiryBadge(selectedDays)} /> },
            ]}
          />

          <Link to="/verification" style={{ fontSize: 12 }}>
            Open in Verification queue →
          </Link>

          <div className="read-only-note">
            Monitoring view only — MTOP transcription and verification decisions are made from the Verification queue.
          </div>
        </Modal>
      )}
    </div>
  );
}

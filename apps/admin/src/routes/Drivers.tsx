import { useEffect, useMemo } from 'react';
import { TableToolbar } from '../components/TableToolbar';
import { Select } from '../components/Select';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { Badge } from '../components/Badge';
import { Avatar } from '../components/Avatar';
import { RatingSquares } from '../components/RatingSquares';
import { Button } from '../components/Button';
import { RoleGate } from '../components/RoleGate';
import { useDriversStore } from '../store/useDriversStore';
import type { DriverRow } from '../types/driver';
import { titleCaseLabel } from '../lib/format';

const STATUS_TONE: Record<DriverRow['accountStatus'], 'neutral' | 'success' | 'warn' | 'danger'> = {
  active: 'success',
  flagged: 'warn',
  suspended: 'danger',
  deactivated: 'neutral',
};

const PAGE_SIZE = 5;

/** Wireframe screen 3 "Driver management" (FR-6.1, 6.2). */
export function Drivers() {
  const { drivers, loading, search, statusFilter, page, fetch, setSearch, setStatusFilter, setPage, flag, suspend, reactivate } =
    useDriversStore();

  useEffect(() => {
    fetch();
  }, [fetch]);

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
          <Button variant="outline" tone="neutral" size="sm" onClick={() => flag(d.id)}>
            Flag
          </Button>
          <RoleGate min="supervisor">
            {d.accountStatus === 'suspended' ? (
              <Button variant="outline" tone="primary" size="sm" superscript="S+" onClick={() => reactivate(d.id)}>
                Reactivate
              </Button>
            ) : (
              <Button variant="solid" tone="danger" size="sm" superscript="S+" onClick={() => suspend(d.id)}>
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
    </div>
  );
}

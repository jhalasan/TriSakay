import { useEffect, useMemo } from 'react';
import { TableToolbar } from '../components/TableToolbar';
import { Select } from '../components/Select';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { Badge } from '../components/Badge';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { RoleGate } from '../components/RoleGate';
import { usePassengersStore } from '../store/usePassengersStore';
import type { PassengerRow } from '../types/passenger';
import { passengerStatusLabel } from '../lib/format';

const STATUS_TONE: Record<PassengerRow['accountStatus'], 'neutral' | 'success' | 'warn' | 'danger'> = {
  active: 'success',
  flagged: 'warn',
  suspended: 'danger',
  deactivated: 'neutral',
};

const PAGE_SIZE = 5;

/** Wireframe screen 5 "Passenger management" (FR-6.1, 6.2). Wireframe labels account_status='suspended' as "Blocked" here. */
export function Passengers() {
  const { passengers, loading, search, statusFilter, page, fetch, setSearch, setStatusFilter, setPage, block, unblock } =
    usePassengersStore();

  useEffect(() => {
    fetch();
  }, [fetch]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return passengers.filter((p) => {
      const matchesSearch = !q || p.fullName.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || p.accountStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [passengers, search, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
        <div style={{ display: 'flex', gap: 6 }}>
          <Button variant="outline" tone="neutral" size="sm">
            View
          </Button>
          <RoleGate min="supervisor">
            {p.accountStatus === 'suspended' ? (
              <Button variant="outline" tone="primary" size="sm" superscript="S+" onClick={() => unblock(p.id)}>
                Unblock
              </Button>
            ) : (
              <Button variant="solid" tone="danger" size="sm" superscript="S+" onClick={() => block(p.id)}>
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
          <Button variant="outline" tone="neutral" size="sm">
            Export
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={pageRows}
        getRowKey={(p) => p.id}
        loading={loading}
        emptyMessage="No passengers match your filters."
      />
      <Pagination page={page} pageCount={pageCount} onChange={setPage} />
    </div>
  );
}

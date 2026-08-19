import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatTile } from '../components/StatTile';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { RideStatusChart, RidesOverTimeChart } from '../components/charts';
import {
  getDashboardStats,
  getRidesPerDay,
  getTripStatusBreakdown,
  listExpiringFranchises,
  listOverdueComplaints,
  listRecentTripActivity,
  type DashboardStats,
  type ExpiringFranchiseRow,
  type OverdueComplaintRow,
  type RecentTripActivityRow,
  type RidesPerDayPoint,
  type TripStatusCount,
} from '../services/dashboard';
import { formatRelativeTime, titleCaseLabel } from '../lib/format';

const ACTIVITY_TONE: Record<string, 'neutral' | 'success' | 'warn' | 'danger' | 'info'> = {
  active: 'info',
  forming: 'warn',
  completed: 'success',
  cancelled: 'danger',
};

const activityColumns: DataTableColumn<RecentTripActivityRow>[] = [
  { key: 'driver', header: 'Driver', render: (r) => r.driverName ?? 'Unknown', sortValue: (r) => r.driverName ?? '' },
  {
    key: 'status',
    header: 'Status',
    render: (r) => <Badge label={titleCaseLabel(r.status)} tone={ACTIVITY_TONE[r.status] ?? 'neutral'} />,
  },
  { key: 'time', header: 'Time', render: (r) => formatRelativeTime(r.updatedAt) },
];

const overdueColumns: DataTableColumn<OverdueComplaintRow>[] = [
  { key: 'category', header: 'Category', render: (r) => titleCaseLabel(r.category), sortValue: (r) => r.category },
  {
    key: 'days',
    header: 'Days overdue',
    render: (r) => r.businessDaysElapsed,
    sortValue: (r) => r.businessDaysElapsed,
    align: 'right',
  },
  { key: 'status', header: 'Status', render: (r) => <Badge label={titleCaseLabel(r.status)} tone="warn" /> },
];

const expiringColumns: DataTableColumn<ExpiringFranchiseRow>[] = [
  { key: 'driver', header: 'Driver', render: (r) => r.driverName ?? 'Unknown', sortValue: (r) => r.driverName ?? '' },
  { key: 'plate', header: 'Plate No.', render: (r) => r.plateNo },
  {
    key: 'expiry',
    header: 'Days until expiry',
    render: (r) => (
      <Badge
        label={r.daysUntilExpiry < 0 ? `Expired ${Math.abs(r.daysUntilExpiry)}d ago` : `${r.daysUntilExpiry}d`}
        tone={r.daysUntilExpiry < 0 ? 'danger' : 'warn'}
      />
    ),
    sortValue: (r) => r.daysUntilExpiry,
    align: 'right',
  },
];

/** Wireframe screen 2 "Dashboard / Overview" (FR-5.1, 5.4, 5.5). */
export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [overdue, setOverdue] = useState<OverdueComplaintRow[]>([]);
  const [overdueError, setOverdueError] = useState<string | null>(null);
  const [expiring, setExpiring] = useState<ExpiringFranchiseRow[]>([]);
  const [expiringError, setExpiringError] = useState<string | null>(null);
  const [activity, setActivity] = useState<RecentTripActivityRow[]>([]);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [ridesPerDay, setRidesPerDay] = useState<RidesPerDayPoint[]>([]);
  const [ridesError, setRidesError] = useState<string | null>(null);
  const [statusBreakdown, setStatusBreakdown] = useState<TripStatusCount[]>([]);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [statsResult, overdueResult, expiringResult, activityResult, ridesResult, statusResult] = await Promise.all([
        getDashboardStats(),
        listOverdueComplaints(),
        listExpiringFranchises(),
        listRecentTripActivity(),
        getRidesPerDay(),
        getTripStatusBreakdown(),
      ]);
      if (cancelled) return;

      setStats(statsResult.data);
      setStatsError(statsResult.error);
      setOverdue(overdueResult.data);
      setOverdueError(overdueResult.error);
      setExpiring(expiringResult.data);
      setExpiringError(expiringResult.error);
      setActivity(activityResult.data);
      setActivityError(activityResult.error);
      setRidesPerDay(ridesResult.data);
      setRidesError(ridesResult.error);
      setStatusBreakdown(statusResult.data);
      setStatusError(statusResult.error);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page">
      {statsError && <div className="form-error">{statsError}</div>}
      <div className="stat-grid">
        <StatTile label="Total Drivers" value={loading ? '—' : (stats?.totalDrivers ?? '—')} tone="primary" />
        <StatTile label="Active Rides" value={loading ? '—' : (stats?.activeRides ?? '—')} tone="success" />
        <StatTile label="Pending Verifications" value={loading ? '—' : (stats?.pendingVerifications ?? '—')} tone="warn" />
        <StatTile label="Open Complaints" value={loading ? '—' : (stats?.openComplaints ?? '—')} tone="danger" />
        <StatTile label="Overdue Complaints" value={loading ? '—' : overdue.length} hint="Past 3-business-day ARTA target" tone="danger" />
        <StatTile label="Expiring Franchises" value={loading ? '—' : expiring.length} hint="MTOP renewal due within 30 days" tone="warn" />
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="panel-title">Rides Over Time (Week)</div>
          {ridesError && <div className="form-error">{ridesError}</div>}
          <RidesOverTimeChart data={ridesPerDay} loading={loading} />
        </div>
        <div className="panel">
          <div className="panel-title">Ride Status</div>
          {statusError && <div className="form-error">{statusError}</div>}
          <RideStatusChart data={statusBreakdown} loading={loading} />
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Overdue Complaints</div>
        {overdueError && <div className="form-error">{overdueError}</div>}
        <DataTable columns={overdueColumns} rows={overdue} getRowKey={(r) => r.id} loading={loading} emptyMessage="No overdue complaints." />
      </div>

      <div className="panel">
        <div className="panel-title">Expiring Franchises</div>
        {expiringError && <div className="form-error">{expiringError}</div>}
        <DataTable
          columns={expiringColumns}
          rows={expiring}
          getRowKey={(r) => r.tricycleId}
          loading={loading}
          emptyMessage="No franchises expiring soon."
        />
      </div>

      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="panel-title" style={{ marginBottom: 0 }}>
            Recent Activity
          </div>
          <Link to="/monitoring">
            <Button variant="outline" tone="neutral" size="sm">
              View all
            </Button>
          </Link>
        </div>
        {activityError && <div className="form-error">{activityError}</div>}
        <DataTable columns={activityColumns} rows={activity} getRowKey={(r) => r.id} loading={loading} />
      </div>
    </div>
  );
}

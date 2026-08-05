import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatTile } from '../components/StatTile';
import { PlaceholderBox } from '../components/PlaceholderBox';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { listDrivers } from '../services/drivers';
import { listActiveTricycles, listRecentActivity } from '../services/monitoring';
import { listVerificationCases } from '../services/verification';
import { listComplaints } from '../services/complaints';
import type { RecentActivityRow } from '../types/ride';
import { titleCaseLabel } from '../lib/format';

interface DashboardStats {
  totalDrivers: number;
  activeRides: number;
  pendingVerifications: number;
  openComplaints: number;
}

const ACTIVITY_TONE: Record<string, 'neutral' | 'success' | 'warn' | 'danger' | 'info'> = {
  active: 'info',
  forming: 'warn',
  completed: 'success',
  cancelled: 'danger',
};

const columns: DataTableColumn<RecentActivityRow>[] = [
  { key: 'driver', header: 'Driver', render: (r) => r.driverFullName, sortValue: (r) => r.driverFullName },
  {
    key: 'status',
    header: 'Status',
    render: (r) => <Badge label={titleCaseLabel(r.status)} tone={ACTIVITY_TONE[r.status] ?? 'neutral'} />,
  },
  { key: 'time', header: 'Time', render: (r) => r.time },
];

/** Wireframe screen 2 "Dashboard / Overview" (FR-5.1, 5.4). */
export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<RecentActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [drivers, tricycles, cases, complaints, recent] = await Promise.all([
        listDrivers(),
        listActiveTricycles(),
        listVerificationCases(),
        listComplaints(),
        listRecentActivity(),
      ]);
      if (cancelled) return;
      setStats({
        totalDrivers: drivers.data.length,
        activeRides: tricycles.data.filter((t) => t.tripStatus === 'active').length,
        pendingVerifications: cases.data.filter((c) => c.overallStatus === 'pending').length,
        openComplaints: complaints.data.filter((c) => !['resolved', 'dismissed'].includes(c.status)).length,
      });
      setActivity(recent.data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page">
      <div className="stat-grid">
        <StatTile label="Total Drivers" value={loading ? '—' : stats!.totalDrivers} />
        <StatTile label="Active Rides" value={loading ? '—' : stats!.activeRides} />
        <StatTile label="Pending Verifications" value={loading ? '—' : stats!.pendingVerifications} />
        <StatTile label="Open Complaints" value={loading ? '—' : stats!.openComplaints} />
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="panel-title">Rides Over Time (Week)</div>
          <PlaceholderBox label="Rides over time — chart" />
        </div>
        <div className="panel">
          <div className="panel-title">Ride Status</div>
          <PlaceholderBox label="Ride status — chart" />
        </div>
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
        <DataTable columns={columns} rows={activity} getRowKey={(r) => r.id} loading={loading} />
      </div>
    </div>
  );
}

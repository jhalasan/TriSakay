import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge, type BadgeTone } from '../components/Badge';
import { Button } from '../components/Button';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { ErrorBanner } from '../components/ErrorBanner';
import { EmptyState } from '../components/EmptyState';
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
import { listEmergencyAlerts } from '../services/emergency';
import type { EmergencyAlertRow } from '../types/emergency';
import { formatCurrency, formatDayHeading, formatRelativeTime, titleCaseLabel } from '../lib/format';
import styles from './Dashboard.module.css';

const RECENT_ACTIVITY_LIMIT = 5;

const ACTIVITY_TONE: Record<string, BadgeTone> = {
  active: 'info',
  forming: 'warn',
  completed: 'success',
  cancelled: 'danger',
};

function ForwardArrow() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

interface AttentionCardProps {
  accent: 'danger' | 'warn';
  eyebrow: string;
  count: ReactNode;
  context: string;
  linkLabel: string;
  onLinkClick: () => void;
  badgeLabel: string;
  badgeTone: BadgeTone;
}

/** README §03 band 1 "Needs attention today" — one of the three accent-edged panels. Local to Dashboard, not a new shared component. */
function AttentionCard({ accent, eyebrow, count, context, linkLabel, onLinkClick, badgeLabel, badgeTone }: AttentionCardProps) {
  return (
    <div className={`${styles.attentionCard} ${styles[`accent-${accent}`]}`}>
      <div className={styles.attentionTop}>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <Badge label={badgeLabel} tone={badgeTone} />
      </div>
      <span className={`${styles.attentionCount} ${styles[`count-${accent}`]}`}>{count}</span>
      <p className={styles.attentionContext}>{context}</p>
      <button type="button" className={styles.attentionLink} onClick={onLinkClick}>
        {linkLabel}
        <ForwardArrow />
      </button>
    </div>
  );
}

function CountSkeleton() {
  return <span className={styles.countSkeleton} aria-hidden="true" />;
}

function VolumeCell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={styles.volumeCell}>
      <span className={styles.eyebrow}>{label}</span>
      <span className={styles.volumeValue}>{value}</span>
    </div>
  );
}

function PanelHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className={styles.panelHeader}>
      <h2 className="panel-title" style={{ marginBottom: 0 }}>
        {title}
      </h2>
      {action}
    </div>
  );
}

/** Wireframe screen 2 "Dashboard / Overview" (FR-5.1, 5.4, 5.5) — restyled per docs/design_handoff_trisakay_admin/README.md §03. */
export function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [overdue, setOverdue] = useState<OverdueComplaintRow[]>([]);
  const [overdueError, setOverdueError] = useState<string | null>(null);
  const [expiring, setExpiring] = useState<ExpiringFranchiseRow[]>([]);
  const [expiringError, setExpiringError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<EmergencyAlertRow[]>([]);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [activity, setActivity] = useState<RecentTripActivityRow[]>([]);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [ridesPerDay, setRidesPerDay] = useState<RidesPerDayPoint[]>([]);
  const [ridesError, setRidesError] = useState<string | null>(null);
  const [statusBreakdown, setStatusBreakdown] = useState<TripStatusCount[]>([]);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [statsResult, overdueResult, expiringResult, activityResult, ridesResult, statusResult, alertsResult] = await Promise.all([
        getDashboardStats(),
        listOverdueComplaints(),
        listExpiringFranchises(),
        listRecentTripActivity(RECENT_ACTIVITY_LIMIT),
        getRidesPerDay(),
        getTripStatusBreakdown(),
        listEmergencyAlerts(),
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
      setAlerts(alertsResult.data);
      setAlertsError(alertsResult.error);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }

  useEffect(load, []);

  const loggedAlerts = alerts.filter((a) => a.status === 'logged');
  const mostRecentLogged = loggedAlerts[0];
  const lapsedCount = expiring.filter((f) => f.daysUntilExpiry < 0).length;
  const oldestOverdueDays = overdue.reduce((max, r) => Math.max(max, r.businessDaysElapsed), 0);
  const queuesPastTarget = [overdue.length > 0, expiring.length > 0, loggedAlerts.length > 0].filter(Boolean).length;

  const activityColumns: DataTableColumn<RecentTripActivityRow>[] = [
    { key: 'driver', header: 'Driver', render: (r) => r.driverName ?? 'Unknown', sortValue: (r) => r.driverName ?? '' },
    { key: 'passenger', header: 'Passenger', render: (r) => r.passengerName ?? 'Unknown', sortValue: (r) => r.passengerName ?? '' },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge label={titleCaseLabel(r.status)} tone={ACTIVITY_TONE[r.status] ?? 'neutral'} />,
    },
    { key: 'fare', header: 'Fare', align: 'right', render: (r) => (r.fare != null ? formatCurrency(r.fare) : '—') },
    { key: 'updated', header: 'Updated', render: (r) => formatRelativeTime(r.updatedAt) },
  ];

  if (statsError && !stats && !loading) {
    return (
      <div className={styles.page}>
        <EmptyState
          message="Couldn't load the dashboard."
          hint={statsError}
          tone="danger"
          action={
            <Button variant="outline" tone="neutral" size="sm" onClick={load}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <section>
        <div className={styles.sectionHeader}>
          <span className={styles.eyebrow}>Needs attention today</span>
          <span className={styles.sectionMeta}>
            {formatDayHeading()} · {queuesPastTarget} {queuesPastTarget === 1 ? 'queue' : 'queues'} past target
          </span>
        </div>
        <div className={styles.attentionGrid}>
          <AttentionCard
            accent="danger"
            eyebrow="Overdue complaints"
            count={loading ? <CountSkeleton /> : overdueError ? '—' : overdue.length}
            context={
              loading
                ? ''
                : overdueError
                  ? `Couldn't check — ${overdueError}`
                  : overdue.length > 0
                    ? `oldest is ${oldestOverdueDays} business days old`
                    : 'No complaints past target.'
            }
            linkLabel="Open complaints queue"
            onLinkClick={() => navigate('/complaints')}
            badgeLabel="ARTA 3d"
            badgeTone="danger"
          />
          <AttentionCard
            accent="warn"
            eyebrow="Expiring franchises"
            count={loading ? <CountSkeleton /> : expiringError ? '—' : expiring.length}
            context={
              loading
                ? ''
                : expiringError
                  ? `Couldn't check — ${expiringError}`
                  : expiring.length > 0
                    ? `${lapsedCount} already lapsed, MTOP renewal due within 30 days`
                    : 'No franchises expiring soon.'
            }
            linkLabel="View expiring tricycles"
            onLinkClick={() => navigate('/tricycles?expiry=dueSoon')}
            badgeLabel="≤ 30 days"
            badgeTone="warn"
          />
          <AttentionCard
            accent="danger"
            eyebrow="Unreviewed SOS"
            count={loading ? <CountSkeleton /> : loggedAlerts.length}
            context={
              loading
                ? ''
                : mostRecentLogged
                  ? `triggered ${formatRelativeTime(mostRecentLogged.createdAt)}, ${titleCaseLabel(mostRecentLogged.triggeredRole)}`
                  : 'No unreviewed alerts.'
            }
            linkLabel="Open emergency alerts"
            onLinkClick={() => navigate('/emergency-alerts')}
            badgeLabel="Logged"
            badgeTone="danger"
          />
        </div>
        <ErrorBanner message={alertsError} />
      </section>

      <section className={`panel ${styles.volumePanel}`}>
        <VolumeCell label="Total drivers" value={loading ? '—' : (stats?.totalDrivers ?? '—')} />
        <VolumeCell label="Active rides" value={loading ? '—' : (stats?.activeRides ?? '—')} />
        <VolumeCell label="Pending verifications" value={loading ? '—' : (stats?.pendingVerifications ?? '—')} />
        <VolumeCell label="Open complaints" value={loading ? '—' : (stats?.openComplaints ?? '—')} />
      </section>

      <div className={styles.chartsGrid}>
        <div className="panel">
          <PanelHeader title="Rides over time" action={<Badge label="Last 7 days" tone="neutral" />} />
          <ErrorBanner message={ridesError} />
          <RidesOverTimeChart data={ridesPerDay} loading={loading} />
        </div>
        <div className="panel">
          <PanelHeader title="Ride status" />
          <ErrorBanner message={statusError} />
          <RideStatusChart data={statusBreakdown} loading={loading} />
        </div>
      </div>

      <div className="panel">
        <PanelHeader
          title="Recent trip activity"
          action={
            <Link to="/monitoring">
              <Button variant="ghost" tone="neutral" size="sm">
                View all
              </Button>
            </Link>
          }
        />
        <ErrorBanner message={activityError} />
        <DataTable columns={activityColumns} rows={activity} getRowKey={(r) => r.id} loading={loading} />
      </div>
    </div>
  );
}

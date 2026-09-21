import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { StatTile } from '../components/StatTile';
import { PeakHoursChart, RidesRevenueChart } from '../components/charts';
import { getPeakHourHistogram, getReportSummary, getRidesRevenueOverTime, listTransactions, dateRangeSinceIso, type ReportDateRange } from '../services/reports';
import { useSettingsStore } from '../store/useSettingsStore';
import { useSessionStore } from '../store/useSessionStore';
import { meetsRoleGate } from '../lib/rbac';
import type { PeakHourBucket, ReportSummary, RidesRevenuePoint, TransactionRow } from '../types/report';
import { formatCurrency, formatDate, formatDateTime, paymentMethodLabel, titleCaseLabel } from '../lib/format';
import { downloadCsv, toCsv } from '../lib/csv';
import { ErrorBanner } from '../components/ErrorBanner';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import styles from './Reports.module.css';

const PAYMENT_TONE: Record<TransactionRow['status'], 'neutral' | 'success' | 'warn' | 'danger'> = {
  pending: 'warn',
  paid: 'success',
  failed: 'danger',
  refunded: 'neutral',
};

/** Wireframe screen 8 "Reports & analytics" (FR-5.3, 5.4, 9.7). */
const DATE_RANGE_OPTIONS: { label: string; value: ReportDateRange }[] = [
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'This quarter', value: 'quarter' },
];

function formatDeltaHint(pct: number | null, label: string): string | undefined {
  if (pct == null) return undefined;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}% vs previous ${label}`;
}

export function Reports() {
  const [dateRange, setDateRange] = useState<ReportDateRange>('30d');
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [ridesRevenue, setRidesRevenue] = useState<RidesRevenuePoint[]>([]);
  const [ridesRevenueError, setRidesRevenueError] = useState<string | null>(null);
  const [peakHours, setPeakHours] = useState<PeakHourBucket[]>([]);
  const [peakHoursError, setPeakHoursError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fareConfig = useSettingsStore((state) => state.fareConfig);
  const fetchSettings = useSettingsStore((state) => state.fetch);
  const { showToast } = useToast();
  // A15 (UAT audit): viewing the table stays open to every PSO role; only
  // the bulk CSV export is gated — exfiltrating identifiable names in bulk
  // is a distinct risk from the same names being visible on-screen.
  const role = useSessionStore((state) => state.user?.role);
  const canExport = role ? meetsRoleGate(role, 'supervisor') : false;

  useEffect(() => {
    if (!fareConfig) fetchSettings();
  }, [fareConfig, fetchSettings]);

  function load() {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getReportSummary(dateRange),
      listTransactions(dateRange),
      getRidesRevenueOverTime(dateRange),
      getPeakHourHistogram(dateRange),
    ])
      .then(([s, t, rr, ph]) => {
        if (cancelled) return;
        setSummary(s.data);
        setSummaryError(s.error);
        setTransactions(t.data);
        setTransactionsError(t.error);
        setRidesRevenue(rr.data);
        setRidesRevenueError(rr.error);
        setPeakHours(ph.data);
        setPeakHoursError(ph.error);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSummaryError('Could not load report data.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }

  useEffect(load, [dateRange]);

  function exportCsv() {
    if (!canExport) return;
    const csv = toCsv(transactions, [
      { header: 'Date', value: (t) => t.createdAt },
      { header: 'Passenger', value: (t) => t.passengerName },
      { header: 'Driver', value: (t) => t.driverName },
      { header: 'Amount', value: (t) => t.amount },
      { header: 'Method', value: (t) => t.method },
      { header: 'Status', value: (t) => t.status },
    ]);
    const filename = `transactions-${dateRange}-${new Date().toISOString().slice(0, 10)}.csv`;
    const url = downloadCsv(filename, csv);
    showToast({ message: `Export ready — ${filename}`, action: { label: 'Open', onClick: () => window.open(url, '_blank') } });
  }

  const columns: DataTableColumn<TransactionRow>[] = [
    { key: 'passenger', header: 'Passenger', render: (t) => t.passengerName },
    { key: 'driver', header: 'Driver', render: (t) => t.driverName },
    { key: 'amount', header: 'Amount', align: 'right', sortValue: (t) => t.amount, render: (t) => formatCurrency(t.amount) },
    { key: 'method', header: 'Method', render: (t) => <Badge label={paymentMethodLabel(t.method)} tone="neutral" /> },
    { key: 'status', header: 'Status', render: (t) => <Badge label={titleCaseLabel(t.status)} tone={PAYMENT_TONE[t.status]} /> },
    { key: 'time', header: 'Date', render: (t) => formatDateTime(t.createdAt) },
  ];

  const rangeLabel = dateRange === 'quarter' ? 'this quarter' : dateRange === '7d' ? '7d' : '30d';
  const peakBucket = peakHours.reduce<PeakHourBucket | null>((max, b) => (!max || b.count > max.count ? b : max), null);

  if (summaryError && !summary && !loading) {
    return (
      <div className="page">
        <EmptyState
          message="Couldn't load report data."
          hint={summaryError}
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
    <div className="page">
      <div className={styles.toolbar}>
        <div className="segmented">
          {DATE_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`segment-button ${dateRange === opt.value ? 'segment-button-active' : ''}`}
              onClick={() => setDateRange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className={styles.resolvedRange}>
          {formatDate(dateRangeSinceIso(dateRange))} – {formatDate(new Date().toISOString())}
        </span>
        <Button
          variant="outline"
          tone="neutral"
          size="sm"
          style={{ marginLeft: 'auto' }}
          disabled={transactions.length === 0 || !canExport}
          title={canExport ? undefined : 'Limited to PSO Supervisor and Administrator'}
          onClick={exportCsv}
        >
          Export CSV
        </Button>
      </div>

      <div className="stat-grid">
        <StatTile
          label="Total Rides"
          value={loading || !summary ? '—' : summary.totalRides}
          hint={loading || !summary ? undefined : formatDeltaHint(summary.totalRidesDeltaPct, rangeLabel)}
        />
        <StatTile
          label="Total Revenue"
          value={loading || !summary ? '—' : formatCurrency(summary.totalRevenue)}
          hint={loading || !summary ? undefined : formatDeltaHint(summary.totalRevenueDeltaPct, rangeLabel)}
        />
        <StatTile
          label="Average Fare"
          value={loading || !summary ? '—' : formatCurrency(summary.averageFare)}
          hint={fareConfig ? `Base ${formatCurrency(fareConfig.baseFare)} + ${formatCurrency(fareConfig.ratePerKm)}/km` : undefined}
        />
        <StatTile
          label="Peak Hour"
          value={loading || !summary ? '—' : summary.peakHourLabel}
          hint={peakBucket && peakBucket.count > 0 ? `${peakBucket.count} rides in the window` : undefined}
        />
      </div>

      <div className="two-col">
        <div className="panel">
          <h2 className="panel-title">Rides / Revenue</h2>
          <ErrorBanner message={ridesRevenueError} />
          <RidesRevenueChart data={ridesRevenue} loading={loading} />
        </div>
        <div className="panel">
          <h2 className="panel-title">Peak Hours</h2>
          <ErrorBanner message={peakHoursError} />
          <PeakHoursChart data={peakHours} loading={loading} />
        </div>
      </div>

      <div className="panel">
        <h2 className="panel-title">Transactions</h2>
        <ErrorBanner message={transactionsError} />
        <DataTable columns={columns} rows={transactions} getRowKey={(t) => t.id} loading={loading} />
      </div>
    </div>
  );
}

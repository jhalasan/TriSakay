import { useEffect, useState } from 'react';
import { Select } from '../components/Select';
import { Button } from '../components/Button';
import { PlaceholderBox } from '../components/PlaceholderBox';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { StatTile } from '../components/StatTile';
import { getReportSummary, listTransactions, type ReportDateRange } from '../services/reports';
import type { ReportSummary, TransactionRow } from '../types/report';
import { formatCurrency, formatDateTime, paymentMethodLabel, titleCaseLabel } from '../lib/format';
import { downloadCsv, toCsv } from '../lib/csv';
import styles from './Reports.module.css';

const PAYMENT_TONE: Record<TransactionRow['status'], 'neutral' | 'success' | 'warn' | 'danger'> = {
  pending: 'warn',
  paid: 'success',
  failed: 'danger',
  refunded: 'neutral',
};

/** Wireframe screen 8 "Reports & analytics" (FR-5.3, 5.4, 9.7). */
const DATE_RANGE_OPTIONS: { label: string; value: ReportDateRange }[] = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'This quarter', value: 'quarter' },
];

export function Reports() {
  const [dateRange, setDateRange] = useState<ReportDateRange>('30d');
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([getReportSummary(dateRange), listTransactions(dateRange)]).then(([s, t]) => {
      setSummary(s.data);
      setTransactions(t.data);
      setLoading(false);
    });
  }, [dateRange]);

  function exportCsv() {
    const csv = toCsv(transactions, [
      { header: 'Date', value: (t) => t.createdAt },
      { header: 'Passenger', value: (t) => t.passengerName },
      { header: 'Driver', value: (t) => t.driverName },
      { header: 'Amount', value: (t) => t.amount },
      { header: 'Method', value: (t) => t.method },
      { header: 'Status', value: (t) => t.status },
    ]);
    downloadCsv(`transactions-${dateRange}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  const columns: DataTableColumn<TransactionRow>[] = [
    { key: 'passenger', header: 'Passenger', render: (t) => t.passengerName },
    { key: 'driver', header: 'Driver', render: (t) => t.driverName },
    { key: 'amount', header: 'Amount', align: 'right', sortValue: (t) => t.amount, render: (t) => formatCurrency(t.amount) },
    { key: 'method', header: 'Method', render: (t) => <Badge label={paymentMethodLabel(t.method)} tone="neutral" /> },
    { key: 'status', header: 'Status', render: (t) => <Badge label={titleCaseLabel(t.status)} tone={PAYMENT_TONE[t.status]} /> },
    { key: 'time', header: 'Date', render: (t) => formatDateTime(t.createdAt) },
  ];

  return (
    <div className="page">
      <div className={styles.toolbar}>
        <Select
          aria-label="Date range"
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as ReportDateRange)}
          options={DATE_RANGE_OPTIONS}
        />
        <Button
          variant="outline"
          tone="neutral"
          size="sm"
          style={{ marginLeft: 'auto' }}
          disabled={transactions.length === 0}
          onClick={exportCsv}
        >
          Export CSV
        </Button>
      </div>

      <div className="stat-grid">
        <StatTile label="Total Rides" value={loading ? '—' : summary!.totalRides} />
        <StatTile label="Total Revenue" value={loading ? '—' : formatCurrency(summary!.totalRevenue)} />
        <StatTile label="Average Fare" value={loading ? '—' : formatCurrency(summary!.averageFare)} />
        <StatTile label="Peak Hour" value={loading ? '—' : summary!.peakHourLabel} />
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="panel-title">Rides / Revenue</div>
          <PlaceholderBox label="Rides / revenue — chart" />
        </div>
        <div className="panel">
          <div className="panel-title">Peak Hours</div>
          <PlaceholderBox label="Peak hours — chart" />
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Transactions</div>
        <DataTable columns={columns} rows={transactions} getRowKey={(t) => t.id} loading={loading} />
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Select } from '../components/Select';
import { Button } from '../components/Button';
import { PlaceholderBox } from '../components/PlaceholderBox';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { StatTile } from '../components/StatTile';
import { getReportSummary, listTransactions } from '../services/reports';
import type { ReportSummary, TransactionRow } from '../types/report';
import { formatCurrency, formatDateTime, paymentMethodLabel, titleCaseLabel } from '../lib/format';
import styles from './Reports.module.css';

const PAYMENT_TONE: Record<TransactionRow['status'], 'neutral' | 'success' | 'warn' | 'danger'> = {
  pending: 'warn',
  paid: 'success',
  failed: 'danger',
  refunded: 'neutral',
};

/** Wireframe screen 8 "Reports & analytics" (FR-5.3, 5.4, 9.7). */
export function Reports() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getReportSummary(), listTransactions()]).then(([s, t]) => {
      setSummary(s.data);
      setTransactions(t.data);
      setLoading(false);
    });
  }, []);

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
          options={[
            { label: 'Last 7 days', value: '7d' },
            { label: 'Last 30 days', value: '30d' },
            { label: 'This quarter', value: 'quarter' },
          ]}
        />
        <Select
          aria-label="Report type"
          options={[
            { label: 'Ride volume', value: 'rides' },
            { label: 'Complaints', value: 'complaints' },
            { label: 'Driver activity', value: 'drivers' },
          ]}
        />
        <Button variant="outline" tone="neutral" size="sm" style={{ marginLeft: 'auto' }}>
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

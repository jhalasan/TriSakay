import type { ReportSummary, TransactionRow } from '../types/report';

export const MOCK_REPORT_SUMMARY: ReportSummary = {
  totalRides: 1842,
  totalRevenue: 41260.5,
  averageFare: 22.4,
  peakHourLabel: '6:00–8:00 AM',
};

export const MOCK_TRANSACTIONS: TransactionRow[] = [
  { id: 'txn-001', rideRequestId: 'rr-1001', passengerName: 'Maria Fe Santos', driverName: 'Ronnie Bautista', amount: 18.0, method: 'cash', status: 'paid', createdAt: '2026-08-05T07:40:00+08:00' },
  { id: 'txn-002', rideRequestId: 'rr-1002', passengerName: 'Ryan Abenoja', driverName: 'Danilo Ramos Jr.', amount: 24.0, method: 'gcash', status: 'paid', createdAt: '2026-08-05T08:05:00+08:00' },
  { id: 'txn-003', rideRequestId: 'rr-1003', passengerName: 'Lorna Kintanar', driverName: 'Edgardo Pantinople', amount: 15.0, method: 'cash', status: 'pending', createdAt: '2026-08-05T08:22:00+08:00' },
  { id: 'txn-004', rideRequestId: 'rr-1004', passengerName: 'Juan Dela Cruz', driverName: 'Ferdinand Amaro', amount: 20.0, method: 'gcash', status: 'failed', createdAt: '2026-08-04T18:10:00+08:00' },
];

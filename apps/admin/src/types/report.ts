export type PaymentMethod = 'cash' | 'gcash';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface TransactionRow {
  id: string;
  rideRequestId: string;
  passengerName: string;
  driverName: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  createdAt: string;
}

export interface ReportSummary {
  totalRides: number;
  totalRevenue: number;
  averageFare: number;
  peakHourLabel: string;
}

export interface RidesRevenuePoint {
  day: string;
  rides: number;
  revenue: number;
}

export interface PeakHourBucket {
  hourLabel: string;
  count: number;
}

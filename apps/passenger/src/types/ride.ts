import type { PaymentMethod } from './booking';

export interface RideHistoryItem {
  id: string;
  driverName: string;
  date: string;
  pickup: string;
  dropoff: string;
  fare: number;
  status: 'done' | 'cancelled';
  paymentMethod: PaymentMethod;
}

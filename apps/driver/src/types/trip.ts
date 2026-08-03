import type { PaymentMethod } from './request';

export interface ActiveTrip {
  id: string;
  passengerName: string | null;
  seats: number;
  paymentMethod: PaymentMethod;
  fare: number | null;
  cashConfirmed: boolean;
  startedAt: string;
}

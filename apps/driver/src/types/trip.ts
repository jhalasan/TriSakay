import type { PaymentMethod } from './request';

export interface ActiveTrip {
  id: string;
  tripId: string;
  passengerName: string | null;
  passengerAvatarUrl: string | null;
  seats: number;
  paymentMethod: PaymentMethod;
  fare: number | null;
  cashConfirmed: boolean;
  startedAt: string;
}

export type PaymentMethod = 'cash' | 'gcash';

export interface PendingRequest {
  id: string;
  seats: number;
  paymentMethod: PaymentMethod;
  pickupLabel: string | null;
  dropoffLabel: string | null;
  fare: number | null;
  createdAt: string;
  /** null until Task 8's Edge Function change lands — component degrades to plain "Pickup" until then. */
  pickupDistanceMeters?: number | null;
  /** null until Task 8 lands — the incoming-request countdown (Task 14/15) has nothing to count down from until this is populated. */
  expiresAt?: string | null;
}

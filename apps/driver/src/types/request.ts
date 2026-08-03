export type PaymentMethod = 'cash' | 'gcash';

export interface PendingRequest {
  id: string;
  seats: number;
  paymentMethod: PaymentMethod;
  /** Null until the backend supplies it — a simulated arrival has no real address to show. */
  pickupLabel: string | null;
  dropoffLabel: string | null;
  fare: number | null;
  createdAt: string;
}

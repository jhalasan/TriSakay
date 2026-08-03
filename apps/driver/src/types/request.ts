export type PaymentMethod = 'cash' | 'gcash';

export interface PendingRequest {
  id: string;
  seats: number;
  paymentMethod: PaymentMethod;
  pickupLabel: string | null;
  dropoffLabel: string | null;
  fare: number | null;
  createdAt: string;
}

export type PaymentMethod = 'gcash' | 'cash';

export type TripStatus =
  | 'idle'
  | 'searching'
  | 'matched'
  | 'in_progress'
  | 'awaiting_payment'
  | 'paid'
  | 'rated';

export interface LocationPoint {
  label: string;
  address: string;
}

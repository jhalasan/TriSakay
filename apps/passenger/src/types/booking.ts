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
  /** WGS84. Required so no undefined coordinate can reach the map. */
  latitude: number;
  longitude: number;
}

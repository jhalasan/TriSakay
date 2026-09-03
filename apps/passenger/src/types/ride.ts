export interface RideHistoryItem {
  id: string;
  driverName: string;
  driverRating: number | null;
  plateNo: string | null;
  bodyNo: string | null;
  date: string;
  pickup: string;
  dropoff: string;
  fare: number;
  seats: number | null;
  status: 'done' | 'cancelled';
  paymentMethod: 'cash' | 'gcash' | null;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' | null;
  distanceKm: number | null;
  durationMinutes: number | null;
  discountApplied: boolean;
  discountPercent: number | null;
  cancelReason: string | null;
}

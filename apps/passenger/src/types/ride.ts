export interface RideHistoryItem {
  id: string;
  driverName: string;
  date: string;
  pickup: string;
  dropoff: string;
  fare: number;
  status: 'done' | 'cancelled';
  paymentMethod: 'cash' | 'gcash' | null;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' | null;
  distanceKm: number | null;
  discountApplied: boolean;
  discountPercent: number | null;
  cancelReason: string | null;
}

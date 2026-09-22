export interface TripHistoryItem {
  id: string;
  passengerName: string | null;
  passengerAvatarUrl: string | null;
  date: string;
  fare: number | null;
  status: 'done' | 'cancelled';
  pickup: string | null;
  dropoff: string | null;
  distanceKm: number | null;
  durationMinutes: number | null;
  seats: number | null;
  paymentMethod: 'cash' | 'gcash' | null;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' | null;
  cancelReason: string | null;
}

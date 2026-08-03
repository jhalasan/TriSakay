export interface TripHistoryItem {
  id: string;
  passengerName: string | null;
  date: string;
  fare: number | null;
  status: 'done' | 'cancelled';
}

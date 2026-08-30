import { getSupabaseClient } from '../supabase/client.ts';

export interface PassengerTripHistoryItem {
  rideRequestId: string;
  driverName: string | null;
  pickup: string | null;
  dropoff: string | null;
  status: 'completed' | 'cancelled';
  fare: number | null;
  paymentMethod: 'cash' | 'gcash' | null;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' | null;
  date: string;
  distanceKm: number | null;
  discountApplied: boolean;
  discountPercent: number | null;
  cancelReason: string | null;
}

export interface ListPassengerTripHistoryResult {
  data: PassengerTripHistoryItem[];
  error: string | null;
}

/**
 * Calls the `get_passenger_trip_history` RPC (security definer — a passenger
 * has no direct RLS read on other users' `users` rows, so the driver's name
 * needs the same server-side join trick as getTripDriverInfo). The function
 * itself scopes results to `auth.uid()`'s own rides and only
 * 'completed'/'cancelled' ride requests.
 */
export async function listPassengerTripHistory(limit = 50): Promise<ListPassengerTripHistoryResult> {
  const { data, error } = await getSupabaseClient().rpc('get_passenger_trip_history', { p_limit: limit });

  if (error) return { data: [], error: error.message };

  const rows = (data ?? []).map((row) => ({
    rideRequestId: row.ride_request_id,
    driverName: row.driver_name,
    pickup: row.pickup_label,
    dropoff: row.dest_label,
    status: row.status as 'completed' | 'cancelled',
    fare: row.fare,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    date: row.completed_at ?? row.cancelled_at ?? row.requested_at,
    distanceKm: row.distance_km,
    discountApplied: row.discount_applied ?? false,
    discountPercent: row.discount_percent,
    cancelReason: row.cancel_reason,
  }));

  return { data: rows, error: null };
}

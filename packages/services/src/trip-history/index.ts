import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types.ts';

export interface PassengerTripHistoryItem {
  rideRequestId: string;
  driverName: string | null;
  driverAvatarUrl: string | null;
  driverRating: number | null;
  plateNo: string | null;
  bodyNo: string | null;
  pickup: string | null;
  dropoff: string | null;
  status: 'completed' | 'cancelled';
  fare: number | null;
  seats: number | null;
  paymentMethod: 'cash' | 'gcash' | null;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' | null;
  date: string;
  distanceKm: number | null;
  durationMinutes: number | null;
  discountApplied: boolean;
  discountPercent: number | null;
  cancelReason: string | null;
}

export interface ListPassengerTripHistoryResult {
  data: PassengerTripHistoryItem[];
  error: string | null;
}

type PassengerTripHistoryRow = Database['public']['Functions']['get_passenger_trip_history']['Returns'][number];

function mapPassengerTripHistoryRow(row: PassengerTripHistoryRow): PassengerTripHistoryItem {
  return {
    rideRequestId: row.ride_request_id,
    driverName: row.driver_name,
    driverAvatarUrl: row.driver_avatar_url,
    driverRating: row.driver_rating,
    plateNo: row.plate_no,
    bodyNo: row.body_no,
    pickup: row.pickup_label,
    dropoff: row.dest_label,
    status: row.status as 'completed' | 'cancelled',
    fare: row.fare,
    seats: row.seats,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    date: row.completed_at ?? row.cancelled_at ?? row.requested_at,
    distanceKm: row.distance_km,
    durationMinutes: row.duration_minutes,
    discountApplied: row.discount_applied ?? false,
    discountPercent: row.discount_percent,
    cancelReason: row.cancel_reason,
  };
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

  return { data: (data ?? []).map(mapPassengerTripHistoryRow), error: null };
}

export interface GetPassengerRideReceiptResult {
  data: PassengerTripHistoryItem | null;
  error: string | null;
}

/**
 * F5 (UAT audit): the one-row lookup trip-complete.tsx needs — same RPC and
 * shape as listPassengerTripHistory, filtered server-side to a single ride
 * via `get_passenger_trip_history`'s optional p_ride_request_id, so the
 * receipt reflects the ride's actual final_fare/distance/payment record
 * instead of whatever the client's local booking store happened to hold.
 */
export async function getPassengerRideReceipt(rideRequestId: string): Promise<GetPassengerRideReceiptResult> {
  const { data, error } = await getSupabaseClient().rpc('get_passenger_trip_history', {
    p_limit: 1,
    p_ride_request_id: rideRequestId,
  });

  if (error) return { data: null, error: error.message };

  const row = (data ?? [])[0];
  return { data: row ? mapPassengerTripHistoryRow(row) : null, error: null };
}

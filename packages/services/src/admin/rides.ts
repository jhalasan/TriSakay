import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types.ts';

export type AdminRideStatus = Database['public']['Enums']['ride_status'];

export interface AdminRideLogRow {
  id: string;
  passengerName: string | null;
  driverName: string | null;
  status: AdminRideStatus;
  pickupLabel: string | null;
  destLabel: string | null;
  requestedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  finalFare: number | null;
  hasEmergencyAlert: boolean;
  /** Y10 (existing-system audit): true when the driver completed this leg more than ~500m from the booked destination. */
  fareFlagged: boolean;
}

export interface ListRideLogForAdminResult {
  data: AdminRideLogRow[];
  error: string | null;
  /** True when the row cap was hit, so older rides in the range were not returned. */
  truncated: boolean;
}

const RIDE_LOG_ROW_CAP = 2000;

/**
 * UAT A3 — a searchable, all-status ride history. Ride Monitoring only shows live tricycles and
 * Reports only covers payments, so neither can show a cancelled or in-progress ride. Built in the
 * database (admin_list_ride_log, PSO only) with passenger and driver names joined there, so a long
 * range no longer sends hundreds of ids in one request. `truncated` is true when the 2,000 row cap
 * cut the list.
 */
export async function listRideLogForAdmin(sinceIso: string): Promise<ListRideLogForAdminResult> {
  const { data, error } = await getSupabaseClient().rpc('admin_list_ride_log', { p_since: sinceIso });

  if (error) return { data: [], error: error.message, truncated: false };

  const all = data ?? [];
  const rows: AdminRideLogRow[] = all.slice(0, RIDE_LOG_ROW_CAP).map((r) => ({
    id: r.id,
    passengerName: r.passenger_name,
    driverName: r.driver_name,
    status: r.status,
    pickupLabel: r.pickup_label,
    destLabel: r.dest_label,
    requestedAt: r.requested_at,
    completedAt: r.completed_at,
    cancelledAt: r.cancelled_at,
    finalFare: r.final_fare === null ? null : Number(r.final_fare),
    hasEmergencyAlert: r.has_emergency_alert,
    fareFlagged: r.fare_flagged,
  }));

  return { data: rows, error: null, truncated: all.length > RIDE_LOG_ROW_CAP };
}

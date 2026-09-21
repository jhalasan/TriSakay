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
}

export interface ListRideLogForAdminResult {
  data: AdminRideLogRow[];
  error: string | null;
}

/**
 * UAT A3 — Ride Monitoring only shows currently-active tricycles (FR-5.1,
 * intentionally live-only per its own wireframe scope), which can't show
 * cancelled or completed rides at all. Reports' Transactions table only
 * covers *paid* rides, so cancelled/in-progress rides have no row there
 * either. This reads `ride_requests` directly instead — `rr_pso_read` RLS
 * (`using (is_pso())`) already grants any PSO role full read access, so no
 * new RPC/migration is needed. Name resolution follows the same "no
 * multi-hop embed, one follow-up users lookup" convention as
 * listEmergencyAlertsForAdmin/listComplaintsForAdmin.
 */
export async function listRideLogForAdmin(sinceIso: string): Promise<ListRideLogForAdminResult> {
  const client = getSupabaseClient();

  const { data: rides, error: ridesError } = await client
    .from('ride_requests')
    .select('id, passenger_id, trip_id, status, pickup_label, dest_label, requested_at, completed_at, cancelled_at, final_fare')
    .gte('requested_at', sinceIso)
    .order('requested_at', { ascending: false });

  if (ridesError) return { data: [], error: ridesError.message };
  if (!rides || rides.length === 0) return { data: [], error: null };

  const rideIds = rides.map((r) => r.id);
  const tripIds = [...new Set(rides.map((r) => r.trip_id).filter((id): id is string => id !== null))];

  const [{ data: trips, error: tripsError }, { data: alerts, error: alertsError }] = await Promise.all([
    tripIds.length > 0
      ? client.from('trips').select('id, driver_id').in('id', tripIds)
      : Promise.resolve({ data: [] as { id: string; driver_id: string }[], error: null }),
    client.from('emergency_alerts').select('ride_request_id').in('ride_request_id', rideIds),
  ]);

  if (tripsError) return { data: [], error: tripsError.message };
  if (alertsError) return { data: [], error: alertsError.message };

  const driverIdByTripId = new Map((trips ?? []).map((t) => [t.id, t.driver_id]));
  const driverIds = [...new Set((trips ?? []).map((t) => t.driver_id))];
  const passengerIds = rides.map((r) => r.passenger_id);
  const allUserIds = [...new Set([...passengerIds, ...driverIds])];

  const { data: users, error: usersError } = await client.from('users').select('id, full_name').in('id', allUserIds);
  if (usersError) return { data: [], error: usersError.message };

  const nameById = new Map((users ?? []).map((u) => [u.id, u.full_name]));
  const alertedRideIds = new Set((alerts ?? []).map((a) => a.ride_request_id));

  const data: AdminRideLogRow[] = rides.map((r) => {
    const driverId = r.trip_id ? (driverIdByTripId.get(r.trip_id) ?? null) : null;
    return {
      id: r.id,
      passengerName: nameById.get(r.passenger_id) ?? null,
      driverName: driverId ? (nameById.get(driverId) ?? null) : null,
      status: r.status,
      pickupLabel: r.pickup_label,
      destLabel: r.dest_label,
      requestedAt: r.requested_at,
      completedAt: r.completed_at,
      cancelledAt: r.cancelled_at,
      finalFare: r.final_fare,
      hasEmergencyAlert: alertedRideIds.has(r.id),
    };
  });

  return { data, error: null };
}

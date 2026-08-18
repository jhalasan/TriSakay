import { getSupabaseClient } from '../supabase/client.ts';

export interface AdminActiveTricycleRow {
  driverId: string;
  driverFullName: string;
  plateNo: string;
  tripStatus: 'active' | 'idle';
  seatsTaken: number;
  maxSeats: number;
}

export interface ListActiveTricyclesForAdminResult {
  data: AdminActiveTricycleRow[];
  error: string | null;
}

/**
 * FR-5.1/5.2 — every driver currently on the clock (`driver_profiles.is_available`),
 * same "no multi-hop embed" convention as admin/drivers.ts's
 * listDriversForAdmin(). A driver's current trip (`trips.status = 'active'`)
 * determines `tripStatus`/`seatsTaken`; a driver with no active trip is
 * `idle` with 0 seats taken but still shows their tricycle's capacity.
 * Location stays coarse (on-trip/idle only, no coordinates) per NFR-2.5 —
 * this module never reads current_lat/current_lng.
 */
export async function listActiveTricyclesForAdmin(): Promise<ListActiveTricyclesForAdminResult> {
  const client = getSupabaseClient();

  const { data: profiles, error: profilesError } = await client
    .from('driver_profiles')
    .select('user_id')
    .eq('is_available', true);

  if (profilesError) return { data: [], error: profilesError.message };
  if (!profiles || profiles.length === 0) return { data: [], error: null };

  const driverIds = profiles.map((p) => p.user_id);

  const [
    { data: users, error: usersError },
    { data: tricycles, error: tricyclesError },
    { data: trips, error: tripsError },
  ] = await Promise.all([
    client.from('users').select('id, full_name').in('id', driverIds),
    client.from('tricycles').select('driver_id, plate_no, seat_capacity').in('driver_id', driverIds).eq('is_active', true),
    client.from('trips').select('id, driver_id, max_seats').in('driver_id', driverIds).eq('status', 'active'),
  ]);

  if (usersError) return { data: [], error: usersError.message };
  if (tricyclesError) return { data: [], error: tricyclesError.message };
  if (tripsError) return { data: [], error: tripsError.message };

  const nameById = new Map((users ?? []).map((u) => [u.id, u.full_name]));
  const tricycleByDriverId = new Map((tricycles ?? []).map((t) => [t.driver_id, t]));
  const tripByDriverId = new Map((trips ?? []).map((t) => [t.driver_id, t]));

  const activeTripIds = (trips ?? []).map((t) => t.id);
  const seatsByTripId = new Map<string, number>();
  if (activeTripIds.length > 0) {
    const { data: requests, error: requestsError } = await client
      .from('ride_requests')
      .select('trip_id, seats_requested')
      .in('trip_id', activeTripIds)
      .in('status', ['assigned', 'ongoing']);

    if (requestsError) return { data: [], error: requestsError.message };

    for (const r of requests ?? []) {
      if (!r.trip_id) continue;
      seatsByTripId.set(r.trip_id, (seatsByTripId.get(r.trip_id) ?? 0) + r.seats_requested);
    }
  }

  const rows: AdminActiveTricycleRow[] = driverIds
    .map((driverId) => {
      const tricycle = tricycleByDriverId.get(driverId);
      const trip = tripByDriverId.get(driverId);
      return {
        driverId,
        driverFullName: nameById.get(driverId) ?? '—',
        plateNo: tricycle?.plate_no ?? '—',
        tripStatus: trip ? ('active' as const) : ('idle' as const),
        seatsTaken: trip ? (seatsByTripId.get(trip.id) ?? 0) : 0,
        maxSeats: trip?.max_seats ?? tricycle?.seat_capacity ?? 0,
      };
    })
    .sort((a, b) => a.driverFullName.localeCompare(b.driverFullName));

  return { data: rows, error: null };
}

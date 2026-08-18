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

export interface ActiveTricycleLocationCell {
  lat: number;
  lng: number;
  count: number;
  driverNames: string[];
}

export interface GetActiveTricycleLocationsResult {
  data: ActiveTricycleLocationCell[];
  error: string | null;
}

/** ~1.1km grid cell — never exposes a driver's literal coordinates. */
function roundToGrid(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * FR-5.1/5.2 map data. Coordinates are rounded to a coarse grid before
 * anything else touches them, per NFR-2.5 — multiple drivers in the same
 * cell collapse into one marker with a count, never individual exact pins.
 * Only `is_available` drivers with a live fix are included; the same
 * `clear_location_when_offline` trigger that nulls current_lat/current_lng
 * on sign-off (docs/SCHEMA.MD §4.7) means an offline driver is naturally
 * excluded here without an extra filter.
 */
export async function getActiveTricycleLocations(): Promise<GetActiveTricycleLocationsResult> {
  const client = getSupabaseClient();

  const { data: profiles, error: profilesError } = await client
    .from('driver_profiles')
    .select('user_id, current_lat, current_lng')
    .eq('is_available', true);

  if (profilesError) return { data: [], error: profilesError.message };

  const located = (profiles ?? []).filter(
    (p): p is typeof p & { current_lat: number; current_lng: number } => p.current_lat != null && p.current_lng != null
  );
  if (located.length === 0) return { data: [], error: null };

  const driverIds = located.map((p) => p.user_id);
  const { data: users, error: usersError } = await client.from('users').select('id, full_name').in('id', driverIds);
  if (usersError) return { data: [], error: usersError.message };

  const nameById = new Map((users ?? []).map((u) => [u.id, u.full_name]));

  const cellByKey = new Map<string, ActiveTricycleLocationCell>();
  for (const p of located) {
    const lat = roundToGrid(p.current_lat);
    const lng = roundToGrid(p.current_lng);
    const key = `${lat},${lng}`;
    const name = nameById.get(p.user_id) ?? '—';
    const existing = cellByKey.get(key);
    if (existing) {
      existing.count += 1;
      existing.driverNames.push(name);
    } else {
      cellByKey.set(key, { lat, lng, count: 1, driverNames: [name] });
    }
  }

  return { data: [...cellByKey.values()], error: null };
}

// FR-2.5 ride-matching heuristic. Given a driver, returns the subset of
// `pending` ride_requests they are allowed and well-positioned to serve:
//
//   1. HARD FILTER — cluster authorization (Ordinance No. 37, s.2018, Sec.
//      119) + remaining seat capacity. The cluster check mirrors
//      public.is_cluster_authorized() (docs/SCHEMA.MD §4.3b) rather than
//      calling it via .rpc() per candidate, to avoid one round trip per
//      pending request in a request-board-scale hot path — if the ordinance
//      logic there ever changes, update both together. A pickup with no
//      resolved barangay cluster is excluded, same as the DB function's own
//      null handling (safer default, not silently allowed).
//   2. SOFT FILTER — bearing tolerance + detour ratio (both read from
//      system_settings) between the driver's current position/declared
//      route and each request's pickup/destination. Only applied once the
//      driver has a known position and destination to compare against; a
//      driver with no live location yet (client-side location writes are
//      not implemented as of this pass — see docs/CHECKLIST.MD P0 "Driver
//      availability toggle") gets the hard-filtered list only, oldest
//      request first, so the request board never goes silently empty.
//
// Invoked by the driver app on every request-board refresh — see
// subscribeToPendingRideRequests() in packages/services/src/booking/index.ts,
// which re-invokes this function on its existing Realtime subscription to
// `ride_requests` (new pending request, a request being claimed, etc).
// There is no separate results table; docs/CONTEXT.MD §9's "pushes results
// via Realtime" is approximated by that client-driven re-invoke rather than
// a server-initiated broadcast — a deliberate scope trim for this prototype.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type TricycleCluster = 'red' | 'white' | 'apple_green' | 'melting_pot';

interface RideRequestRow {
  id: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_barangay_id: string | null;
  dest_lat: number;
  dest_lng: number;
  seats_requested: number;
  requested_at: string;
  [key: string]: unknown;
}

interface ScoredCandidate extends RideRequestRow {
  bearingDiffDeg: number;
  distanceKm: number;
  detourRatio: number;
}

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function bearingDeg(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const dLng = toRad(bLng - aLng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function bearingDiffDeg(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/** Mirrors public.is_cluster_authorized() — see the file header comment. */
function isClusterAuthorized(
  tricycleCluster: TricycleCluster | null,
  barangayCluster: TricycleCluster | null,
): boolean {
  if (!tricycleCluster || !barangayCluster) return false;
  if (tricycleCluster === barangayCluster) return true;
  return barangayCluster === 'melting_pot' && tricycleCluster !== 'melting_pot';
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ data: null, error: 'Missing Authorization header' }, 401);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return json({ data: null, error: 'Not authenticated' }, 401);

    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const driverId = typeof body.driverId === 'string' ? body.driverId : userData.user.id;

    // The caller's own JWT already scopes every query below via RLS (a
    // driver can only ever read their own driver_profiles/tricycles row),
    // so this is a courtesy error rather than the actual access control.
    if (driverId !== userData.user.id) {
      return json({ data: null, error: 'driverId must match the authenticated user' }, 403);
    }

    const [{ data: driverProfile, error: driverError }, { data: tricycle }, { data: activeTrip }, { data: settings }] =
      await Promise.all([
        supabase
          .from('driver_profiles')
          .select('is_available, verification_status, current_lat, current_lng, declared_dest_lat, declared_dest_lng')
          .eq('user_id', driverId)
          .maybeSingle(),
        supabase
          .from('tricycles')
          .select('cluster, seat_capacity')
          .eq('driver_id', driverId)
          .eq('is_active', true)
          .eq('verification_status', 'approved')
          .maybeSingle(),
        supabase
          .from('trips')
          .select('id, max_seats, origin_lat, origin_lng, declared_dest_lat, declared_dest_lng')
          .eq('driver_id', driverId)
          .eq('status', 'active')
          .maybeSingle(),
        supabase
          .from('system_settings')
          .select('bearing_tolerance_deg, detour_ratio_max, search_radius_km')
          .eq('is_active', true)
          .maybeSingle(),
      ]);

    if (driverError) return json({ data: null, error: driverError.message }, 500);

    // No driver_profiles row, not available/verified, or no active tricycle
    // yet: nothing to match against. Empty board, not an error.
    if (!driverProfile || !driverProfile.is_available || driverProfile.verification_status !== 'approved' || !tricycle) {
      return json({ data: [], error: null, heuristicApplied: false });
    }

    const { data: pendingRows, error: pendingError } = await supabase
      .from('ride_requests')
      .select('*')
      .eq('status', 'pending')
      .order('requested_at', { ascending: true });

    if (pendingError) return json({ data: null, error: pendingError.message }, 500);

    const rows = (pendingRows ?? []) as RideRequestRow[];

    const barangayIds = [...new Set(rows.map((r) => r.pickup_barangay_id).filter((id): id is string => !!id))];
    const barangayClusterById = new Map<string, TricycleCluster | null>();
    if (barangayIds.length > 0) {
      const { data: barangays } = await supabase.from('barangays').select('id, cluster').in('id', barangayIds);
      for (const b of barangays ?? []) barangayClusterById.set(b.id, b.cluster as TricycleCluster | null);
    }

    const totalCapacity = activeTrip ? activeTrip.max_seats : tricycle.seat_capacity;

    const hardFiltered = rows.filter((r) => {
      const barangayCluster = r.pickup_barangay_id ? (barangayClusterById.get(r.pickup_barangay_id) ?? null) : null;
      if (!isClusterAuthorized(tricycle.cluster as TricycleCluster | null, barangayCluster)) return false;
      if (r.seats_requested > totalCapacity) return false;
      return true;
    });

    const originLat = activeTrip?.origin_lat ?? driverProfile.current_lat;
    const originLng = activeTrip?.origin_lng ?? driverProfile.current_lng;
    const destLat = activeTrip?.declared_dest_lat ?? driverProfile.declared_dest_lat;
    const destLng = activeTrip?.declared_dest_lng ?? driverProfile.declared_dest_lng;

    const heuristicApplied = originLat != null && originLng != null && destLat != null && destLng != null && !!settings;

    let data: RideRequestRow[];

    if (heuristicApplied && settings) {
      const driverBearing = bearingDeg(originLat!, originLng!, destLat!, destLng!);
      const directKm = haversineKm(originLat!, originLng!, destLat!, destLng!);

      const scored: ScoredCandidate[] = hardFiltered.map((r) => {
        const toPickupKm = haversineKm(originLat!, originLng!, r.pickup_lat, r.pickup_lng);
        const pickupToReqDestKm = haversineKm(r.pickup_lat, r.pickup_lng, r.dest_lat, r.dest_lng);
        const reqDestToDriverDestKm = haversineKm(r.dest_lat, r.dest_lng, destLat!, destLng!);
        const detourKm = toPickupKm + pickupToReqDestKm + reqDestToDriverDestKm;

        return {
          ...r,
          distanceKm: toPickupKm,
          bearingDiffDeg: bearingDiffDeg(driverBearing, bearingDeg(originLat!, originLng!, r.pickup_lat, r.pickup_lng)),
          detourRatio: directKm > 0 ? detourKm / directKm : 1,
        };
      });

      data = scored
        .filter(
          (r) =>
            r.distanceKm <= settings.search_radius_km &&
            r.bearingDiffDeg <= settings.bearing_tolerance_deg &&
            r.detourRatio <= settings.detour_ratio_max,
        )
        .sort((a, b) => a.bearingDiffDeg - b.bearingDiffDeg || a.distanceKm - b.distanceKm)
        .map(({ bearingDiffDeg: _b, distanceKm: _d, detourRatio: _r, ...row }) => row);
    } else {
      data = hardFiltered;
    }

    return json({ data, error: null, heuristicApplied });
  } catch (err) {
    return json({ data: null, error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
  }
});

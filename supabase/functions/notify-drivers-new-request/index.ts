// P1-12 (2026-09-15 launch audit): server-side push delivery for new ride
// requests. Previously, a driver whose app was backgrounded (or killed)
// never learned a request existed — the request board
// (subscribeToPendingRideRequests in packages/services/src/booking) is a
// foreground-only Realtime subscription that re-invokes match-ride-request.
//
// This function is invoked by a Postgres trigger (trg_notify_drivers_new_request
// on ride_requests, AFTER INSERT WHEN status = 'pending') via pg_net, not by
// any client. It is NOT a client-facing endpoint, so it authenticates the
// caller with a shared secret rather than a Supabase JWT (there is no
// end-user session at trigger time) — verify_jwt is deliberately false at
// deploy time, matching paymongo-webhook's own non-JWT auth model, and this
// header check is the actual gate.
//
// Body-supplied data beyond the ride_request id is never trusted: this
// function re-fetches the authoritative row from the database with the
// service-role client before doing anything, the same discipline
// create-gcash-checkout uses for fare amounts.
//
// Eligibility mirrors match-ride-request's own hard cluster filter
// (isClusterAuthorized) — kept in sync manually, same as that file's own
// header comment already asks of match-ride-request. Only the hard filter
// is applied here (not the soft bearing/detour heuristic, which needs a
// driver's live position/declared route — a push notification's job is
// only to wake the app, not to fully rank the board).
//
// R2 (existing-system audit): this used to push every eligible driver in
// the whole system regardless of distance ("A passenger nearby..." going to
// drivers city-wide). Now also requires the candidate driver's own
// `current_lat/lng` to be within `search_radius_km` of the ride's pickup,
// and their `location_updated_at` to be no more than 2 minutes old — same
// radius/freshness rule as match-ride-request and nearby-driver-count.

import { createClient } from 'npm:@supabase/supabase-js@2';

// 2026-09-24: was a literal string committed in source (and this repo is
// public) — anyone could read it off GitHub and call this function directly,
// bypassing the app entirely, to push-spam every driver. Now read from an
// Edge Function secret instead (see NOTIFY_SHARED_SECRET in Supabase
// project settings / `supabase secrets set`), which the caller (the
// trg_notify_drivers_new_request trigger, via Vault — see
// supabase/migrations/20260924000001_rotate_notify_shared_secret.sql) must
// also have to authenticate.
const SHARED_SECRET = Deno.env.get('NOTIFY_SHARED_SECRET') ?? '';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type TricycleCluster = 'red' | 'white' | 'apple_green' | 'melting_pot';

const EARTH_RADIUS_KM = 6371;
const DEFAULT_SEARCH_RADIUS_KM = 3;
const LOCATION_STALE_MS = 2 * 60 * 1000;

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Mirrors public.is_cluster_authorized() / match-ride-request's isClusterAuthorized(). */
function isClusterAuthorized(
  tricycleCluster: TricycleCluster | null,
  barangayCluster: TricycleCluster | null,
): boolean {
  if (!tricycleCluster) return false;
  if (!barangayCluster) return true;
  if (tricycleCluster === barangayCluster) return true;
  return barangayCluster === 'melting_pot' && tricycleCluster !== 'melting_pot';
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  try {
    // Fail closed, not open: an empty SHARED_SECRET (env var not set) must
    // never match an empty Authorization header.
    if (!SHARED_SECRET) {
      console.error('notify-drivers-new-request: NOTIFY_SHARED_SECRET is not configured');
      return json({ error: 'Server misconfigured' }, 500);
    }
    const authHeader = req.headers.get('Authorization') ?? '';
    const provided = authHeader.replace(/^Bearer\s+/i, '');
    if (!timingSafeEqual(provided, SHARED_SECRET)) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const payload = await req.json().catch(() => ({}) as Record<string, unknown>);
    const rideRequestId =
      typeof payload.rideRequestId === 'string'
        ? payload.rideRequestId
        : (payload.record as Record<string, unknown> | undefined)?.id;

    if (typeof rideRequestId !== 'string') {
      return json({ error: 'rideRequestId required' }, 400);
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: rideRequest, error: rideError } = await supabase
      .from('ride_requests')
      .select('id, status, pickup_barangay_id, pickup_lat, pickup_lng, seats_requested')
      .eq('id', rideRequestId)
      .maybeSingle();

    if (rideError) return json({ error: rideError.message }, 500);
    // Already claimed/cancelled by the time this fired, or an unknown id —
    // nothing to notify about.
    if (!rideRequest || rideRequest.status !== 'pending') {
      return json({ sent: 0, skipped: 'not pending' });
    }

    const { data: settings } = await supabase
      .from('system_settings')
      .select('search_radius_km')
      .eq('is_active', true)
      .maybeSingle();
    const radiusKm = settings?.search_radius_km ?? DEFAULT_SEARCH_RADIUS_KM;

    let barangayCluster: TricycleCluster | null = null;
    if (rideRequest.pickup_barangay_id) {
      const { data: barangay } = await supabase
        .from('barangays')
        .select('cluster')
        .eq('id', rideRequest.pickup_barangay_id)
        .maybeSingle();
      barangayCluster = (barangay?.cluster as TricycleCluster | null) ?? null;
    }

    const { data: candidates, error: candidatesError } = await supabase
      .from('driver_profiles')
      .select(
        'user_id, current_lat, current_lng, location_updated_at, users!driver_profiles_user_id_fkey!inner(push_token), tricycles!inner(cluster, seat_capacity, is_active, verification_status)',
      )
      .eq('is_available', true)
      .eq('verification_status', 'approved')
      .eq('tricycles.is_active', true)
      .eq('tricycles.verification_status', 'approved')
      .not('users.push_token', 'is', null)
      .not('current_lat', 'is', null)
      .not('current_lng', 'is', null)
      .not('location_updated_at', 'is', null);

    if (candidatesError) return json({ error: candidatesError.message }, 500);

    type Candidate = {
      user_id: string;
      current_lat: number | null;
      current_lng: number | null;
      location_updated_at: string | null;
      users: { push_token: string | null } | { push_token: string | null }[];
      tricycles: { cluster: TricycleCluster | null; seat_capacity: number }[] | { cluster: TricycleCluster | null; seat_capacity: number };
    };

    const messages: { to: string; sound: string; title: string; body: string; data: Record<string, unknown> }[] = [];
    const now = Date.now();

    for (const row of (candidates ?? []) as Candidate[]) {
      const usersRow = Array.isArray(row.users) ? row.users[0] : row.users;
      const tricycle = Array.isArray(row.tricycles) ? row.tricycles[0] : row.tricycles;
      const pushToken = usersRow?.push_token;
      if (!pushToken) continue;
      if (tricycle.seat_capacity < rideRequest.seats_requested) continue;
      if (!isClusterAuthorized(tricycle.cluster, barangayCluster)) continue;
      if (now - new Date(row.location_updated_at!).getTime() > LOCATION_STALE_MS) continue;
      if (haversineKm(row.current_lat!, row.current_lng!, rideRequest.pickup_lat, rideRequest.pickup_lng) > radiusKm) continue;

      messages.push({
        to: pushToken,
        sound: 'default',
        title: 'New ride request',
        body: 'A passenger nearby is looking for a ride. Open TriSakay to view it.',
        data: { type: 'new_ride_request', rideRequestId: rideRequest.id },
      });
    }

    // Expo recommends batches of at most 100 messages per call.
    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);
      await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch),
      }).catch((err) => {
        console.error('notify-drivers-new-request: Expo push send failed', err instanceof Error ? err.message : err);
      });
    }

    return json({ sent: messages.length });
  } catch (err) {
    console.error('notify-drivers-new-request: unexpected error', err instanceof Error ? err.message : err);
    return json({ error: 'Internal error' }, 500);
  }
});

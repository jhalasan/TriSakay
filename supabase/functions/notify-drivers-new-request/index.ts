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

import { createClient } from 'npm:@supabase/supabase-js@2';

const SHARED_SECRET = '59a4b603ca44e480a724b4646a33f6da7094f1803cc2825685f09762a3aa47ae';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type TricycleCluster = 'red' | 'white' | 'apple_green' | 'melting_pot';

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
      .select('id, status, pickup_barangay_id, seats_requested')
      .eq('id', rideRequestId)
      .maybeSingle();

    if (rideError) return json({ error: rideError.message }, 500);
    // Already claimed/cancelled by the time this fired, or an unknown id —
    // nothing to notify about.
    if (!rideRequest || rideRequest.status !== 'pending') {
      return json({ sent: 0, skipped: 'not pending' });
    }

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
        'user_id, users!driver_profiles_user_id_fkey!inner(push_token), tricycles!inner(cluster, seat_capacity, is_active, verification_status)',
      )
      .eq('is_available', true)
      .eq('verification_status', 'approved')
      .eq('tricycles.is_active', true)
      .eq('tricycles.verification_status', 'approved')
      .not('users.push_token', 'is', null);

    if (candidatesError) return json({ error: candidatesError.message }, 500);

    type Candidate = {
      user_id: string;
      users: { push_token: string | null } | { push_token: string | null }[];
      tricycles: { cluster: TricycleCluster | null; seat_capacity: number }[] | { cluster: TricycleCluster | null; seat_capacity: number };
    };

    const messages: { to: string; sound: string; title: string; body: string; data: Record<string, unknown> }[] = [];

    for (const row of (candidates ?? []) as Candidate[]) {
      const usersRow = Array.isArray(row.users) ? row.users[0] : row.users;
      const tricycle = Array.isArray(row.tricycles) ? row.tricycles[0] : row.tricycles;
      const pushToken = usersRow?.push_token;
      if (!pushToken) continue;
      if (tricycle.seat_capacity < rideRequest.seats_requested) continue;
      if (!isClusterAuthorized(tricycle.cluster, barangayCluster)) continue;

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

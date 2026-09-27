import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EARTH_RADIUS_KM = 6371;
// R2 (existing-system audit): this count already filtered by radius, but not
// by location freshness — a driver whose app died hours ago with a stale
// `current_lat/lng` still counted as "nearby" until R1's offline cron caught
// up. Same 2-minute cutoff as match-ride-request.
const LOCATION_STALE_MS = 2 * 60 * 1000;

// R10 (existing-system audit): an exact count of 1, combined with moving the
// query point around, lets a caller triangulate that one driver's live
// location — this function was never meant to expose anything finer than
// "roughly how many". Rounding up to the nearest ROUND_TO means "1" is never
// returned on its own, and NEARBY_DRIVER_COUNT_LIMIT (per caller, per hour,
// via increment_nearby_driver_count_usage) bounds how many different query
// points one caller can probe in a session — both together make triangulation
// impractical without blocking the legitimate "· N nearby" home-screen chip,
// which only ever calls this a handful of times per session.
const ROUND_TO = 3;
const NEARBY_DRIVER_COUNT_LIMIT = 20;

function roundNearbyCount(count: number): number {
  return count === 0 ? 0 : Math.ceil(count / ROUND_TO) * ROUND_TO;
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
    // P1-7 (2026-09-15 launch audit): this function used to skip
    // authentication entirely and go straight to a service-role client,
    // bypassing RLS with no caller identity check at all — every sibling
    // Edge Function (match-ride-request, create-gcash-checkout,
    // admin-create-pso-user) requires the Authorization header first. This
    // function only returns an aggregate count (never raw driver
    // coordinates), so the service-role read below is still needed — a
    // plain passenger has no RLS access to other drivers' driver_profiles
    // rows — but a caller must now be a real signed-in user first.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

    const callerClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Not authenticated' }, 401);

    const { lat, lng } = await req.json();
    if (
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return json({ error: 'lat/lng required, in valid range' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: allowed, error: rateLimitError } = await supabase.rpc('increment_nearby_driver_count_usage', {
      p_user_id: userData.user.id,
      p_limit: NEARBY_DRIVER_COUNT_LIMIT,
    });
    if (rateLimitError) return json({ error: rateLimitError.message }, 500);
    if (!allowed) return json({ error: 'Too many requests. Please try again later.' }, 429);

    const { data: settings } = await supabase
      .from('system_settings')
      .select('search_radius_km')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    const radiusKm = settings?.search_radius_km ?? 3;

    const { data: drivers, error } = await supabase
      .from('driver_profiles')
      .select('current_lat, current_lng, location_updated_at')
      .eq('is_available', true)
      .not('current_lat', 'is', null)
      .not('current_lng', 'is', null)
      .not('location_updated_at', 'is', null);

    if (error) return json({ error: error.message }, 500);

    const now = Date.now();
    const count = (drivers ?? []).filter(
      (d) =>
        now - new Date(d.location_updated_at!).getTime() <= LOCATION_STALE_MS &&
        haversineKm(lat, lng, d.current_lat!, d.current_lng!) <= radiusKm,
    ).length;

    return json({ count: roundNearbyCount(count) });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

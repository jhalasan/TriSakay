// G2 (Google Maps): server-side proxy for Places search and route
// computation. Holds the Google server API key (Deno.env, never shipped to
// the client) and rate-limits per user, so a scripted or buggy client can't
// burn through the project's shared Google quota (L14 in
// docs/UAT_PANELIST_REVIEW_ADRALES.md).
//
// Auth model: a real Supabase JWT, same pattern as create-gcash-checkout —
// verify_jwt stays on (this is a client-facing endpoint with real end-user
// sessions, unlike notify-drivers-new-request's shared-secret/no-session
// case). The forwarded Authorization header + anon client's auth.getUser()
// identifies the caller; a separate service-role client only touches
// maps_proxy_usage, which has no client-facing policy at all.
//
// "Quiet fallback" by design (see the plan's G2 guardrails): every failure
// path here — auth issue aside — returns `{ fallback: true }` with a 200,
// never a 4xx/5xx the client would have to specially handle. The client
// (geocode.ts / route.ts) treats that exactly like "call this function
// failed" and falls back to Nominatim / a straight line, the same one
// code path either way.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Guardrails from the plan — see docs/UAT_PANELIST_REVIEW_ADRALES.md.
const SEARCH_LIMIT_PER_HOUR = 60;
const ROUTE_LIMIT_PER_HOUR = 20;
const GOOGLE_TIMEOUT_MS = 8000;

// General Santos City centre — matches packages/ui's OsmMap DEFAULT_CENTER
// and apps/admin's LiveMap transcription of the same constant.
const CITY_CENTER = { latitude: 6.116243, longitude: 125.171738 };
const SEARCH_BIAS_RADIUS_M = 25000; // ~ SEARCH_BOX_DEGREES's old service-area box

interface SearchResult {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
}

interface RouteResult {
  distanceKm: number;
  geometry: { latitude: number; longitude: number }[];
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

/** Standard Google encoded-polyline decoder (Routes API returns this, not raw coordinates). */
function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
  const points: { latitude: number; longitude: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GOOGLE_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Places Text Search (New) — chosen over Autocomplete+Details for this
 * screen specifically: it returns full place data (including lat/lng) for
 * every candidate in ONE call, which matches the existing client contract
 * (searchPlaces() already returns full LocationPoint[] synchronously, same
 * as the Nominatim call it replaces) with zero changes needed to
 * set-pickup.tsx / set-destination.tsx's selection UI. Billed under the
 * Places API (New) "Pro" tier (5,000/month free) rather than Autocomplete's
 * "Essentials" tier (10,000/month) — a real trade-off, mitigated by the
 * hourly rate limit here and the low daily quota cap set in Cloud Console.
 */
async function searchPlaces(apiKey: string, query: string): Promise<SearchResult[] | null> {
  try {
    const response = await fetchWithTimeout('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
      },
      body: JSON.stringify({
        textQuery: query,
        locationBias: {
          circle: { center: { latitude: CITY_CENTER.latitude, longitude: CITY_CENTER.longitude }, radius: SEARCH_BIAS_RADIUS_M },
        },
        regionCode: 'PH',
        maxResultCount: 8,
      }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      places?: { displayName?: { text?: string }; formattedAddress?: string; location?: { latitude?: number; longitude?: number } }[];
    };
    const places = data.places ?? [];
    const results = places
      .filter((place) => typeof place.location?.latitude === 'number' && typeof place.location?.longitude === 'number')
      .map((place) => ({
        label: place.displayName?.text ?? place.formattedAddress ?? 'Unnamed place',
        address: place.formattedAddress ?? place.displayName?.text ?? '',
        latitude: place.location!.latitude!,
        longitude: place.location!.longitude!,
      }));
    return results;
  } catch (err) {
    console.error('maps-proxy: places search failed', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Routes API "Compute Routes", Essentials tier (no traffic-aware fields
 * requested, per the plan's guardrails). Returns null on any failure so the
 * caller falls back to a straight line — never throws.
 */
async function computeRoute(
  apiKey: string,
  pickup: { latitude: number; longitude: number },
  dropoff: { latitude: number; longitude: number },
): Promise<RouteResult | null> {
  try {
    const response = await fetchWithTimeout('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: pickup.latitude, longitude: pickup.longitude } } },
        destination: { location: { latLng: { latitude: dropoff.latitude, longitude: dropoff.longitude } } },
        travelMode: 'DRIVE',
        polylineQuality: 'OVERVIEW',
      }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { routes?: { distanceMeters?: number; polyline?: { encodedPolyline?: string } }[] };
    const route = data.routes?.[0];
    const encoded = route?.polyline?.encodedPolyline;
    if (!route || typeof route.distanceMeters !== 'number' || !encoded) return null;
    const geometry = decodePolyline(encoded);
    if (geometry.length < 2) return null;
    return { distanceKm: route.distanceMeters / 1000, geometry };
  } catch (err) {
    console.error('maps-proxy: compute route failed', err instanceof Error ? err.message : err);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Not authenticated' }, 401);

    const apiKey = Deno.env.get('GOOGLE_MAPS_SERVER_API_KEY');
    if (!apiKey) {
      // Server misconfigured, not the caller's fault — still a quiet
      // fallback, not a 500, so the app degrades instead of erroring.
      console.error('maps-proxy: GOOGLE_MAPS_SERVER_API_KEY is not configured');
      return json({ fallback: true });
    }

    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const action = typeof body.action === 'string' ? body.action : null;

    const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    if (action === 'search') {
      const query = typeof body.query === 'string' ? body.query.trim() : '';
      if (query.length < 2) return json({ results: [] });

      const { data: allowed, error: rpcError } = await serviceClient.rpc('increment_maps_proxy_usage', {
        p_user_id: userData.user.id,
        p_kind: 'places',
        p_limit: SEARCH_LIMIT_PER_HOUR,
      });
      if (rpcError || !allowed) return json({ fallback: true });

      const results = await searchPlaces(apiKey, query);
      if (results === null) return json({ fallback: true });
      return json({ results });
    }

    if (action === 'route') {
      const pickup = body.pickup as { latitude?: number; longitude?: number } | undefined;
      const dropoff = body.dropoff as { latitude?: number; longitude?: number } | undefined;
      if (
        typeof pickup?.latitude !== 'number' ||
        typeof pickup?.longitude !== 'number' ||
        typeof dropoff?.latitude !== 'number' ||
        typeof dropoff?.longitude !== 'number'
      ) {
        return json({ error: 'pickup and dropoff {latitude, longitude} are required' }, 400);
      }

      const { data: allowed, error: rpcError } = await serviceClient.rpc('increment_maps_proxy_usage', {
        p_user_id: userData.user.id,
        p_kind: 'routes',
        p_limit: ROUTE_LIMIT_PER_HOUR,
      });
      if (rpcError || !allowed) return json({ fallback: true });

      const route = await computeRoute(apiKey, pickup as { latitude: number; longitude: number }, dropoff as { latitude: number; longitude: number });
      if (route === null) return json({ fallback: true });
      return json(route);
    }

    return json({ error: "action must be 'search' or 'route'" }, 400);
  } catch (err) {
    console.error('maps-proxy: unexpected error', err instanceof Error ? err.message : err);
    return json({ fallback: true });
  }
});

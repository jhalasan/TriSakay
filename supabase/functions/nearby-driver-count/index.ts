import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EARTH_RADIUS_KM = 6371;

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
    const { lat, lng } = await req.json();
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return json({ error: 'lat/lng required' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: settings } = await supabase
      .from('system_settings')
      .select('search_radius_km')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    const radiusKm = settings?.search_radius_km ?? 3;

    const { data: drivers, error } = await supabase
      .from('driver_profiles')
      .select('current_lat, current_lng')
      .eq('is_available', true)
      .not('current_lat', 'is', null)
      .not('current_lng', 'is', null);

    if (error) return json({ error: error.message }, 500);

    const count = (drivers ?? []).filter(
      (d) => haversineKm(lat, lng, d.current_lat!, d.current_lng!) <= radiusKm,
    ).length;

    return json({ count });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

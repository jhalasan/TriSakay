import { createClient } from 'jsr:@supabase/supabase-js@2';

const EARTH_RADIUS_KM = 6371;

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

Deno.serve(async (req) => {
  try {
    const { lat, lng } = await req.json();
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return new Response(JSON.stringify({ error: 'lat/lng required' }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: settings } = await supabase
      .from('system_settings')
      .select('search_radius_km')
      .limit(1)
      .maybeSingle();
    const radiusKm = settings?.search_radius_km ?? 3;

    const { data: drivers, error } = await supabase
      .from('driver_profiles')
      .select('current_lat, current_lng')
      .eq('is_available', true)
      .not('current_lat', 'is', null)
      .not('current_lng', 'is', null);

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

    const count = (drivers ?? []).filter(
      (d) => haversineKm(lat, lng, d.current_lat!, d.current_lng!) <= radiusKm,
    ).length;

    return new Response(JSON.stringify({ count }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});

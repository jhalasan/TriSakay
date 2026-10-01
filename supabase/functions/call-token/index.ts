// Issues a short-lived Agora RTC token for one call. verify_jwt is ON: the caller is a signed-in user. The call and
// the ride are re-read here with the service role and re-checked on EVERY request (authorize.ts), so a token can
// never be had for a finished call, a stranger's call, or a ride that is no longer active. The channel is named
// after the call (not the ride) and the uid is random, so an old token can never join a later call and no
// identity (name, phone) ever reaches the audio service.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { RtcRole, RtcTokenBuilder } from 'npm:agora-token@2';
import { authorizeCallToken, randomUid } from './authorize.ts';

const APP_ID = Deno.env.get('AGORA_APP_ID') ?? '';
const APP_CERTIFICATE = Deno.env.get('AGORA_APP_CERTIFICATE') ?? '';
const TOKEN_SECONDS = 3600;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Not authenticated' }, 401);

    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const callId = typeof body.callId === 'string' && UUID.test(body.callId) ? body.callId : null;
    if (!callId) return json({ error: 'callId is required' }, 400);

    if (!APP_ID || !APP_CERTIFICATE) {
      console.error('call-token: AGORA_APP_ID / AGORA_APP_CERTIFICATE are not configured');
      return json({ error: 'Calling is not set up yet' }, 503);
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: call, error: callError } = await supabase
      .from('ride_calls')
      .select('status, caller_id, callee_id, ride_request_id')
      .eq('id', callId)
      .maybeSingle();
    if (callError) return json({ error: callError.message }, 500);

    let ride: { status: string; passenger_id: string; driver_id: string | null } | null = null;
    if (call) {
      const { data: rideRow, error: rideError } = await supabase
        .from('ride_requests')
        .select('status, passenger_id, trip_id')
        .eq('id', call.ride_request_id)
        .maybeSingle();
      if (rideError) return json({ error: rideError.message }, 500);
      if (rideRow) {
        let driverId: string | null = null;
        if (rideRow.trip_id) {
          const { data: trip } = await supabase.from('trips').select('driver_id').eq('id', rideRow.trip_id).maybeSingle();
          driverId = trip?.driver_id ?? null;
        }
        ride = { status: rideRow.status, passenger_id: rideRow.passenger_id, driver_id: driverId };
      }
    }

    const decision = authorizeCallToken(userData.user.id, call, ride);
    if (!decision.ok) return json({ error: decision.error }, decision.status);

    const uid = randomUid();
    const channel = `call_${callId}`;
    const token = RtcTokenBuilder.buildTokenWithUid(APP_ID, APP_CERTIFICATE, channel, uid, RtcRole.PUBLISHER, TOKEN_SECONDS, TOKEN_SECONDS);

    return json({ appId: APP_ID, channel, uid, token });
  } catch (err) {
    console.error('call-token: unexpected error', err instanceof Error ? err.message : err);
    return json({ error: 'Internal error' }, 500);
  }
});

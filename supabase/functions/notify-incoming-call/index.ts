// Rings the other phone for a new call. Fired by trg_notify_incoming_call (AFTER INSERT on ride_calls, status
// 'ringing') through pg_net — same shared-secret auth as notify-new-message (no end-user session exists at
// trigger time). verify_jwt is deliberately false at deploy time; the header check below is the actual gate.
// Nothing from the request body is trusted beyond the call id: the call, the ride, and the callee's push token are
// re-read with the service role. The push carries only the caller's role, never a name or number.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { incomingCallTitle, isFreshRing } from './message.ts';

const SHARED_SECRET = Deno.env.get('NOTIFY_SHARED_SECRET') ?? '';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  try {
    if (!SHARED_SECRET) {
      console.error('notify-incoming-call: NOTIFY_SHARED_SECRET is not configured');
      return json({ error: 'Server misconfigured' }, 500);
    }
    const provided = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!timingSafeEqual(provided, SHARED_SECRET)) return json({ error: 'Unauthorized' }, 401);

    const payload = await req.json().catch(() => ({}) as Record<string, unknown>);
    const callId = typeof payload.callId === 'string' ? payload.callId : undefined;
    if (!callId) return json({ error: 'callId required' }, 400);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: call, error: callError } = await supabase
      .from('ride_calls')
      .select('id, status, callee_id, ride_request_id, created_at')
      .eq('id', callId)
      .maybeSingle();
    if (callError) return json({ error: callError.message }, 500);
    if (!call) return json({ sent: 0, skipped: 'call not found' });
    if (call.status !== 'ringing') return json({ sent: 0, skipped: 'no longer ringing' });
    if (!isFreshRing(call.created_at, Date.now())) return json({ sent: 0, skipped: 'stale' });

    const { data: ride, error: rideError } = await supabase
      .from('ride_requests')
      .select('passenger_id')
      .eq('id', call.ride_request_id)
      .maybeSingle();
    if (rideError) return json({ error: rideError.message }, 500);
    if (!ride) return json({ sent: 0, skipped: 'ride not found' });

    const { data: callee, error: calleeError } = await supabase
      .from('users')
      .select('push_token')
      .eq('id', call.callee_id)
      .maybeSingle();
    if (calleeError) return json({ error: calleeError.message }, 500);
    const token = callee?.push_token;
    if (!token) return json({ sent: 0, skipped: 'no push token' });

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify([
        {
          to: token,
          sound: 'default',
          title: incomingCallTitle(ride.passenger_id === call.callee_id),
          body: '',
          priority: 'high',
          ttl: 30,
          channelId: 'calls',
          data: { type: 'incoming_call', callId: call.id, rideRequestId: call.ride_request_id },
        },
      ]),
    }).catch((err) => {
      console.error('notify-incoming-call: Expo push send failed', err instanceof Error ? err.message : err);
      return null;
    });

    return json({ sent: res?.ok ? 1 : 0 });
  } catch (err) {
    console.error('notify-incoming-call: unexpected error', err instanceof Error ? err.message : err);
    return json({ error: 'Internal error' }, 500);
  }
});

// C1: server-side push delivery for a new chat message, for whichever party
// didn't send it. Fired by trg_notify_new_message (AFTER INSERT on
// ride_messages) via pg_net — same shared-secret auth model as
// notify-drivers-new-request (no end-user session exists at trigger time),
// and the same discipline of never trusting body-supplied data beyond the
// message id: the row, the ride, and the receiver's push token are all
// re-fetched here with the service-role client.
//
// The push body never includes the message content (matches the original
// spec: "New message from your driver/passenger", nothing else) — someone
// glancing at a lock screen shouldn't see the other party's message text.

import { createClient } from 'npm:@supabase/supabase-js@2';

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
      console.error('notify-new-message: NOTIFY_SHARED_SECRET is not configured');
      return json({ error: 'Server misconfigured' }, 500);
    }
    const authHeader = req.headers.get('Authorization') ?? '';
    const provided = authHeader.replace(/^Bearer\s+/i, '');
    if (!timingSafeEqual(provided, SHARED_SECRET)) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const payload = await req.json().catch(() => ({}) as Record<string, unknown>);
    const messageId = typeof payload.messageId === 'string' ? payload.messageId : undefined;
    if (!messageId) return json({ error: 'messageId required' }, 400);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: message, error: messageError } = await supabase
      .from('ride_messages')
      .select('id, ride_request_id, sender_id, kind')
      .eq('id', messageId)
      .maybeSingle();

    if (messageError) return json({ error: messageError.message }, 500);
    if (!message) return json({ sent: 0, skipped: 'message not found' });

    // 'system' messages (e.g. a future "transferred to a new driver" notice)
    // aren't authored by either party, so there's no "the other side" to
    // notify the same way.
    if (message.kind === 'system') return json({ sent: 0, skipped: 'system message' });

    const { data: rideRequest, error: rideError } = await supabase
      .from('ride_requests')
      .select('id, passenger_id, trip_id')
      .eq('id', message.ride_request_id)
      .maybeSingle();

    if (rideError) return json({ error: rideError.message }, 500);
    if (!rideRequest) return json({ sent: 0, skipped: 'ride not found' });

    let driverId: string | null = null;
    if (rideRequest.trip_id) {
      const { data: trip } = await supabase.from('trips').select('driver_id').eq('id', rideRequest.trip_id).maybeSingle();
      driverId = trip?.driver_id ?? null;
    }

    const senderIsPassenger = message.sender_id === rideRequest.passenger_id;
    const receiverId = senderIsPassenger ? driverId : rideRequest.passenger_id;
    if (!receiverId) return json({ sent: 0, skipped: 'no receiver (not assigned)' });

    const { data: receiver, error: receiverError } = await supabase
      .from('users')
      .select('push_token')
      .eq('id', receiverId)
      .maybeSingle();

    if (receiverError) return json({ error: receiverError.message }, 500);
    const token = receiver?.push_token;
    if (!token) return json({ sent: 0, skipped: 'no push token' });

    // The receiver is whichever side DIDN'T send it, so the title names the
    // sender's role from the receiver's point of view.
    const title = senderIsPassenger ? 'New message from your passenger' : 'New message from your driver';

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify([
        {
          to: token,
          sound: 'default',
          title,
          body: '',
          channelId: 'messages',
          data: { type: 'chat_message', rideRequestId: rideRequest.id },
        },
      ]),
    }).catch((err) => {
      console.error('notify-new-message: Expo push send failed', err instanceof Error ? err.message : err);
      return null;
    });

    return json({ sent: res?.ok ? 1 : 0 });
  } catch (err) {
    console.error('notify-new-message: unexpected error', err instanceof Error ? err.message : err);
    return json({ error: 'Internal error' }, 500);
  }
});

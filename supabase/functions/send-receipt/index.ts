// Emails a passenger their trip receipt through Resend. Two callers:
//   1. trg_send_receipt (ride completes, passenger agreed) — authenticated with the shared Vault secret, kind 'auto'.
//   2. A signed-in passenger tapping "Email me this receipt" — their own JWT, kind 'manual'.
// verify_jwt is deliberately false at deploy time: the trigger is pg_net, not a Supabase session, so this
// function does its own authentication for both paths.
//
// The receipt is always built from the server's own ride record (get_receipt_for_email, service role only) and
// goes only to the account's own email — nothing about the recipient or the content comes from the request.
// Every attempt is logged in receipt_emails; that table also enforces one automatic receipt per ride (unique
// index) and backs the manual limits (3 per ride, 20 per day).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildReceiptEmail, checkSendAllowed, type ReceiptData } from './receipt.ts';

const SHARED_SECRET = Deno.env.get('NOTIFY_SHARED_SECRET') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_ADDRESS = Deno.env.get('RECEIPT_FROM') ?? 'TriSakay <receipts@trisakaygsc.org>';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const rideRequestId = typeof body.rideRequestId === 'string' && UUID.test(body.rideRequestId) ? body.rideRequestId : null;
    if (!rideRequestId) return json({ error: 'rideRequestId is required' }, 400);

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Missing Authorization header' }, 401);

    let kind: 'auto' | 'manual';
    let callerId: string | null = null;

    if (SHARED_SECRET && timingSafeEqual(token, SHARED_SECRET)) {
      kind = 'auto';
    } else {
      const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userError } = await userClient.auth.getUser();
      if (userError || !userData.user) return json({ error: 'Not authenticated' }, 401);
      kind = 'manual';
      callerId = userData.user.id;
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: rows, error: rideError } = await supabase.rpc('get_receipt_for_email', { p_ride_request_id: rideRequestId });
    if (rideError) return json({ error: rideError.message }, 500);
    const ride = rows?.[0];
    if (!ride) return json({ error: 'Ride not found or not completed' }, 404);

    if (kind === 'manual' && ride.passenger_id !== callerId) {
      return json({ error: 'This ride does not belong to you' }, 403);
    }
    if (kind === 'auto' && !ride.email_receipts) return json({ sent: false, skipped: 'no consent' });
    if (!ride.passenger_email) return json({ error: 'This account has no email address' }, 422);

    if (!RESEND_API_KEY) {
      console.error('send-receipt: RESEND_API_KEY is not configured');
      return json({ error: 'Email is not set up yet' }, 503);
    }

    if (kind === 'manual') {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [perRide, perDay] = await Promise.all([
        supabase.from('receipt_emails').select('id', { count: 'exact', head: true }).eq('ride_request_id', rideRequestId),
        supabase.from('receipt_emails').select('id', { count: 'exact', head: true }).eq('user_id', ride.passenger_id).gte('created_at', dayAgo),
      ]);
      if (perRide.error || perDay.error) return json({ error: 'Could not check send limits' }, 500);
      const decision = checkSendAllowed('manual', { perRide: perRide.count ?? 0, perDay: perDay.count ?? 0 });
      if (decision === 'ride_limit') return json({ error: 'This receipt has already been emailed the maximum number of times' }, 429);
      if (decision === 'day_limit') return json({ error: 'Daily receipt email limit reached. Please try again tomorrow' }, 429);
    }

    const { data: logRow, error: logError } = await supabase
      .from('receipt_emails')
      .insert({ ride_request_id: rideRequestId, user_id: ride.passenger_id, kind })
      .select('id')
      .single();

    if (logError) {
      // 23505 = the unique "one automatic receipt per ride" index: already sent, nothing more to do.
      if (logError.code === '23505') return json({ sent: false, skipped: 'already sent' });
      return json({ error: logError.message }, 500);
    }

    const data: ReceiptData = {
      rideRequestId,
      passengerFirstName: ride.passenger_first_name,
      driverFirstName: ride.driver_first_name,
      plateNo: ride.plate_no,
      pickupLabel: ride.pickup_label,
      destLabel: ride.dest_label,
      fare: Number(ride.fare ?? 0),
      seats: ride.seats,
      paymentMethod: ride.payment_method,
      paymentStatus: ride.payment_status,
      completedAt: ride.completed_at,
      distanceKm: ride.distance_km === null ? null : Number(ride.distance_km),
      durationMinutes: ride.duration_minutes === null ? null : Number(ride.duration_minutes),
      discountApplied: ride.discount_applied ?? false,
      discountPercent: ride.discount_percent === null ? null : Number(ride.discount_percent),
    };
    const { subject, html, text } = buildReceiptEmail(data);

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `receipt-${logRow.id}`,
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to: [ride.passenger_email], subject, html, text }),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      console.error('send-receipt: Resend rejected the email', response.status, detail);
      await supabase.from('receipt_emails').update({ status: 'failed', error: `Resend ${response.status}: ${detail}` }).eq('id', logRow.id);
      return json({ error: 'The email could not be sent. Please try again later' }, 502);
    }

    await supabase.from('receipt_emails').update({ status: 'sent' }).eq('id', logRow.id);
    return json({ sent: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
  }
});

// FR-9.2: on ride completion, if GCash was selected, create a PayMongo
// Checkout Session (test mode) for the locked final_fare. Returns the
// hosted checkout_url for the passenger app to open in an in-app browser.
//
// Idempotent by ride_request_id: a pending transactions row with an
// unexpired stored checkout_url is reused rather than creating a duplicate
// PayMongo session on retry (e.g. the passenger backgrounds the app and taps
// "Pay now" again).
//
// GCash transactions are written ONLY by this function and by
// paymongo-webhook, both via the service-role client — there is no
// client-facing insert/update policy for GCash rows (docs/SCHEMA.MD §7.6).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { fareForRide, isSessionPaid } from './paid.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAYMONGO_API_BASE = 'https://api.paymongo.com/v1';
// Static pages served from the admin site's public folder (apps/admin/public). They must be
// .html: the site rewrites every other path to the admin app. Shown in the in-app browser
// after paying or cancelling; the app itself confirms the payment, not this page.
const CHECKOUT_SUCCESS_URL = 'https://trisakaygsc.vercel.app/payment-complete.html';
const CHECKOUT_CANCEL_URL = 'https://trisakaygsc.vercel.app/payment-cancelled.html';

interface PaymongoCheckoutSession {
  id: string;
  attributes: {
    checkout_url: string;
    [key: string]: unknown;
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isSessionExpired(paymongoPayload: Record<string, unknown> | null): boolean {
  if (!paymongoPayload) return true;
  const expiresAt = paymongoPayload.expires_at;
  if (typeof expiresAt !== 'number') return true;
  return Date.now() / 1000 >= expiresAt;
}

async function createPaymongoCheckoutSession(
  secretKey: string,
  amount: number,
  referenceNumber: string,
  rideRequestId: string,
): Promise<{ session: PaymongoCheckoutSession | null; errorMessage: string | null }> {
  const response = await fetch(`${PAYMONGO_API_BASE}/checkout_sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${secretKey}:`)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: [
            {
              name: 'TriSakay ride fare',
              amount: Math.round(amount * 100),
              currency: 'PHP',
              quantity: 1,
            },
          ],
          payment_method_types: ['gcash'],
          success_url: CHECKOUT_SUCCESS_URL,
          cancel_url: CHECKOUT_CANCEL_URL,
          description: `TriSakay ride ${rideRequestId}`,
          reference_number: referenceNumber,
          metadata: { ride_request_id: rideRequestId },
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    return { session: null, errorMessage: `PayMongo error (${response.status}): ${body}` };
  }

  const payload = await response.json();
  return { session: payload.data as PaymongoCheckoutSession, errorMessage: null };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ checkoutUrl: null, error: 'Missing Authorization header' }, 401);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return json({ checkoutUrl: null, error: 'Not authenticated' }, 401);

    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const rideRequestId = typeof body.rideRequestId === 'string' ? body.rideRequestId : null;
    if (!rideRequestId) return json({ checkoutUrl: null, error: 'rideRequestId is required' }, 400);

    const { data: rideRequest, error: rideError } = await supabase
      .from('ride_requests')
      .select('id, passenger_id, status, final_fare, estimated_fare, payment_requested_at, preferred_method')
      .eq('id', rideRequestId)
      .maybeSingle();

    if (rideError) return json({ checkoutUrl: null, error: rideError.message }, 500);
    if (!rideRequest) return json({ checkoutUrl: null, error: 'Ride request not found' }, 404);
    if (rideRequest.passenger_id !== userData.user.id) {
      return json({ checkoutUrl: null, error: 'rideRequestId must belong to the authenticated passenger' }, 403);
    }
    // service-role client: no client-facing write policy exists for
    // transactions on the GCash path (docs/SCHEMA.MD §7.6).
    const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // 'verify': ask PayMongo directly whether this ride's checkout session was
    // paid, and mark the transaction paid if so. A second path next to the
    // webhook, so a slow or missed webhook can't leave a paid ride looking
    // unpaid. The client never marks anything paid — only this server code,
    // from PayMongo's own answer, with the same exact-amount rule.
    if (body.action === 'verify') {
      const { data: txn, error: txnError } = await serviceClient
        .from('transactions')
        .select('id, status, method, amount, paymongo_session_id')
        .eq('ride_request_id', rideRequestId)
        .maybeSingle();

      if (txnError) return json({ status: null, error: txnError.message }, 500);
      if (!txn) return json({ status: 'pending' });
      if (txn.status === 'paid') return json({ status: 'paid' });
      if (txn.method !== 'gcash' || !txn.paymongo_session_id) return json({ status: 'pending' });

      const sessionResponse = await fetch(`${PAYMONGO_API_BASE}/checkout_sessions/${txn.paymongo_session_id}`, {
        headers: { Authorization: `Basic ${btoa(`${Deno.env.get('PAYMONGO_SECRET_KEY')!}:`)}` },
      });
      if (!sessionResponse.ok) return json({ status: 'pending' });

      const sessionPayload = await sessionResponse.json();
      const paidState = isSessionPaid(sessionPayload, Math.round(Number(txn.amount) * 100));
      if (paidState === 'mismatch') {
        console.error('create-gcash-checkout verify: paid amount does not match transaction amount', { rideRequestId });
        return json({ status: 'pending' });
      }
      if (paidState !== 'paid') return json({ status: 'pending' });

      const { error: markError } = await serviceClient
        .from('transactions')
        .update({ status: 'paid', paymongo_payload: sessionPayload })
        .eq('id', txn.id)
        .eq('status', 'pending')
        .eq('method', 'gcash');
      if (markError) return json({ status: null, error: markError.message }, 500);
      return json({ status: 'paid' });
    }

    if (rideRequest.preferred_method !== 'gcash') {
      return json({ checkoutUrl: null, error: 'This ride is paying by cash' }, 400);
    }

    // A completed ride charges its locked final fare; an ongoing ride charges
    // the estimated fare, but only once the driver has requested payment.
    const fare = fareForRide(rideRequest);
    if (fare === null) {
      return json({ checkoutUrl: null, error: "Payment hasn't been requested for this ride yet" }, 400);
    }

    const { data: existing, error: existingError } = await serviceClient
      .from('transactions')
      .select('id, status, paymongo_payload')
      .eq('ride_request_id', rideRequestId)
      .maybeSingle();

    if (existingError) return json({ checkoutUrl: null, error: existingError.message }, 500);

    if (existing?.status === 'paid') {
      return json({ checkoutUrl: null, error: 'Already paid' }, 400);
    }

    let transactionId: string;

    if (existing) {
      transactionId = existing.id;
      const payload = existing.paymongo_payload as Record<string, unknown> | null;
      if (!isSessionExpired(payload)) {
        return json({ checkoutUrl: (payload!.checkout_url as string) ?? null, error: null });
      }
    } else {
      const { data: inserted, error: insertError } = await serviceClient
        .from('transactions')
        .insert({
          ride_request_id: rideRequestId,
          amount: fare,
          method: 'gcash',
          status: 'pending',
        })
        .select('id')
        .single();

      if (insertError) return json({ checkoutUrl: null, error: insertError.message }, 500);
      transactionId = inserted.id;
    }

    const { session, errorMessage } = await createPaymongoCheckoutSession(
      Deno.env.get('PAYMONGO_SECRET_KEY')!,
      fare,
      transactionId,
      rideRequestId,
    );

    if (errorMessage || !session) return json({ checkoutUrl: null, error: errorMessage ?? 'PayMongo session creation failed' }, 502);

    // Guard against a race where the webhook already marked this row 'paid'
    // while this invocation was still mid-flight (it read the row before the
    // webhook landed). Never clobber a paid row back to 'pending' — but still
    // allow resetting a 'failed' row, which is the intentional reuse path above.
    const { error: updateError } = await serviceClient
      .from('transactions')
      .update({
        status: 'pending',
        paymongo_session_id: session.id,
        paymongo_payload: {
          checkout_url: session.attributes.checkout_url,
          session,
          expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        },
      })
      .eq('id', transactionId)
      .neq('status', 'paid');

    if (updateError) return json({ checkoutUrl: null, error: updateError.message }, 500);

    return json({ checkoutUrl: session.attributes.checkout_url, error: null });
  } catch (err) {
    return json({ checkoutUrl: null, error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
  }
});

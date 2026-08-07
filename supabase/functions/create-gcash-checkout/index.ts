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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAYMONGO_API_BASE = 'https://api.paymongo.com/v1';
const CHECKOUT_SUCCESS_URL = 'https://trisakay.app/payment-complete';
const CHECKOUT_CANCEL_URL = 'https://trisakay.app/payment-cancelled';

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
      .select('id, passenger_id, status, final_fare')
      .eq('id', rideRequestId)
      .maybeSingle();

    if (rideError) return json({ checkoutUrl: null, error: rideError.message }, 500);
    if (!rideRequest) return json({ checkoutUrl: null, error: 'Ride request not found' }, 404);
    if (rideRequest.passenger_id !== userData.user.id) {
      return json({ checkoutUrl: null, error: 'rideRequestId must belong to the authenticated passenger' }, 403);
    }
    if (rideRequest.status !== 'completed') {
      return json({ checkoutUrl: null, error: "Ride isn't completed yet" }, 400);
    }
    if (rideRequest.final_fare == null) {
      return json({ checkoutUrl: null, error: 'Ride has no locked fare yet' }, 500);
    }

    // service-role client: no client-facing write policy exists for
    // transactions on the GCash path (docs/SCHEMA.MD §7.6).
    const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

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
          amount: rideRequest.final_fare,
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
      rideRequest.final_fare,
      transactionId,
      rideRequestId,
    );

    if (errorMessage || !session) return json({ checkoutUrl: null, error: errorMessage ?? 'PayMongo session creation failed' }, 502);

    const { error: updateError } = await serviceClient
      .from('transactions')
      .update({
        paymongo_session_id: session.id,
        paymongo_payload: {
          checkout_url: session.attributes.checkout_url,
          session,
          expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        },
      })
      .eq('id', transactionId);

    if (updateError) return json({ checkoutUrl: null, error: updateError.message }, 500);

    return json({ checkoutUrl: session.attributes.checkout_url, error: null });
  } catch (err) {
    return json({ checkoutUrl: null, error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
  }
});

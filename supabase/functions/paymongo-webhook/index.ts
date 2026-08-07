// FR-9.2: server-side, signature-verified confirmation that a PayMongo
// Checkout Session was paid. This is the ONLY place transactions.status is
// ever set to 'paid' for the GCash path — payment status is never trusted
// from the client.
//
// Signature verification note: PayMongo's own docs were inconsistent across
// pages on the exact `Paymongo-Signature` header format (a plain HMAC-SHA256
// hex digest of the raw body vs. a Stripe-style `t=...,te=...,li=...`
// structure). This handles both. BEFORE trusting this in the real flow, send
// a test event from the PayMongo dashboard (Developers -> Webhooks -> your
// endpoint -> "Send test webhook") and confirm which branch actually
// matches — see docs/superpowers/specs/2026-08-07-paymongo-webhook-design.md.

import { createClient } from 'npm:@supabase/supabase-js@2';

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifySignature(rawBody: string, header: string, secret: string): Promise<boolean> {
  if (header.includes('=') && header.includes(',')) {
    const parts = Object.fromEntries(
      header.split(',').map((pair) => {
        const [key, value] = pair.split('=');
        return [key, value];
      }),
    );
    const timestamp = parts.t;
    const candidate = parts.te ?? parts.li;
    if (!timestamp || !candidate) return false;
    const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
    return timingSafeEqual(expected, candidate);
  }

  const expected = await hmacSha256Hex(secret, rawBody);
  return timingSafeEqual(expected, header);
}

Deno.serve(async (req: Request) => {
  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get('Paymongo-Signature');

    if (!signatureHeader) {
      console.warn('paymongo-webhook: missing Paymongo-Signature header');
      return new Response('Missing signature', { status: 401 });
    }

    const secret = Deno.env.get('PAYMONGO_WEBHOOK_SECRET')!;
    const valid = await verifySignature(rawBody, signatureHeader, secret);

    if (!valid) {
      console.warn('paymongo-webhook: signature verification failed', { signatureHeader });
      return new Response('Invalid signature', { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event?.data?.attributes?.type;
    const sessionAttributes = event?.data?.attributes?.data?.attributes;
    const referenceNumber = sessionAttributes?.reference_number;

    if (!referenceNumber) {
      console.warn('paymongo-webhook: no reference_number in payload', { eventType });
      return new Response('ok', { status: 200 });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    if (eventType === 'checkout_session.payment.paid') {
      const { data, error } = await supabase
        .from('transactions')
        .update({ status: 'paid', paymongo_payload: event })
        .eq('id', referenceNumber)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('paymongo-webhook: failed to mark transaction paid', error.message);
        return new Response('Internal error', { status: 500 });
      }
      if (!data) {
        console.log('paymongo-webhook: no pending transaction matched (already paid or unknown)', { referenceNumber });
      }
      return new Response('ok', { status: 200 });
    }

    if (eventType === 'payment.failed') {
      const { error } = await supabase
        .from('transactions')
        .update({ status: 'failed', paymongo_payload: event })
        .eq('id', referenceNumber)
        .eq('status', 'pending');

      if (error) {
        console.error('paymongo-webhook: failed to mark transaction failed', error.message);
        return new Response('Internal error', { status: 500 });
      }
      return new Response('ok', { status: 200 });
    }

    console.log('paymongo-webhook: ignoring unhandled event type', { eventType });
    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('paymongo-webhook: unexpected error', err instanceof Error ? err.message : err);
    return new Response('Internal error', { status: 500 });
  }
});

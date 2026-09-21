// UAT D13 follow-up (2026-09-21): proactive push notification before a
// driver's document expires — the "tell me before it does" half of D13
// left undone in the earlier passive expiry-tracking pass (which only
// added the expiry_date column and a status badge on My Documents).
//
// Unlike notify-drivers-new-request, there is no row-insert event to hang
// this off — "30 days before expiry_date" is a moving target relative to
// today, not a state change. So this is invoked daily by pg_cron via
// pg_net (see supabase/migrations/20260921000007_add_document_expiry_notifications.sql)
// rather than by a trigger. Same shared-secret auth model as that other
// function for the same reason: no end-user session exists at cron time.
// verify_jwt is deliberately false at deploy time (same as
// notify-drivers-new-request) — the caller is pg_net, not a Supabase
// session, so this header check is the actual gate.
//
// Idempotency: driver_documents.expiry_notified_at is set once a push has
// gone out for the row's CURRENT expiry_date, so re-running this daily
// only ever notifies once per expiry date. updateDriverDocumentExpiry()
// (packages/services/src/driver-documents/index.ts) resets it to null
// whenever the driver edits the date, so a renewed document becomes
// eligible again on its next expiry.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SHARED_SECRET = '59a4b603ca44e480a724b4646a33f6da7094f1803cc2825685f09762a3aa47ae';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const DOC_LABELS: Record<string, string> = {
  drivers_license: "Driver's License",
  or_cr: 'OR/CR',
  franchise_permit: 'Franchise Permit',
  tricycle_photo: 'Tricycle Photo',
};

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
    const authHeader = req.headers.get('Authorization') ?? '';
    const provided = authHeader.replace(/^Bearer\s+/i, '');
    if (!timingSafeEqual(provided, SHARED_SECRET)) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: docs, error: docsError } = await supabase
      .from('driver_documents')
      .select('id, driver_id, doc_type, expiry_date')
      .not('expiry_date', 'is', null)
      .is('expiry_notified_at', null)
      .lte('expiry_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));

    if (docsError) return json({ error: docsError.message }, 500);
    if (!docs || docs.length === 0) return json({ sent: 0 });

    const driverIds = [...new Set(docs.map((d) => d.driver_id as string))];
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, push_token')
      .in('id', driverIds)
      .not('push_token', 'is', null);

    if (usersError) return json({ error: usersError.message }, 500);

    const tokenByDriverId = new Map((users ?? []).map((u) => [u.id as string, u.push_token as string]));

    const messages: { to: string; sound: string; title: string; body: string; data: Record<string, unknown> }[] = [];
    const notifiedDocIds: string[] = [];

    for (const doc of docs) {
      const token = tokenByDriverId.get(doc.driver_id as string);
      if (!token) continue;

      const label = DOC_LABELS[doc.doc_type as string] ?? (doc.doc_type as string);
      messages.push({
        to: token,
        sound: 'default',
        title: 'Document expiring soon',
        body: `Your ${label} expires on ${doc.expiry_date}. Update it in My Documents to avoid a lapse.`,
        data: { type: 'document_expiring', documentId: doc.id },
      });
      notifiedDocIds.push(doc.id as string);
    }

    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);
      await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch),
      }).catch((err) => {
        console.error('notify-expiring-documents: Expo push send failed', err instanceof Error ? err.message : err);
      });
    }

    // Mark every eligible doc as notified, even ones skipped for lacking a
    // push token — otherwise a token-less driver's rows would be re-queried
    // (harmlessly, but wastefully) every single day until they register one.
    if (docs.length > 0) {
      await supabase
        .from('driver_documents')
        .update({ expiry_notified_at: new Date().toISOString() })
        .in(
          'id',
          docs.map((d) => d.id as string),
        );
    }

    return json({ sent: messages.length, evaluated: docs.length });
  } catch (err) {
    console.error('notify-expiring-documents: unexpected error', err instanceof Error ? err.message : err);
    return json({ error: 'Internal error' }, 500);
  }
});

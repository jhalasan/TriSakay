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

// 2026-09-24: was a literal string committed in source (and this repo is
// public) — rotated to an Edge Function secret. See the matching comment in
// notify-drivers-new-request/index.ts and
// supabase/migrations/20260924000001_rotate_notify_shared_secret.sql.
const SHARED_SECRET = Deno.env.get('NOTIFY_SHARED_SECRET') ?? '';

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
    // Fail closed, not open: an empty SHARED_SECRET (env var not set) must
    // never match an empty Authorization header.
    if (!SHARED_SECRET) {
      console.error('notify-expiring-documents: NOTIFY_SHARED_SECRET is not configured');
      return json({ error: 'Server misconfigured' }, 500);
    }
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

    type PendingMessage = { to: string; sound: string; title: string; body: string; data: Record<string, unknown> };
    const messages: PendingMessage[] = [];
    // Parallel to `messages` — messageDocIds[i] is the doc that produced
    // messages[i], so a batch's send result can be mapped back to which
    // rows are actually safe to mark notified.
    const messageDocIds: string[] = [];
    // R10 (existing-system audit): docs with no push token at all are still
    // marked notified immediately — there's genuinely nothing to send, and
    // otherwise a token-less driver's rows would be re-queried (harmlessly,
    // but wastefully) every day until they register one.
    const noTokenDocIds: string[] = [];

    for (const doc of docs) {
      const token = tokenByDriverId.get(doc.driver_id as string);
      if (!token) {
        noTokenDocIds.push(doc.id as string);
        continue;
      }

      const label = DOC_LABELS[doc.doc_type as string] ?? (doc.doc_type as string);
      messages.push({
        to: token,
        sound: 'default',
        title: 'Document expiring soon',
        body: `Your ${label} expires on ${doc.expiry_date}. Update it in My Documents to avoid a lapse.`,
        data: { type: 'document_expiring', documentId: doc.id },
      });
      messageDocIds.push(doc.id as string);
    }

    // R10 (existing-system audit): every evaluated doc used to be marked
    // notified unconditionally, even when the actual Expo push call failed
    // (network error, non-2xx) — silently skipping that driver until their
    // NEXT expiry date, since expiry_notified_at is only ever reset when the
    // document itself is edited. Now a doc is only marked notified once its
    // batch's send actually succeeded; a failed batch's docs stay eligible
    // and are retried on tomorrow's run.
    const sentDocIds: string[] = [...noTokenDocIds];
    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);
      const batchDocIds = messageDocIds.slice(i, i + 100);
      const ok = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch),
      })
        .then((res) => res.ok)
        .catch((err) => {
          console.error('notify-expiring-documents: Expo push send failed', err instanceof Error ? err.message : err);
          return false;
        });
      if (ok) sentDocIds.push(...batchDocIds);
    }

    if (sentDocIds.length > 0) {
      await supabase.from('driver_documents').update({ expiry_notified_at: new Date().toISOString() }).in('id', sentDocIds);
    }

    return json({ sent: messages.length, evaluated: docs.length, markedNotified: sentDocIds.length });
  } catch (err) {
    console.error('notify-expiring-documents: unexpected error', err instanceof Error ? err.message : err);
    return json({ error: 'Internal error' }, 500);
  }
});

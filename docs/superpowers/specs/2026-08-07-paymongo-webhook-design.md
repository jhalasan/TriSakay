# PayMongo GCash checkout + webhook (design)

**Date:** 2026-08-07
**Scope:** `supabase/functions/create-gcash-checkout` (new), `supabase/functions/paymongo-webhook`
(new), `packages/services/src/payments` (new), `apps/passenger/app/booking/payment.tsx`

## Problem

`docs/CHECKLIST.MD` P0 lists "Build `paymongo-webhook` Edge Function" as the last
unbuilt P0 item. Per FR-9.2/FR-9.3, GCash collection is a two-part round trip —
create a PayMongo Checkout Session on ride completion, then confirm payment via
a signature-verified webhook — and neither half exists today:
`apps/passenger/app/booking/payment.tsx` is a pure local-state stub
(`wait(800)` then a local history append), no `transactions` row is ever
inserted, and no PayMongo API call exists anywhere in the repo. This spec
covers the full round trip so GCash is demoable end-to-end, not just the
webhook receiver in isolation.

The `transactions` table, its RLS policies, and both check constraints
(`txn_cash_needs_confirmation`, `txn_paymongo_needs_reference`) already exist
live on the Supabase project (`docs/SCHEMA.MD` §2.7/§7.6) — no schema changes
needed.

## Out of scope

- Cash confirmation (FR-9.9) — separate P1 checklist item, own code path,
  untouched here.
- Live Mode activation — PayMongo account stays in Test Mode permanently
  (FR-9.6).
- Refunds — `payment_status` includes `refunded` in the schema but no FR
  requires building a refund flow for this prototype.
- A hosted static redirect page for `success_url`/`cancel_url` — see
  "Checkout UI" below for why this isn't needed.

## Data flow

1. Passenger reaches `payment.tsx` after trip completion
   (`ride_requests.status = 'completed'`, `final_fare` set) with `gcash`
   selected.
2. Passenger taps "Pay now" → app calls `createGcashCheckout(rideRequestId)`,
   which invokes the `create-gcash-checkout` Edge Function.
3. The function authenticates the caller, confirms they're the ride's own
   passenger, upserts a `pending` `transactions` row (or reuses an existing
   unexpired one — see Idempotency), creates a PayMongo Checkout Session
   scoped to the `gcash` payment method, stores the session id +
   full response in `paymongo_payload`, and returns `{ checkoutUrl }`.
4. The app opens `checkoutUrl` with `expo-web-browser`'s `openBrowserAsync`
   (plain in-app browser) and, in parallel, starts a Realtime subscription on
   that `transactions` row.
5. Passenger completes payment on PayMongo's hosted page (GCash test-mode
   flow), sees PayMongo's own success screen, and manually dismisses the
   in-app browser (swipe down / native close button) back to the app.
6. PayMongo calls `paymongo-webhook` server-side (independent of the
   passenger's browser dismissal timing). The function verifies the
   `Paymongo-Signature` header, looks up the transaction by
   `reference_number`, and updates `status: 'paid'` + `paymongo_payload` —
   using the service-role client, per the schema's existing
   "written ONLY by the paymongo-webhook Edge Function" comment.
7. The app's Realtime subscription sees the `paid` update and proceeds to
   `/booking/rate-driver`, same as the existing cash-path ending.
8. If the passenger backs out of the browser without paying, the webhook
   never fires and the row stays `pending`; a 2-minute client-side timeout on
   the Realtime wait surfaces a "Payment didn't go through — retry or pay
   cash" state instead of hanging forever (FR-9.8).

## Checkout UI: why no redirect page

PayMongo's Checkout Session API requires `success_url`/`cancel_url` as real
URLs; there's no confirmed support for custom URL schemes (deep links)
directly in those fields per the fetched docs, and building/hosting a static
bounce page is unnecessary extra infra for this prototype. Since payment
status must never be trusted from the client anyway, these two URLs are
functionally inert placeholders (e.g. `https://trisakay.app/payment-complete`
— doesn't need to resolve to anything meaningful) — the passenger manually
closes the in-app browser, and the Realtime subscription on `transactions` is
the only thing that actually advances the UI.

## `create-gcash-checkout` Edge Function

Modeled on `match-ride-request`'s structure (JWT auth via caller's own
Authorization header, CORS headers, `json()` helper).

Request body: `{ rideRequestId: string }`.

1. Auth: same pattern as `match-ride-request` — reject missing/invalid JWT.
2. `select id, passenger_id, status, final_fare, preferred_method from
   ride_requests where id = rideRequestId .maybeSingle()`.
   - Not found → 404.
   - `passenger_id !== caller` → 403 (courtesy error; RLS is the real
     boundary once a service-role-free client is used for this read — see
     Security below).
   - `status !== 'completed'` → 400 ("Ride isn't completed yet").
   - `final_fare == null` → 500 (shouldn't happen for a completed ride;
     defensive check).
3. `select * from transactions where ride_request_id = rideRequestId
   .maybeSingle()`.
   - Existing row with `status = 'paid'` → 400 ("Already paid").
   - Existing row with `status = 'pending'` and a `paymongo_payload.expires_at`
     still in the future → skip PayMongo API call, return the stored
     `checkout_url` from `paymongo_payload` directly (idempotent retry).
   - Existing `pending` row but expired (or no `paymongo_payload` yet) →
     reuse the row, create a fresh PayMongo session, overwrite
     `paymongo_session_id`/`paymongo_payload`.
   - No row → insert one: `{ ride_request_id, amount: final_fare,
     method: 'gcash', status: 'pending' }`.
4. Call PayMongo's Create Checkout Session API (`POST
   https://api.paymongo.com/v1/checkout_sessions`, v2 body shape) with HTTP
   Basic auth (`PAYMONGO_SECRET_KEY` as username, empty password):
   - `line_items`: one item, `name: 'TriSakay ride fare'`, `amount:
     Math.round(final_fare * 100)` (centavos), `currency: 'PHP'`, `quantity: 1`.
   - `payment_method_types: ['gcash']`.
   - `success_url` / `cancel_url`: the placeholder constants above.
   - `reference_number`: the `transactions.id` (uuid) — the join key the
     webhook uses.
   - `metadata: { ride_request_id: rideRequestId }` — redundant linking, in
     case `reference_number` handling ever needs a second lookup path.
   - `description`: `` `TriSakay ride ${rideRequestId}` ``.
5. On PayMongo API error (non-2xx) → return 502 with the response body's
   error message, leave the `transactions` row `pending` untouched (so a
   retry doesn't need a fresh insert).
6. `update transactions set paymongo_session_id = session.id, paymongo_payload
   = { checkout_url, session, expires_at } where id = transaction.id`.
7. Return `{ checkoutUrl: session.attributes.checkout_url }`.

## `paymongo-webhook` Edge Function

No `Authorization` header expected — this is called by PayMongo, not the app.
Uses the service-role key throughout (bypasses RLS by design, per schema
comment).

1. Read the **raw** request body as text first — signature verification must
   run against the exact bytes PayMongo signed, before any `JSON.parse`.
2. Read the `Paymongo-Signature` header. Missing → 401.
3. Compute `HMAC-SHA256(rawBody, PAYMONGO_WEBHOOK_SECRET)` and compare against
   the header value with a timing-safe comparison
   (`crypto.subtle` / `timingSafeEqual`-equivalent in Deno). Mismatch → 401,
   log a warning (header value + truncated body hash, never the secret).
   - **Caveat carried from design discussion**: PayMongo's own docs were
     inconsistent on the exact header format across two fetched pages (plain
     HMAC hex vs. a Stripe-style `t=...,te=...,li=...` structure). Implement
     to handle both: if the header contains `=` and `,` characters, parse it
     as `key=value` pairs, take `t` as a timestamp prefix, verify
     `HMAC-SHA256(`${t}.${rawBody}`)` against `te` (test mode) falling back to
     `li` (live mode); otherwise treat the whole header as a plain hex HMAC
     digest of the raw body. **Before relying on this in the real flow, send
     a test event from PayMongo's dashboard (Developers → Webhooks → your
     endpoint → "Send test webhook") and confirm which branch actually
     matches** — call this out explicitly in the setup instructions.
4. `JSON.parse` the body. Read `data.attributes.type`.
5. `checkout_session.payment.paid`:
   - Extract `data.attributes.data.attributes.reference_number` (the
     checkout session's own attributes, which is what the event wraps) — this
     is the `transactions.id`.
   - `update transactions set status = 'paid', paymongo_payload = <full
     event body> where id = referenceNumber and status = 'pending'`.
   - No row matched (already paid, or unknown reference) → log and still
     return 200 (idempotent no-op, not an error).
6. `payment.failed` (or a session-expiry signal, if one arrives as a distinct
   event type — confirm during manual testing) → same lookup, `update ...
   set status = 'failed', paymongo_payload = <event body> where id =
   referenceNumber and status = 'pending'`.
7. Any other event type → log and return 200 (we only register the two event
   types we handle, but a defensive no-op costs nothing).
8. Wrap the whole handler in try/catch → 500 with a logged error on anything
   unexpected, so a bug here surfaces as a PayMongo retry rather than a
   silent drop.

## Idempotency summary

- **Checkout creation**: keyed on `ride_request_id` (unique-ish via the
  existing `transactions.ride_request_id` unique constraint) — reuses the
  pending row and its stored checkout URL until expiry instead of creating
  duplicate PayMongo sessions.
- **Webhook processing**: the `UPDATE ... WHERE status = 'pending'` guard
  makes replayed/duplicate deliveries no-ops. `paymongo_session_id`'s unique
  constraint also means a second session can never silently collide with an
  existing one.

## Security

- `create-gcash-checkout` runs with the caller's own JWT for the
  `ride_requests` read (RLS-scoped, same "courtesy error" pattern as
  `match-ride-request`) but needs the **service-role** client for the
  `transactions` insert/update, since there's no passenger-facing RLS insert
  policy on that table (by design — see schema comment). This mirrors how
  `paymongo-webhook` already must use service-role.
- `PAYMONGO_SECRET_KEY` and `PAYMONGO_WEBHOOK_SECRET` are Supabase Edge
  Function secrets, never exposed to either mobile app.
- The webhook never re-derives `amount` from the payload — only `status` and
  the audit-trail `paymongo_payload` are written from webhook data. The
  charged amount was already fixed at checkout-session-creation time from our
  own `final_fare`.

## Client changes

### `packages/services/src/payments/index.ts` (new)

- `createGcashCheckout(rideRequestId: string): Promise<{ checkoutUrl: string | null; error: string | null }>`
  — thin wrapper around `supabase.functions.invoke('create-gcash-checkout', { body: { rideRequestId } })`,
  same error-shape convention as other service functions in this package.
- `subscribeToTransactionStatus(rideRequestId: string, onChange: (status: PaymentStatus) => void, onError?: (msg: string) => void): () => void`
  — Realtime channel on `transactions`, filtered to `ride_request_id=eq.${rideRequestId}`,
  reconciles with a direct `select` once on `SUBSCRIBED` (same pattern as
  `subscribeToRideRequestStatus`), returns an unsubscribe function.

### `apps/passenger/app/booking/payment.tsx`

- GCash path: "Pay now" calls `createGcashCheckout`, opens the returned URL
  with `openBrowserAsync` from `expo-web-browser`, and calls
  `subscribeToTransactionStatus` to drive a new `waiting` UI state (spinner +
  "Waiting for PayMongo confirmation…") until `paid` (→ proceed, same as
  today's success path) or `failed`/2-minute timeout (→ inline retry button +
  "or pay cash instead" affordance, switching `paymentMethod` back to
  `'cash'`).
- Cash path is unchanged by this spec (still the existing stub, tracked
  separately per FR-9.9).

## Testing

- `packages/services/tests/payments.test.ts` (new): `createGcashCheckout`
  request/response shape and error passthrough, and
  `subscribeToTransactionStatus` (refetch-on-event, reconcile-on-SUBSCRIBED,
  error forwarding, unsubscribe calls `removeChannel`) — following the
  `fakeSupabaseClient` pattern used in `booking.test.ts`.
- No unit tests for the two Edge Functions themselves — matching the
  precedent already set by `match-ride-request`, which has none either (no
  existing Deno test harness for `supabase/functions/*` in this repo).
- Manual QA (documented in setup instructions): PayMongo dashboard's "send
  test webhook event" to confirm signature verification; a full seeded loop
  (completed trip → Pay now → PayMongo test-mode GCash test credentials →
  confirm `transactions.status = 'paid'` via Supabase dashboard and the app
  advancing to rate-driver).

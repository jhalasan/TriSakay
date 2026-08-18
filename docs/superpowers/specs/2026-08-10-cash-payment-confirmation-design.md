# Cash payment confirmation — design

**Date:** 2026-08-10
**Scope:** `apps/passenger` only. Corresponds to `docs/PASSENGER_TODO.MD` build-order item 6 ("Payment — cash first").

## Problem

`app/booking/payment.tsx`'s cash path (`handlePayNowCash`) is a fake: `await wait(800)` then straight to `finishSuccessfulPayment()`. It never looks at the real `transactions` row, so a passenger can mark a cash ride "paid" locally without the driver ever having confirmed receipt.

## What already exists (verified against `docs/SCHEMA.MD` and the driver app — nothing here needs to be built)

- `transactions.status` can only become `'paid'` for a cash row if `cash_confirmed_by is not null` (`txn_cash_needs_confirmation` check constraint, §2.7).
- A DB trigger provisions the pending cash `transactions` row automatically the moment a ride is assigned — the passenger app never creates it.
- RLS: `txn_own_read` already lets the passenger (and the assigned driver, and PSO) `select` the row; `txn_driver_confirm_cash` lets only the assigned driver `update` it.
- Driver side is fully wired: `apps/driver/app/trip/active.tsx` shows a "Confirm cash received" toggle for cash trips and disables "Complete trip" until `trip.cashConfirmed` is true. `confirmCashPayment()` in `packages/services/src/payments/index.ts` does the actual update.
- `transactions` is already in the Realtime publication, and `subscribeToTransactionStatus(rideRequestId, onChange, onError)` (same file) already gives a generic subscription to any transaction row's status, with a post-`SUBSCRIBED` reconcile query so an already-`paid` row is reported immediately rather than only on a future change.

Net effect: because the driver must confirm cash before they can even complete the trip, the cash transaction is **almost always already `'paid'`** by the time the passenger's `ride_requests.status` flips to `'completed'` and `trip.tsx` routes them to `payment.tsx`.

## Design

In `app/booking/payment.tsx`:

1. **Generalize the GCash-only state.** Rename `gcashPhase`/`gcashError` → `paymentPhase`/`paymentError` (`'idle' | 'opening' | 'waiting' | 'failed'`). Both payment methods funnel into the same waiting/failed UI states; only the copy and the failed-state actions differ by method.
2. **Cash starts waiting automatically, not on a button tap.** A `useEffect` keyed on `paymentMethod === 'cash'` (guarded so it only runs once, mirroring the existing cleanup-`useEffect` pattern) calls `subscribeToTransactionStatus(rideRequestId, ...)` directly — no checkout call, no `WebBrowser.openBrowserAsync`. Sets `paymentPhase` to `'waiting'` immediately before subscribing.
   - Reconcile fires almost instantly since the row is typically already `paid` → `finishSuccessfulPayment()` runs with the waiting UI visible only for a frame; no separate "instant" code path is needed.
   - The footer "Pay now" button is hidden entirely for cash (nothing for the passenger to tap — payment already happened physically). GCash keeps its existing "Pay now" button/flow untouched.
3. **Shorter timeout for cash: 30s** (new `CASH_WAIT_TIMEOUT_MS`), vs. GCash's existing `GCASH_WAIT_TIMEOUT_MS` (120s) — cash confirmation should be near-instant since it's gated on the driver's own trip-completion flow, so a long wait signals something's actually wrong.
4. **Cash failed-state UI:** on timeout or subscription error, show `paymentError` text ("Still waiting for the driver to confirm cash received.") with a single **"Check again"** button that re-subscribes (same handler shape as `handleRetryGcash`, but no "pay cash instead" fallback — there's no other method to fall back to for an already-cash ride).
5. **GCash path is otherwise unchanged** — same button-triggered checkout flow, same 120s timeout, same retry/fallback-to-cash actions, just reading/writing the renamed `paymentPhase`/`paymentError` state.

## Out of scope (explicitly deferred)

- Any change to the driver app or `packages/services/src/payments` — both already correct for this flow.
- GCash checkout/webhook behavior — untouched.
- Payment history screen, receipts, or a `transactions` read on the history tab — separate backlog item (`docs/PASSENGER_TODO.MD` item 8).

## Testing

No existing test file covers `app/booking/payment.tsx` directly (screen-level tests aren't part of this repo's pattern yet — `packages/services` is where the test suite lives, and `subscribeToTransactionStatus`/`confirmCashPayment` are already covered there). This change only reorders when an already-tested service function is called and renames local state, so no new service-layer tests are needed. Verification is manual: exercise the cash flow in the running app (or Expo Go) once implemented, since this repo has no emulator/live-Supabase access in this sandboxed session — flag as unverified-on-device, same as prior sessions' pattern.

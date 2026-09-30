# Payment settlement: making sure a ride is actually paid

Date: 2026-09-30. Status: **draft for review, nothing built.**

## Intent

Whichever way a passenger pays (cash or GCash), a ride should not be able to end as "completed" with the fare unpaid, and if it somehow does, the passenger should be steered to settle it. Payment stays **post-paid** (FR-9.1: the passenger pays after the ride, not at booking).

Success looks like:
- A driver cannot complete a ride until its fare is confirmed paid, for cash **and** GCash, and the server enforces it, not just the driver's screen.
- If GCash cannot work at the drop-off (no signal, payment fails), the driver still has a way to finish the ride.
- A passenger with an unpaid completed ride cannot start a new booking until they settle it, and is reminded of it after an app restart.

## What happens today (findings)

- **Cash:** a pending cash transaction is created when the ride is assigned. The driver's Complete button stays disabled until the driver taps "Received" (`canComplete` in `apps/driver/app/trip/active.tsx`). The database function `complete_ride_leg` does **not** check payment, so this rule exists only in the app.
- **GCash:** nothing is checked. The driver can complete the ride, then the passenger is sent to the payment screen, which creates a PayMongo checkout (`create-gcash-checkout`, which only accepts `completed` rides). If the passenger closes the screen, loses signal or the app is killed, the ride stays completed with a pending transaction.
- **Nothing blocks a new booking** with an unpaid ride (Y2 in the UAT tracker, not built). The passenger app restores `assigned`/`ongoing` rides after a restart but not unpaid completed ones (R5, noted as blocked on Y2).
- The driver card shows "GCash confirmed" while a GCash ride is ongoing, which reads as if payment happened. It should not.
- The webhook (`paymongo-webhook`) is the only thing that marks GCash `paid`, and only from `pending` (a `failed` row cannot become `paid`).

## Design

### Layer 1: payment is confirmed before the ride can be completed

**Rule (server side):** `complete_ride_leg` refuses unless the ride's transaction is `paid` (cash: driver-confirmed; GCash: confirmed by the PayMongo webhook).

**GCash flow at the drop-off**
1. The ride is `ongoing`. Near the destination the driver taps **Request GCash payment** (new RPC `request_gcash_payment`, current driver of that ride only). It sets `ride_requests.payment_requested_at`.
2. The passenger's ride screen already listens to their ride row. It sees `payment_requested_at` and opens the existing payment screen with a Pay now button.
3. `create-gcash-checkout` is changed to accept an `ongoing` ride whose `payment_requested_at` is set, and to charge `estimated_fare` (the value `complete_ride_leg` copies into `final_fare` anyway, so the amounts match).
4. The passenger pays. The webhook marks the transaction `paid`. The driver's card updates in real time and Complete turns on.
5. The driver taps Complete as today.

**Fallback: switch to cash.** If the passenger cannot pay by GCash, the driver taps **Switch to cash** (new RPC `switch_payment_to_cash`, driver of that ride, GCash not yet paid, reason required from a fixed list: no signal, payment failed, passenger request, other). It converts the ride's transaction to a pending cash transaction and changes `preferred_method` to `cash`, then the normal cash steps apply. The switch is recorded (who, when, reason) and appears in the audit log. The passenger is told on their screen.

**Why not force a switch automatically:** a slow payment should not silently become cash. The driver decides.

**Cash rule moves to the server.** Same `complete_ride_leg` check: a cash ride needs `cash_confirmed_by` set.

**Driver UI wording:** while waiting, the card says "Waiting for GCash payment"; the wrong "GCash confirmed" text is removed.

### Layer 2: backstop for anything that still slips through

- **Booking block:** a `before insert` check on `ride_requests`: reject a new request if the passenger has a `completed` ride whose transaction is not `paid`. Only rides completed **after the migration date** count, so old test data does not lock accounts.
- **Settle screen:** Home shows a "Settle your last ride" card with Pay now (GCash checkout again) when such a ride exists. `resolveActiveRideRoute` also returns it after a restart or on returning to the foreground.
- **Repeat cases** are visible to the PSO in the admin ride list (existing payment status column).

## Data and code touched

- **Migration (new file, written for review, applied only after approval):** `payment_requested_at` on `ride_requests`; switch record columns on `transactions`; RPCs `request_gcash_payment`, `switch_payment_to_cash`; updated `complete_ride_leg`; the booking-block check. Every new function gets the repo's usual revoke-from-public and search_path handling.
- **Edge functions:** `create-gcash-checkout` (accept `ongoing` + requested; use `estimated_fare`); `paymongo-webhook` (only confirm rows still `method = 'gcash'`, so a late payment after a switch is logged for refund review, not marked paid).
- **Services:** wrappers for the two RPCs and for "unpaid completed ride" lookup.
- **Driver app:** Request GCash payment, Switch to cash, waiting state, corrected wording.
- **Passenger app:** react to `payment_requested_at`, settle card, restore path.
- English and Filipino strings for all new text.

## Risks and how they are handled

- `complete_ride_leg` is core and lives in the live database. The change is a migration file reviewed first, then applied, then verified with SQL tests. No hand edits to the live database.
- The GCash path depends on the PayMongo webhook. It runs in **test mode only** (per the requirements), which is fine for the panel demo. The existing signature-verification note in the webhook still applies.
- A passenger with no signal at the drop-off cannot pay. That is exactly what the switch-to-cash fallback is for.
- A checkout left open after a switch to cash: a payment on it later is not marked paid (webhook check above) and is logged.

## Assumptions to confirm

1. The fare charged before completion is `estimated_fare` (identical to what `final_fare` becomes on completion).
2. The unpaid-ride booking block starts from the day the migration is applied, ignoring older rides.
3. Switch-to-cash reasons: no signal, payment failed, passenger request, other.
4. Multi-passenger trips work per passenger (each ride has its own transaction).
5. Transfers follow the existing rule that only the driver finishing the ride handles its payment.

## Not in this change

Prepaid or card holds, refunds, real PayMongo live mode, real driver payouts, the other PayMongo fixes in tracker item Y3 (only what this flow needs).

## How it will be verified

- SQL tests: completing an unpaid cash or GCash ride is rejected; completing after `paid` works; a switch to cash from a different driver is rejected; booking with an unpaid completed ride is rejected; a fresh account is unaffected.
- Unit tests for the new service wrappers.
- Two-phone walkthrough: GCash request, pay, complete; cash; GCash with the switch-to-cash fallback; unpaid ride blocks booking and the settle card appears after an app restart.

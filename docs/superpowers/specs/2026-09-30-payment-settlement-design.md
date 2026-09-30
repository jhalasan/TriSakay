# Payment settlement: making sure a ride is actually paid

Date: 2026-09-30. Status: **approved by the team lead; revised after a double-check against the live system (see "Double-check findings"). Nothing built yet.**

## Intent

Whichever way a passenger pays (cash or GCash), a ride should not be able to end as "completed" with the fare unpaid, and if it somehow does, the passenger should be steered to settle it. Payment stays **post-paid** (FR-9.1: the passenger pays after the ride, not at booking).

Success looks like:
- A driver cannot complete a ride until its fare is confirmed paid, for cash **and** GCash, and the server enforces it, not just the driver's screen.
- If GCash cannot work at the drop-off (no signal, payment fails), the driver still has a way to finish the ride.
- A passenger with an unpaid completed ride cannot start a new booking until they settle it, and is reminded of it after an app restart.

## Double-check findings (read against the code and the live database, 2026-09-30)

Checked read-only against the live project. What it showed, and what changed in the design because of it:

**Confirmed facts**
- The live `complete_ride_leg` has no payment check (it never touches `transactions`), so the gate is genuinely new.
- Nobody can `UPDATE` `ride_requests` directly (no update policy at all); every change goes through server functions. So the new `payment_requested_at` marker cannot be forged from an app.
- Drivers can already read their rides' transaction rows (`txn_own_read`), so the driver's live "paid" update works without a policy change. The cash policy only lets a driver set `paid` with themselves as confirmer.
- Live data: 18 completed rides, all with a `paid` transaction (17 cash, 1 GCash). No old unpaid completed rides exist, so the booking block will not lock any test account. The 3 pending cash rows all belong to **cancelled** rides, so the block must look at `completed` rides only.
- The GCash path has completed end to end once on the live project (1 paid GCash transaction with a PayMongo session), so checkout and webhook have worked at least once.

**Problems found in the first draft, and the fixes (now part of the design)**
1. **Rollout order could strand rides.** Switching on the `complete_ride_leg` gate before the apps have the new buttons would leave a GCash ride impossible to complete. **Fix: two-phase rollout.** Phase A is additive only (column, RPCs, edge function changes); the apps are installed next; Phase B (the gate and the booking block) is applied last, after a check that both apps are on the new build.
2. **The payment screen mishandles an already-paid ride.** It only listens for a payment after the passenger taps Pay now, so a passenger arriving with a paid GCash ride would see a Pay now button that then errors with "Already paid". **Fix:** on opening, read the transaction; if it is already paid, go straight on.
3. **Paying mid-ride would show "trip complete" too early.** Today a successful payment jumps to the trip-complete screen, but with payment now happening before the driver completes, the ride is still ongoing. **Fix:** when the ride is not yet completed, return to the ride screen showing "Paid"; when the driver completes, go to trip complete (skipping the payment screen because it is paid).
4. **A reconnecting passenger could miss the payment request.** The ride screen's reconnect query lists columns explicitly and would not include `payment_requested_at`. **Fix:** add it to that query and its type, so a passenger who was offline or restarted the app still gets taken to the payment screen.
5. **The gate depends entirely on the webhook, which is the single thing that marks GCash paid.** If PayMongo is slow or misses a delivery, a passenger who really paid would leave the driver waiting. **Fix:** add a server-side **verify** step (`create-gcash-checkout` gains a `verify` action): it asks PayMongo directly whether the checkout session was paid and, if so, marks it paid using the same amount check as the webhook. The passenger app calls it when they return from the checkout page. The client still cannot mark anything paid; only the server, based on PayMongo's answer. The exact PayMongo response fields are confirmed against PayMongo's docs while building.
6. **A race between paying and switching to cash.** The passenger could pay at the same instant the driver switches. **Fix:** both operations lock the transaction row; the switch is refused if it is already paid, and the webhook/verify only confirm rows that are still GCash, so a late payment after a switch is logged for refund review and never marks the cash row paid. The passenger is shown a clear "your driver switched this ride to cash, do not pay in GCash" message.
7. **PayMongo has a minimum amount and needs signal.** A very small fare or a passenger with no data cannot pay by GCash. **Fix:** the driver's Switch to cash is always available while waiting, and the passenger screen shows the existing connection banner.
8. **A driver waiting with no guidance.** **Fix:** after about a minute the driver's card suggests reminding the passenger or switching to cash.
9. **The switch to cash needs to work whether or not a GCash row exists yet.** If the passenger never opened the checkout there is no row. **Fix:** `switch_payment_to_cash` upserts the cash row and clears stale PayMongo fields.
10. **Success/cancel redirect addresses.** `create-gcash-checkout` sends the passenger's browser to `https://trisakay.app/...` after paying. Payment still succeeds even if that page does not exist, but the passenger would see an error page. **To check while building:** confirm the domain is owned, or point these at the project's own address.
11. **A push notification when the driver requests payment** is a real improvement (a passenger with a locked phone at the drop-off). It needs a small trigger plus edge function, so it is **Phase C, after the core works**, not a blocker; the driver's on-screen wait and switch cover the gap meanwhile.

**Observation outside this change:** 10 cancelled rides carry a `paid` cash transaction (the driver tapped Received, then the ride was cancelled). Worth a look separately (refunds are out of scope here); this design does not change it.

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

## Rollout order

- **Phase A (additive, safe):** new column and columns, the two RPCs, edge function changes (`create-gcash-checkout` accepts an ongoing requested ride and gains `verify`; webhook checks the row is still GCash). Nothing here changes what an existing app can do.
- **Apps:** driver and passenger builds with the new buttons and screens are installed on every test phone.
- **Phase B (the gate):** `complete_ride_leg` starts requiring a paid transaction, and the booking block goes live. Applied only after Phase A is verified and both apps are updated.
- **Phase C (nice to have):** push notification to the passenger when payment is requested.

Each phase is a separate migration file, reviewed before it is applied, with SQL tests run before and after.

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

# Payment Settlement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A ride cannot be completed until its fare is confirmed paid (cash and GCash, enforced by the server), GCash has a driver-side "request payment" step and a "switch to cash" fallback, and a passenger with an unpaid completed ride cannot book again.

**Architecture:** Two additive-then-enforcing database phases. Phase A adds a `payment_requested_at` marker, two driver RPCs (`request_gcash_payment`, `switch_payment_to_cash`), and an extended `get_active_trip_passengers`; the edge functions learn to charge an ongoing requested ride and to *verify* a checkout with PayMongo directly. Both apps get the new screens. Phase B (last) makes `complete_ride_leg` require a `paid` transaction and adds the booking block.

**Tech Stack:** Supabase Postgres (plpgsql, RLS, realtime), Deno edge functions, PayMongo test mode, Expo SDK 54 / React Native monorepo (`packages/services`, `packages/shared`, `packages/ui`, `apps/passenger`, `apps/driver`), `node --test` via `tsx`.

**Spec:** `docs/superpowers/specs/2026-09-30-payment-settlement-design.md` (read its "Double-check findings" section first; the phases below are its rollout order).

## Global Constraints

- Migrations are **written as files, shown to the user, and applied only after the user says so**, via the Supabase MCP `apply_migration` (project `ygdgbvxxqrkxlezpckif`). Never hand-edit the live database.
- **Phase order is fixed:** Phase A migration → edge functions → apps built and installed on every test phone → Phase B migration. Do not apply Phase B early: it would strand GCash rides for apps without the new buttons.
- Every new or re-created function: `security definer` where the caller is a driver/passenger, `set search_path to 'public'`, then `revoke execute ... from public, anon; grant execute ... to authenticated;` (a `drop function` + `create function` resets grants; `create or replace` keeps them).
- No new colour tokens (use `colors`/`recordsPalette`), no `fontWeight` (use `fontFamily`), no new dependencies. Every user-visible string needs **English and Filipino** in `packages/shared/src/i18n/{en,fil}.ts`.
- Realtime channels must use `uniqueChannelName(base)` from `packages/services/src/supabase/channelName.ts`.
- Typecheck: `npx tsc -b packages/shared packages/services packages/ui packages/utils` then `npx tsc --noEmit -p apps/passenger` and `-p apps/driver`. Tests: `npm test` inside each of `packages/shared`, `packages/ui`, `packages/services`, `apps/passenger`, `apps/driver` (all currently 53 / 24 / 350 / 31 / 79 passing and must stay so).
- Shell is Git Bash on Windows; write files with the editor tools, not heredocs containing quotes.
- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Verified live facts this plan relies on: `ride_requests` has **no UPDATE policy** (only server functions change it); `transactions` RLS lets a driver read their rides' rows; the live `complete_ride_leg` equals `supabase/migrations/20260927000018_y10_fare_flag_dropoff_point.sql`; `get_active_trip_passengers.cash_confirmed` is already `coalesce(txn.status = 'paid', false)` (true for *any* paid transaction, GCash included); `notification_type` includes `payment_status`; the driver-only column locks `enforce_driver_claim_columns_locked` (blocks `preferred_method` changes) and `enforce_driver_transaction_columns_locked` (blocks `method` changes) both key off `app_current_role() = 'driver'`, which stays `driver` inside a `security definer` RPC, so both need a narrow escape hatch.

## Review Focus

Failure modes the spec implies that no single task's happy-path test covers, most likely first; each has a pinning test in the owning task:

1. **Passenger pays and the driver switches to cash at the same moment** → the switch is refused if already `paid`; a late GCash payment after a switch never marks the cash row paid (Task 1 SQL test, Task 4 webhook guard).
2. **Passenger opens the payment screen for a ride that is already paid** → goes straight on, no "Already paid" error (Task 5 `routeAfterPayment` test).
3. **Passenger reconnects/restarts after the driver requested payment** → still taken to the payment screen (Task 3 `RideRequestStatusUpdate` column list test).
4. **Driver never sees "paid"** because the webhook writes `transactions`, not `ride_requests` (Task 6 unfiltered transactions subscription; Task 3 test).
5. **Ride switched to cash but the passenger's stored method is still GCash** → passenger does not open a GCash checkout (Task 5 `shouldOpenPaymentScreen` test).

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20260930000001_pay1_payment_request_and_switch.sql` (new) | Phase A: column, transaction switch columns, escape hatches, two RPCs, extended `get_active_trip_passengers` |
| `supabase/migrations/20260930000002_pay2_payment_gate_and_booking_block.sql` (new) | Phase B: `complete_ride_leg` payment gate, unpaid-ride booking block |
| `supabase/tests/payment_settlement.sql` (new) | SQL assertions run in a rolled-back transaction |
| `supabase/functions/create-gcash-checkout/index.ts` | accept ongoing+requested rides; `verify` action |
| `supabase/functions/paymongo-webhook/index.ts` | only confirm/fail rows that are still `method = 'gcash'` |
| `packages/services/src/payments/index.ts` | new client wrappers + `subscribeToTripTransactions` |
| `packages/services/src/booking/index.ts` | `RideRequestStatusUpdate`/select list gain `payment_requested_at`, `preferred_method`; `ActiveTripPassenger.paymentRequestedAt` |
| `packages/services/src/supabase/database.types.ts` | regenerated types |
| `packages/services/tests/payments.test.ts` (new) | wrapper tests |
| `packages/shared/src/i18n/{en,fil}.ts` | strings |
| `apps/passenger/src/utils/paymentRoute.ts` (new) + test | pure routing decisions |
| `apps/passenger/app/booking/{trip,payment}.tsx` | react to the request, mid-ride pay, verify, already-paid |
| `apps/passenger/app/(tabs)/home.tsx` + `src/utils/resolveActiveRideRoute.ts` | settle card, restore |
| `apps/driver/src/store/useTripStore.ts`, `apps/driver/app/trip/active.tsx` | request / switch actions, waiting state, gate on paid |

---

### Task 1: Phase A migration and SQL tests

**Files:**
- Create: `supabase/migrations/20260930000001_pay1_payment_request_and_switch.sql`
- Create: `supabase/tests/payment_settlement.sql`

**Interfaces:**
- Produces (used by Tasks 3, 5, 6): column `ride_requests.payment_requested_at timestamptz`; `request_gcash_payment(p_ride_request_id uuid) returns timestamptz`; `switch_payment_to_cash(p_ride_request_id uuid, p_reason_code text) returns void` (reasons `no_signal | payment_failed | passenger_request | other`); `get_active_trip_passengers(p_trip_id uuid)` with one extra trailing column `payment_requested_at timestamptz`; `transactions` columns `switched_from_method payment_method, switch_reason text, switched_at timestamptz, previous_paymongo_session_id text`.

- [ ] **Step 1: Write the migration.** Create the file with exactly:

```sql
-- Payment settlement, Phase A (additive). See
-- docs/superpowers/specs/2026-09-30-payment-settlement-design.md.
-- Nothing here changes what an existing app can do: it adds a marker column,
-- two driver RPCs and one extra column on get_active_trip_passengers.

alter table public.ride_requests
  add column if not exists payment_requested_at timestamptz;

alter table public.transactions
  add column if not exists switched_from_method public.payment_method,
  add column if not exists switch_reason text,
  add column if not exists switched_at timestamptz,
  add column if not exists previous_paymongo_session_id text;

-- Narrow escape hatches, same pattern as trisakay.allow_fare_write: only
-- switch_payment_to_cash sets this (transaction-local), and it only changes
-- preferred_method / transactions.method.
create or replace function public.enforce_driver_claim_columns_locked()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if coalesce(current_setting('trisakay.allow_method_switch', true), '') = 'on' then
    return new;
  end if;

  if public.app_current_role() = 'driver' and (
    new.passenger_id is distinct from old.passenger_id
    or new.pickup_lat is distinct from old.pickup_lat
    or new.pickup_lng is distinct from old.pickup_lng
    or new.pickup_label is distinct from old.pickup_label
    or new.dest_lat is distinct from old.dest_lat
    or new.dest_lng is distinct from old.dest_lng
    or new.dest_label is distinct from old.dest_label
    or new.seats_requested is distinct from old.seats_requested
    or new.preferred_method is distinct from old.preferred_method
    or new.requested_at is distinct from old.requested_at
    or new.pickup_barangay_id is distinct from old.pickup_barangay_id
    or new.distance_km is distinct from old.distance_km
  ) then
    raise exception 'Drivers cannot modify ride request details — only trip assignment and lifecycle fields';
  end if;

  return new;
end;
$function$;

create or replace function public.enforce_driver_transaction_columns_locked()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if coalesce(current_setting('trisakay.allow_method_switch', true), '') = 'on' then
    return new;
  end if;

  if public.app_current_role() = 'driver' and (
    new.amount is distinct from old.amount
    or new.ride_request_id is distinct from old.ride_request_id
    or new.method is distinct from old.method
  ) then
    raise exception 'Drivers cannot modify the transaction amount, ride, or method — only confirm cash receipt';
  end if;

  return new;
end;
$function$;

-- The driver of an ONGOING GCash ride asks the passenger to pay now.
-- Idempotent: a second tap returns the first timestamp.
create or replace function public.request_gcash_payment(p_ride_request_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_requested_at timestamptz;
  v_passenger_id uuid;
  v_method public.payment_method;
  v_tx_status public.payment_status;
begin
  if not coalesce(public.is_account_active(), false) then
    raise exception 'Account is not active';
  end if;

  select rr.payment_requested_at, rr.passenger_id, rr.preferred_method
  into v_requested_at, v_passenger_id, v_method
  from public.ride_requests rr
  join public.trips t on t.id = rr.trip_id
  where rr.id = p_ride_request_id
    and t.driver_id = auth.uid()
    and rr.status = 'ongoing'
  for update of rr;

  if not found then
    raise exception 'Could not request payment — this ride is not yours or is not in progress';
  end if;

  if v_method <> 'gcash' then
    raise exception 'This ride is paying by cash';
  end if;

  select status into v_tx_status from public.transactions where ride_request_id = p_ride_request_id;
  if v_tx_status = 'paid' then
    return coalesce(v_requested_at, now());
  end if;

  if v_requested_at is not null then
    return v_requested_at;
  end if;

  update public.ride_requests
  set payment_requested_at = now()
  where id = p_ride_request_id
  returning payment_requested_at into v_requested_at;

  insert into public.notifications (user_id, type, title, message, ref_id)
  values (v_passenger_id, 'payment_status'::notification_type,
          'Your driver is asking for payment',
          'Please pay your fare by GCash to finish your ride.',
          p_ride_request_id);

  return v_requested_at;
end;
$function$;

-- The driver of an ONGOING GCash ride converts it to cash when GCash cannot
-- work (no signal, failed payment...). Refused if already paid. Locks the
-- transaction row, so it cannot race the webhook marking it paid.
create or replace function public.switch_payment_to_cash(p_ride_request_id uuid, p_reason_code text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_passenger_id uuid;
  v_method public.payment_method;
  v_fare numeric;
  v_tx_id uuid;
  v_tx_status public.payment_status;
  v_session text;
begin
  if not coalesce(public.is_account_active(), false) then
    raise exception 'Account is not active';
  end if;

  if p_reason_code not in ('no_signal', 'payment_failed', 'passenger_request', 'other') then
    raise exception 'Invalid reason';
  end if;

  select rr.passenger_id, rr.preferred_method, rr.estimated_fare
  into v_passenger_id, v_method, v_fare
  from public.ride_requests rr
  join public.trips t on t.id = rr.trip_id
  where rr.id = p_ride_request_id
    and t.driver_id = auth.uid()
    and rr.status = 'ongoing'
  for update of rr;

  if not found then
    raise exception 'Could not switch to cash — this ride is not yours or is not in progress';
  end if;

  if v_method = 'cash' then
    return; -- already cash: idempotent
  end if;

  select id, status, paymongo_session_id
  into v_tx_id, v_tx_status, v_session
  from public.transactions
  where ride_request_id = p_ride_request_id
  for update;

  if v_tx_id is not null and v_tx_status = 'paid' then
    raise exception 'This ride is already paid by GCash';
  end if;

  perform set_config('trisakay.allow_method_switch', 'on', true);

  update public.ride_requests set preferred_method = 'cash' where id = p_ride_request_id;

  if v_tx_id is null then
    insert into public.transactions (ride_request_id, method, amount, status, switched_from_method, switch_reason, switched_at)
    values (p_ride_request_id, 'cash', coalesce(v_fare, 0), 'pending', 'gcash', p_reason_code, now());
  else
    update public.transactions
    set method = 'cash',
        status = 'pending',
        paymongo_session_id = null,
        paymongo_payload = null,
        switched_from_method = 'gcash',
        switch_reason = p_reason_code,
        switched_at = now(),
        previous_paymongo_session_id = v_session
    where id = v_tx_id;
  end if;

  perform set_config('trisakay.allow_method_switch', 'off', true);

  insert into public.notifications (user_id, type, title, message, ref_id)
  values (v_passenger_id, 'payment_status'::notification_type,
          'Payment changed to cash',
          'Your driver switched this ride to cash. Please pay in cash and do not pay by GCash.',
          p_ride_request_id);
end;
$function$;

-- Return type gains a column, so DROP + CREATE (Postgres 42P13), then re-grant.
drop function if exists public.get_active_trip_passengers(uuid);

create function public.get_active_trip_passengers(p_trip_id uuid)
returns table(ride_request_id uuid, seats_requested smallint, preferred_method payment_method, estimated_fare numeric, passenger_id uuid, passenger_name text, avatar_url text, cash_confirmed boolean, status ride_status, pickup_lat numeric, pickup_lng numeric, dest_lat numeric, dest_lng numeric, assigned_at timestamptz, picked_up_at timestamptz, distance_km numeric, arrived_at timestamptz, handoff_lat numeric, handoff_lng numeric, payment_requested_at timestamptz)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
begin
  if not exists (
    select 1 from public.trips where id = p_trip_id and driver_id = auth.uid()
  ) then
    return;
  end if;

  return query
  select
    rr.id,
    rr.seats_requested,
    rr.preferred_method,
    rr.estimated_fare,
    u.id,
    u.full_name,
    u.avatar_url,
    coalesce(txn.status = 'paid', false),
    rr.status,
    rr.pickup_lat,
    rr.pickup_lng,
    rr.dest_lat,
    rr.dest_lng,
    rr.assigned_at,
    rr.picked_up_at,
    rr.distance_km,
    rr.arrived_at,
    rt.handoff_lat,
    rt.handoff_lng,
    rr.payment_requested_at
  from public.ride_requests rr
  join public.users u on u.id = rr.passenger_id
  left join public.transactions txn on txn.ride_request_id = rr.id
  left join public.ride_transfers rt on rt.ride_request_id = rr.id
    and rt.to_driver_id = auth.uid() and rt.status = 'accepted' and rt.after_pickup and rt.handoff_completed_at is null
  where rr.trip_id = p_trip_id
    and rr.status in ('assigned', 'ongoing')
  order by rr.assigned_at asc nulls last;
end;
$function$;

revoke execute on function public.request_gcash_payment(uuid) from public, anon;
grant execute on function public.request_gcash_payment(uuid) to authenticated;
revoke execute on function public.switch_payment_to_cash(uuid, text) from public, anon;
grant execute on function public.switch_payment_to_cash(uuid, text) to authenticated;
revoke execute on function public.get_active_trip_passengers(uuid) from public, anon;
grant execute on function public.get_active_trip_passengers(uuid) to authenticated;
```

- [ ] **Step 2: Write the SQL test script.** Create `supabase/tests/payment_settlement.sql`. It runs inside a transaction that is rolled back, builds throwaway users/ride/transaction fixtures, impersonates users with `set local role authenticated` + `request.jwt.claims`, and `raise exception`s on any unexpected outcome. Model the fixtures on the columns `ride_requests`/`trips`/`transactions` require (read `docs/SCHEMA.MD` for required columns and the `enforce_ride_request_insert_fields` trigger, which forces `status = 'pending'` on insert so fixtures must be moved through `assigned`→`ongoing` with the real RPCs or by `set local session_replication_role = replica` inside the rolled-back transaction). Assertions (each a `do $$ ... $$` block that expects an exception via `begin ... exception when others then` and fails if none is raised):
  1. A driver who is **not** the trip's driver calling `request_gcash_payment` → exception.
  2. The right driver calling it twice → same timestamp both times (idempotent), one notification row.
  3. `switch_payment_to_cash` with reason `'bogus'` → exception; with a paid GCash transaction → exception "already paid"; with a pending GCash transaction → `ride_requests.preferred_method = 'cash'`, `transactions.method = 'cash'`, `status = 'pending'`, `paymongo_session_id is null`, `previous_paymongo_session_id` set.
  4. Switch when **no** transaction row exists → a pending cash row is created.
  5. A driver updating `transactions.method` or `ride_requests.preferred_method` **directly** (not through the RPC) → still exception (the escape hatch is closed after the RPC).
  End the script with `rollback;`.

- [ ] **Step 3: Show the migration to the user and wait for approval.** Present the SQL file and its purpose. Do **not** apply it until the user says so.

- [ ] **Step 4: Apply and run the tests.** After approval: `mcp__claude_ai_Supabase__apply_migration` (name `pay1_payment_request_and_switch`, the file's contents), then run the test script through `mcp__claude_ai_Supabase__execute_sql`. Expected: no exception, transaction rolled back. If `execute_sql` cannot hold a multi-statement transaction open, run each assertion block with its own `begin; ... rollback;` in one call and note this in the commit message. Then confirm with `select count(*) from public.transactions` that row counts are unchanged from the earlier live check (cash paid 27, cash pending 3, gcash paid 1).

- [ ] **Step 5: Commit.**

```bash
git add supabase/migrations/20260930000001_pay1_payment_request_and_switch.sql supabase/tests/payment_settlement.sql
git commit -m "Payment settlement phase A: payment request marker, switch-to-cash RPCs

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Regenerate types and update the shared service shapes

**Files:**
- Modify: `packages/services/src/supabase/database.types.ts`
- Modify: `packages/services/src/booking/index.ts` (`RideRequestStatusUpdate`, the `.select(...)` at `subscribeToRideRequestStatus` ~line 277, `ActiveTripPassenger`, `getActiveTripForDriver` mapping ~line 590-630)
- Test: `packages/services/tests/booking.test.ts`

**Interfaces:**
- Consumes: Task 1 columns and RPCs.
- Produces: `RideRequestStatusUpdate` gains `payment_requested_at: string | null` and `preferred_method: 'cash' | 'gcash'`; `ActiveTripPassenger` gains `paymentRequestedAt: string | null`.

- [ ] **Step 1: Regenerate types.** Run `mcp__claude_ai_Supabase__generate_typescript_types` (project `ygdgbvxxqrkxlezpckif`). Merge **only** the differences this migration causes into `database.types.ts` (new `ride_requests` column in Row/Insert/Update, the four `transactions` columns, the two new functions under `Functions`, the extra `get_active_trip_passengers` return column) and check the diff by eye against the file's existing conventions before saving. Do not overwrite the file wholesale.

- [ ] **Step 2: Failing tests.** In `packages/services/tests/booking.test.ts` add (follow the existing fake-client style in that file):
  - `getActiveTripForDriver maps payment_requested_at to paymentRequestedAt` (rpc fake returns a passenger row with `payment_requested_at: '2026-09-30T10:00:00Z'`; expect `paymentRequestedAt` equal to it; a row without the field maps to `null`).
  - `subscribeToRideRequestStatus reconciles with payment_requested_at and preferred_method in the column list` (capture the string passed to `.select(...)` in the fake `from('ride_requests')` chain and assert it contains `payment_requested_at` and `preferred_method`).
  Run `cd packages/services && npm test`; expect these two to FAIL.

- [ ] **Step 3: Implement.** Add `payment_requested_at` and `preferred_method` to the `select` string and to `RideRequestStatusUpdate`; add `paymentRequestedAt: string | null` to `ActiveTripPassenger` and `paymentRequestedAt: row.payment_requested_at ?? null` in the mapping (the `?? null` follows the existing "column absent until migration applied" convention).

- [ ] **Step 4: Run** `cd packages/services && npm test` (350 + new pass) and the typecheck; fix any `ActivePassenger` construction sites in `apps/driver` that now need the new field (`passengerFromRequest` in `useTripStore.ts` sets `paymentRequestedAt: null`).

- [ ] **Step 5: Commit** `Add payment_requested_at to ride status and active trip shapes`.

---

### Task 3: Payment service wrappers

**Files:**
- Modify: `packages/services/src/payments/index.ts`
- Create: `packages/services/tests/payments.test.ts`

**Interfaces:**
- Produces (used by Tasks 5, 6):
```ts
export const SWITCH_TO_CASH_REASON_CODES = ['no_signal', 'payment_failed', 'passenger_request', 'other'] as const;
export type SwitchToCashReasonCode = (typeof SWITCH_TO_CASH_REASON_CODES)[number];
export async function requestGcashPayment(rideRequestId: string): Promise<{ requestedAt: string | null; error: string | null }>;
export async function switchPaymentToCash(rideRequestId: string, reasonCode: SwitchToCashReasonCode): Promise<{ error: string | null }>;
export async function getTransactionStatus(rideRequestId: string): Promise<{ status: 'pending' | 'paid' | 'failed' | 'refunded' | null; error: string | null }>;
export async function verifyGcashPayment(rideRequestId: string): Promise<{ status: 'paid' | 'pending' | 'failed' | null; error: string | null }>;
export const UNPAID_RIDE_CUTOFF_ISO = '2026-09-30T00:00:00+08:00';
export async function getUnpaidCompletedRide(passengerId: string): Promise<{ data: { rideRequestId: string; fare: number | null; method: 'cash' | 'gcash' } | null; error: string | null }>;
export function subscribeToTripTransactions(onChange: () => void, onError?: (message: string) => void): () => void;
```

- [ ] **Step 1: Failing tests** in `packages/services/tests/payments.test.ts`, using `createFakeSupabaseClient` and `__setSupabaseClientForTests` exactly as `booking.test.ts` does:
  - `requestGcashPayment` calls rpc `request_gcash_payment` with `{ p_ride_request_id }` and returns the scalar; an rpc error returns `{ requestedAt: null, error: <message> }`.
  - `switchPaymentToCash` calls rpc `switch_payment_to_cash` with `{ p_ride_request_id, p_reason_code }`; error is passed through.
  - `getTransactionStatus` returns the row's status, `null` when no row.
  - `verifyGcashPayment` calls `functions.invoke('create-gcash-checkout', { body: { rideRequestId, action: 'verify' } })` and maps `{ status }`; a thrown/error response gives `{ status: null, error }`.
  - `getUnpaidCompletedRide` returns the newest completed ride whose joined transaction is not `paid` and whose `completed_at` is on/after `UNPAID_RIDE_CUTOFF_ISO`; returns `null` when all are paid; handles the join arriving as an object or a one-element array.
  - `subscribeToTripTransactions` opens a channel whose name starts with `trip_transactions` on table `transactions`, calls `onChange` on an event, and `removeChannel` on unsubscribe.
  Run `cd packages/services && npm test`; expect FAIL (functions not defined).

- [ ] **Step 2: Implement** in `payments/index.ts`, following the existing file's style (uses `getSupabaseClient()`, `uniqueChannelName`). Key bodies:

```ts
export async function requestGcashPayment(rideRequestId: string) {
  const { data, error } = await getSupabaseClient().rpc('request_gcash_payment', { p_ride_request_id: rideRequestId });
  if (error) return { requestedAt: null, error: error.message };
  return { requestedAt: (data as string | null) ?? null, error: null };
}

export async function switchPaymentToCash(rideRequestId: string, reasonCode: SwitchToCashReasonCode) {
  const { error } = await getSupabaseClient().rpc('switch_payment_to_cash', { p_ride_request_id: rideRequestId, p_reason_code: reasonCode });
  return { error: error ? error.message : null };
}

export async function getTransactionStatus(rideRequestId: string) {
  const { data, error } = await getSupabaseClient().from('transactions').select('status').eq('ride_request_id', rideRequestId).maybeSingle();
  if (error) return { status: null, error: error.message };
  return { status: data?.status ?? null, error: null };
}

export async function verifyGcashPayment(rideRequestId: string) {
  const { data, error } = await getSupabaseClient().functions.invoke('create-gcash-checkout', { body: { rideRequestId, action: 'verify' } });
  if (error) return { status: null, error: await extractFunctionErrorMessage(error) };
  const status = (data as { status?: string } | null)?.status;
  return { status: status === 'paid' || status === 'pending' || status === 'failed' ? status : null, error: null };
}

export function subscribeToTripTransactions(onChange: () => void, onError?: (message: string) => void): () => void {
  const client = getSupabaseClient();
  // No filter on purpose: transactions RLS already limits a driver to their own rides' rows.
  const channel = client
    .channel(uniqueChannelName('trip_transactions'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => onChange())
    .subscribe((status: string) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onError?.('Lost connection while watching payments.');
    });
  return () => { client.removeChannel(channel); };
}
```
`getUnpaidCompletedRide`: select `id, final_fare, estimated_fare, preferred_method, completed_at, transactions(status)` from `ride_requests` filtered `passenger_id`, `status = 'completed'`, `completed_at >= UNPAID_RIDE_CUTOFF_ISO`, ordered newest first, `limit(5)`; pick the first row where the (object-or-array) transaction status is not `'paid'`.

- [ ] **Step 3: Run** `cd packages/services && npm test` (all pass) and the typecheck.

- [ ] **Step 4: Commit** `Add payment request, switch, verify and unpaid-ride service wrappers`.

---

### Task 4: Edge functions (`create-gcash-checkout` verify + ongoing, webhook guard)

**Files:**
- Modify: `supabase/functions/create-gcash-checkout/index.ts`
- Modify: `supabase/functions/paymongo-webhook/index.ts`

**Interfaces:**
- Consumes: Task 1 (`payment_requested_at`, `estimated_fare`).
- Produces: `POST create-gcash-checkout { rideRequestId }` now also accepts a ride with `status = 'ongoing'` and `payment_requested_at` set, and charges `estimated_fare` for it (completed rides still charge `final_fare`); `POST create-gcash-checkout { rideRequestId, action: 'verify' }` → `{ status: 'paid' | 'pending' | 'failed' }`.

- [ ] **Step 1: Confirm PayMongo's checkout-session response shape.** Fetch `https://developers.paymongo.com/reference/retrieve-a-checkout-session` (WebFetch) and record which fields show a paid session (expected: `data.attributes.payments[].attributes.status === 'paid'` with `amount` in centavos, and/or `data.attributes.payment_intent.attributes.status === 'succeeded'`). Adjust Step 3's `isSessionPaid` to the documented shape.

- [ ] **Step 2: Failing check (no Deno test runner in this repo):** add a small pure helper file `supabase/functions/create-gcash-checkout/paid.ts` exporting `isSessionPaid(session: unknown, expectedCentavos: number): 'paid' | 'pending' | 'mismatch'` and `fareForRide(ride: { status: string; final_fare: number | null; estimated_fare: number | null; payment_requested_at: string | null }): number | null`. Run `deno test` if Deno is installed; otherwise verify by reading through with three sample payloads in comments-free assertions run via `node --test` on a `.test.ts` copy. Cases: paid + matching amount → `'paid'`; paid + different amount → `'mismatch'`; no payments → `'pending'`; `fareForRide` for an `ongoing` ride with `payment_requested_at` → `estimated_fare`; `ongoing` without it → `null`; `completed` → `final_fare`.

- [ ] **Step 3: Implement.** In `create-gcash-checkout/index.ts`:
  - select `id, passenger_id, status, final_fare, estimated_fare, payment_requested_at, preferred_method`;
  - replace the `status !== 'completed'` rejection with `const fare = fareForRide(rideRequest); if (fare === null) return json({ checkoutUrl: null, error: "Payment hasn't been requested yet" }, 400);` and use `fare` where `final_fare` was used for the amount; reject `preferred_method !== 'gcash'` with `error: 'This ride is paying by cash'`;
  - add the `verify` branch **before** session creation: load the transaction (service client); if none → `{ status: 'pending' }`; if `paid` → `{ status: 'paid' }`; if not `method === 'gcash'` or no `paymongo_session_id` → `{ status: 'pending' }`; call `GET ${PAYMONGO_API_BASE}/checkout_sessions/${session_id}` with the same Basic auth; `isSessionPaid(...)`: `'paid'` → `update transactions set status = 'paid', paymongo_payload = <the response> where id = ? and status = 'pending' and method = 'gcash'` then return `{ status: 'paid' }`; `'mismatch'` → log and return `{ status: 'pending' }`; else `{ status: 'pending' }`. The passenger-owns-the-ride check stays first for both actions.
  In `paymongo-webhook/index.ts` add `.eq('method', 'gcash')` to the three updates/selects that currently filter `.eq('status', 'pending')` (paid select ~line 145, paid update ~176, failed update ~229) so a row converted to cash is never marked paid or failed by a late event; on a paid event whose row is no longer GCash, `console.warn('paymongo-webhook: payment arrived for a ride switched to cash — refund review', { referenceNumber })` and return 200.

- [ ] **Step 4: Deploy** both functions with `mcp__claude_ai_Supabase__deploy_edge_function` (`verify_jwt`: `true` for `create-gcash-checkout`, **`false`** for `paymongo-webhook`, matching what is live today; pass each file with its existing `name` such as `create-gcash-checkout/index.ts`) after the user approves the diff. Check the function list afterwards shows the new versions with unchanged `verify_jwt`.

- [ ] **Step 5: Commit** `Checkout accepts requested ongoing rides and verifies with PayMongo; webhook ignores switched rows`.

---

### Task 5: Strings (English and Filipino)

**Files:**
- Modify: `packages/shared/src/i18n/en.ts`, `packages/shared/src/i18n/fil.ts`

- [ ] **Step 1: Add keys** (both files, same shape). Under the passenger `payment` block: `switchedToCashTitle`, `switchedToCashBody` ("Your driver switched this ride to cash. Please pay in cash and do not pay by GCash."), `verifying` ("Checking your payment…"), `checkAgain` ("I've paid — check again"), `midRideNote` ("Pay now so your driver can finish the ride."). Under `home`: `settleTitle` ("Settle your last ride"), `settleBody` ("Pay ₱{fare} to book again."), `settleAction` ("Pay now"). Under `driver.tripActive`: `requestGcash` ("Request GCash payment"), `gcashRequestedWaiting` ("Waiting for the passenger to pay…"), `gcashWaitHint` ("Still waiting — remind the passenger, or switch to cash."), `gcashPaid` ("GCash paid"), `switchToCash` ("Switch to cash"), `switchReasonTitle` ("Why switch to cash?"), `reasonNoSignal` ("No signal"), `reasonPaymentFailed` ("Payment failed"), `reasonPassengerRequest` ("Passenger asked"), `reasonOther` ("Other"), `paymentRequestFailed`, `switchFailed`. Filipino translations in the same commit. Remove the misleading driver string `gcashConfirmedInline` usage (Task 7 stops using it; delete the key in both files only if nothing else references it — `grep` first).
- [ ] **Step 2:** `npx tsc -b packages/shared ...` and `cd packages/shared && npm test` pass.
- [ ] **Step 3: Commit** `Add payment settlement strings (en, fil)`.

---

### Task 6: Passenger app

**Files:**
- Create: `apps/passenger/src/utils/paymentRoute.ts`, `apps/passenger/tests/paymentRoute.test.ts`
- Modify: `apps/passenger/app/booking/trip.tsx`, `apps/passenger/app/booking/payment.tsx`, `apps/passenger/app/(tabs)/home.tsx`, `apps/passenger/src/utils/resolveActiveRideRoute.ts`

**Interfaces:**
- Consumes: Tasks 2, 3, 5.
- Produces:
```ts
export function shouldOpenPaymentScreen(row: { status: string; preferred_method?: 'cash' | 'gcash'; payment_requested_at?: string | null }): boolean; // true only for ongoing + gcash + requested
export function routeAfterPayment(rideStatus: 'assigned' | 'ongoing' | 'completed' | 'cancelled' | 'pending'): '/booking/trip' | '/booking/trip-complete'; // completed -> trip-complete, anything else -> trip
```

- [ ] **Step 1: Failing tests** `apps/passenger/tests/paymentRoute.test.ts` (imports `../src/utils/paymentRoute.ts`): `shouldOpenPaymentScreen` true for `{status:'ongoing', preferred_method:'gcash', payment_requested_at:'x'}`; false when method is `cash` (the switched ride), when not requested, when `status` is `completed`/`assigned`; `routeAfterPayment('completed') === '/booking/trip-complete'`, `routeAfterPayment('ongoing') === '/booking/trip'`. Run `cd apps/passenger && npm test`; expect FAIL.
- [ ] **Step 2: Implement** `paymentRoute.ts` (two pure functions, no imports). Tests pass.
- [ ] **Step 3: `trip.tsx` ride-status handler** (~lines 255-275): after the existing `arrived_at` line add
  - `if (row.preferred_method) setPaymentMethod(row.preferred_method)` (store setter already exists in `useBookingStore`), and a `paymentSwitchedVisible` state set to `true` when the method flips from `gcash` to `cash` (compare with the previous store value) — render it as a dismissible notice styled like the existing transfer banner using `t.payment.switchedToCashTitle/Body`;
  - `else if (shouldOpenPaymentScreen(row)) { router.push('/booking/payment'); }` (push, not replace, so Back returns to the ride; the handler must not fire it repeatedly: guard with a `paymentOpenedRef`);
  - change the `completed` branch to check payment first: `const { status } = await getTransactionStatus(rideRequestId)`; if `'paid'` → `setTripStatus('paid'); router.replace('/booking/trip-complete')`, else the existing `awaiting_payment` + `/booking/payment` (unpaid backstop).
- [ ] **Step 4: `payment.tsx`**:
  - on mount, for **both** methods, call `getTransactionStatus(rideRequestId)`; if `'paid'` → `finishSuccessfulPayment()`; if `'failed'`/none, stay on the screen;
  - `finishSuccessfulPayment` becomes: fetch the ride status (existing `useBookingStore` has none, so read `from('ride_requests').select('status')` through a new tiny helper in `booking/index.ts` if not already present, or reuse `subscribeToRideRequestStatus`'s reconcile query) and `router.replace(routeAfterPayment(status))`; set `setTripStatus('paid')` only when the destination is `/booking/trip-complete`;
  - after `await WebBrowser.openBrowserAsync(checkoutUrl)` returns, call `verifyGcashPayment(rideRequestId)` once; on `'paid'` → `finishSuccessfulPayment()`; also call it from a new **"I've paid — check again"** button on the failed/timeout state (`t.payment.checkAgain`), showing `t.payment.verifying` while running;
  - when `paymentMethod` becomes `cash` while on this screen (driver switched), show the cash-waiting state (existing cash branch) plus `t.payment.switchedToCashBody`, and never call `createGcashCheckout`.
- [ ] **Step 5: Settle card + restore.** In `home.tsx`, load `getUnpaidCompletedRide(user.id)` on focus; when non-null show a card (`t.home.settleTitle/Body/Action`, styled with the existing amber/records card conventions in `recordsPalette`, no new colours) whose action sets the booking store (`rideRequestId`, `fare`, `paymentMethod: 'gcash'`, `tripStatus: 'awaiting_payment'`) and `router.push('/booking/payment')`. In `resolveActiveRideRoute.ts`, when there is no active ride, look up `getUnpaidCompletedRide(passengerId)` and return a new variant `{ pathname: '/booking/payment' }` after seeding the store the same way, and update its two callers (`splash.tsx`, `_layout.tsx` foreground sync) to handle it.
- [ ] **Step 6: Run** `cd apps/passenger && npm test`, typecheck; both pass. Add `paymentRoute` tests to the passing count.
- [ ] **Step 7: Commit** `Passenger: pay when the driver requests it, verify checkout, handle switch to cash, settle unpaid rides`.

---

### Task 7: Driver app

**Files:**
- Modify: `apps/driver/src/types/trip.ts` (`ActivePassenger.paymentRequestedAt`), `apps/driver/src/store/useTripStore.ts`, `apps/driver/app/trip/active.tsx`, `apps/driver/app/_layout.tsx` (trip sync)
- Test: `apps/driver/tests/tripStore.test.js`

**Interfaces:**
- Consumes: Tasks 2, 3, 5.
- Produces (store): `requestPayment: (rideRequestId: string) => Promise<boolean>`, `switchToCash: (rideRequestId: string, reasonCode: SwitchToCashReasonCode) => Promise<boolean>` — both call the service, on success `await get().hydrate()`, on failure `set({ error })` with `paymentRequestFailed` / `switchFailed` strings.

- [ ] **Step 1: Failing tests** in `tripStore.test.js` (existing style): `requestPayment` calls the RPC wrapper and re-hydrates on success and sets `error` on failure; `switchToCash` passes the reason code through; a hydrated passenger maps `paymentRequestedAt` from the service row.
- [ ] **Step 2: Implement store actions**; map `paymentRequestedAt` in the hydrate path; set it to `null` in `passengerFromRequest`.
- [ ] **Step 3: Live "paid" for the driver.** In `_layout.tsx`, next to `useTripCancellationSync(activeTripId)`, add a sync that, while a trip is active, calls `subscribeToTripTransactions(() => void useTripStore.getState().hydrate())` and unsubscribes on cleanup (same shape as the existing cancellation sync). This is what makes "Waiting…" turn into "Paid" the moment the webhook lands.
- [ ] **Step 4: Passenger card UI in `active.tsx`** (`PassengerCard`, the `isCash && passenger.status === 'ongoing'` block ~line 950 and `canComplete` ~line 843):
  - `canComplete = tutorialActive ? true : passenger.status === 'ongoing' && passenger.cashConfirmed && !isCompleting` (`cashConfirmed` is true for any paid transaction, so this covers GCash too);
  - keep the cash block as is;
  - add a GCash block for `!isCash && passenger.status === 'ongoing'`: if `passenger.cashConfirmed` → done row (`t.driver.tripActive.gcashPaid`, same style as `cashRowDone`); else if `passenger.paymentRequestedAt` → waiting row (`ActivityIndicator` + `gcashRequestedWaiting`; after 60 s from `paymentRequestedAt`, also `gcashWaitHint`, via a small `useNow`-style interval) plus a **Switch to cash** outline button; else a primary **Request GCash payment** `Button` (`loading` while in flight) plus the **Switch to cash** outline button;
  - **Switch to cash** opens `ReasonPickerModal` (already imported in this file, used by cancel/transfer) with the four reasons from `SWITCH_TO_CASH_REASON_CODES`, then calls `switchToCash`;
  - replace the inline label `gcashConfirmedInline` (~line 903) with a state-accurate one: paid → `gcashPaid`, requested → `gcashRequestedWaiting`, else the plain payment-method label.
- [ ] **Step 5: Run** `cd apps/driver && npm test`, typecheck; pass.
- [ ] **Step 6: Commit** `Driver: request GCash payment, switch to cash, complete only when paid`.

---

### Task 8: Build and install both apps (Phase A + apps live)

- [ ] **Step 1:** Run all typechecks and all five test suites (counts in Global Constraints plus the new tests).
- [ ] **Step 2:** Rebuild and install both apps with the repo's proven sequence (per the memory note `android_release_build_stale_bundle`): for each of `passenger` then `driver`, in `apps/<app>`: `npx expo export:embed --platform android --bundle-output .release-bundle-backup/index.android.bundle --sourcemap-output .release-bundle-backup/index.android.bundle.packager.map --assets-dest .release-bundle-backup/assets --dev false --reset-cache`, then in `apps/<app>/android`: `./gradlew :app:createBundleReleaseJsAndAssets --rerun :app:assembleRelease`; unzip `assets/index.android.bundle` from the APK and confirm it contains `requestGcashPayment` (driver) / `shouldOpenPaymentScreen` (passenger) before `adb -s ANRG6R4C24007553 install -r`.
- [ ] **Step 3: Phase A walkthrough on two phones** (or one phone plus a second device; both apps must be on **every** device that will take part): (a) GCash ride → driver taps Request → passenger's screen opens payment → pay in PayMongo test checkout → driver card flips to "GCash paid" without a refresh → Complete works → passenger reaches trip complete. (b) GCash ride → driver taps Switch to cash → passenger sees the "switched to cash" notice and no GCash checkout → driver taps Received → Complete works. (c) Kill the passenger app while payment is requested, reopen → payment screen returns. (d) Close the checkout without paying → "I've paid — check again" works after paying. Record results in the commit message of Task 9 or the tracker.
- [ ] **Step 4: Push** the commits only if the user asks.

---

### Task 9: Phase B migration (the gate) — only after Task 8 passes

**Files:**
- Create: `supabase/migrations/20260930000002_pay2_payment_gate_and_booking_block.sql`
- Modify: `supabase/tests/payment_settlement.sql` (append)

- [ ] **Step 1: Write the migration.** Re-create `complete_ride_leg` as the live body (identical to `20260927000018_y10_fare_flag_dropoff_point.sql`) with one added block directly after the `if not found then raise exception 'Ride request not found for this trip'; end if;` that follows the ride select, and a new variable `v_payment_status public.payment_status;`:

```sql
  select status into v_payment_status
  from public.transactions
  where ride_request_id = p_ride_request_id;

  if v_payment_status is distinct from 'paid' then
    raise exception 'Payment has not been confirmed for this ride yet';
  end if;
```
  Use `create or replace` (grants are kept). Then add the booking block:

```sql
create or replace function public.enforce_no_unpaid_completed_ride()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if exists (
    select 1
    from public.ride_requests rr
    left join public.transactions t on t.ride_request_id = rr.id
    where rr.passenger_id = new.passenger_id
      and rr.status = 'completed'
      and rr.completed_at >= timestamptz '2026-09-30 00:00:00+08'
      and t.status is distinct from 'paid'
  ) then
    raise exception 'Please settle your last ride before booking another.';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_ride_requests_no_unpaid_completed on public.ride_requests;
create trigger trg_ride_requests_no_unpaid_completed
  before insert on public.ride_requests
  for each row execute function public.enforce_no_unpaid_completed_ride();
```
  The cutoff literal equals `UNPAID_RIDE_CUTOFF_ISO` in the services package; if Phase B is applied on a later day keep them equal (no unpaid completed rows exist today, verified 2026-09-30, so either is safe).
- [ ] **Step 2: SQL tests (append).** (1) `complete_ride_leg` on an ongoing ride with **no** transaction → exception "Payment has not been confirmed"; (2) with a **pending** cash or GCash transaction → same exception; (3) with a **paid** transaction → succeeds (needs the same location/time fixtures the Y1/Y10 gates require; set the driver's `current_lat/lng` at the destination and `picked_up_at` far enough in the past); (4) inserting a `ride_requests` row for a passenger who has a completed ride with a pending transaction → exception "Please settle your last ride"; (5) a passenger whose only unpaid rows are **cancelled** is unaffected (the 3 live pending-cash rows are all on cancelled rides); (6) a fresh passenger is unaffected. Each block rolls back.
- [ ] **Step 3: Show the migration to the user, wait for approval, then apply** with `apply_migration` (name `pay2_payment_gate_and_booking_block`) and run the tests through `execute_sql`.
- [ ] **Step 4: Live smoke test** with the apps: an unpaid GCash ride cannot be completed by the driver until payment is requested and paid; a cash ride cannot be completed before "Received"; after switching to cash it completes after "Received".
- [ ] **Step 5: Commit** `Payment settlement phase B: require paid before completion, block booking with an unpaid ride`, then update the `docs/UAT_PANELIST_REVIEW_ADRALES.md` Y2 row to done with a one-line summary.

---

## Out of scope for this plan

Phase C (push notification to the passenger when payment is requested) is deliberately a **separate follow-up plan**, written only after Task 9 is verified live. The driver's on-screen waiting state and Switch to cash cover its absence meanwhile. Also out: prepaid payment, refunds, PayMongo live mode, real driver payouts, and the other PayMongo fixes in tracker item Y3 beyond what Task 4 needs.

## Self-review notes

- **Spec coverage:** gate for cash and GCash (Tasks 1, 9); request GCash payment flow (Tasks 1, 3, 4, 6, 7); switch to cash with reasons and logging (Tasks 1, 3, 7); verify against PayMongo (Task 4, 6); already-paid handling and return-to-ride (Task 6); reconnect column list (Task 2); driver live "paid" (Task 7 step 3); booking block, settle card, restore (Tasks 6, 9); wording fix (Tasks 5, 7); phased rollout (Tasks 1, 8, 9); redirect-domain check from spec finding 10 is an open verification item for Task 8 step 3(a): confirm `https://trisakay.app/payment-complete` resolves, else change `CHECKOUT_SUCCESS_URL`/`CHECKOUT_CANCEL_URL` in `create-gcash-checkout` to the project's own address in the same Task 4 deploy.
- **Names checked across tasks:** `requestGcashPayment`, `switchPaymentToCash`, `getTransactionStatus`, `verifyGcashPayment`, `getUnpaidCompletedRide`, `subscribeToTripTransactions`, `UNPAID_RIDE_CUTOFF_ISO`, `SWITCH_TO_CASH_REASON_CODES`, `shouldOpenPaymentScreen`, `routeAfterPayment`, `paymentRequestedAt` / `payment_requested_at` are used consistently.

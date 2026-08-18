# Passenger ride history + payment history — design

**Date:** 2026-08-11
**Scope:** `apps/passenger` + a new `packages/services/src/trip-history` module + one new security-definer RPC. Corresponds to `docs/PASSENGER_TODO.MD` build-order item 8 / `docs/CHECKLIST.MD` P2 "Passenger: trip history → real query" and "Passenger: new Payment History screen."

## Problem

Two related gaps:
- `app/(tabs)/history.tsx` reads `useHistoryStore.rides`, which is seeded from an empty mock array and only ever grows via a fake `addRide()` call `payment.tsx` makes on payment success — nothing is fetched from `ride_requests`/`transactions`.
- `profile/payment-methods.tsx` is a static info page ("GCash — Available", "Cash — Available"). A real payment-history screen doesn't exist at all.

## What already exists

- RLS already lets a passenger read their own `ride_requests` and `transactions` rows directly (`rr_passenger_select`: `passenger_id = auth.uid()`; `txn_own_read`: via a subquery on `ride_requests.passenger_id`). No RPC is needed for the passenger's own fare/status/timestamp/payment data.
- A passenger has **no** direct RLS read on other users' `users` rows, so the driver's name still needs a security-definer RPC — the exact problem `get_trip_driver_info` and the driver app's `get_driver_trip_history` already solve. `get_driver_trip_history`'s live definition (read via MCP) is the direct template:
  ```sql
  create or replace function public.get_driver_trip_history(p_limit integer default 50)
  returns table (ride_request_id uuid, passenger_name text, status ride_status, fare numeric,
                 completed_at timestamptz, cancelled_at timestamptz, requested_at timestamptz)
  language plpgsql stable security definer set search_path to 'public'
  as $function$
  begin
    return query
    select rr.id, u.full_name, rr.status, coalesce(rr.final_fare, rr.estimated_fare),
           rr.completed_at, rr.cancelled_at, rr.requested_at
    from public.ride_requests rr
    join public.trips t on t.id = rr.trip_id
    join public.users u on u.id = rr.passenger_id
    where t.driver_id = auth.uid() and rr.status in ('completed', 'cancelled')
    order by coalesce(rr.completed_at, rr.cancelled_at, rr.requested_at) desc
    limit p_limit;
  end;
  $function$
  ```
- `ride_requests` already carries `pickup_label`/`dest_label` (used by `history.tsx`'s existing route subtitle) and `final_fare`/`estimated_fare`.
- `transactions` (`method`, `status: payment_status`, one row per `ride_request_id`, unique FK) already carries everything a payment-history row needs; it's only ever written for real by `create-gcash-checkout`/`paymongo-webhook` (GCash) or the driver's cash-confirm action — never by the passenger app itself.
- `apps/passenger/src/hooks/usePullToRefresh.ts` already exists (used by `apply-discount.tsx`) — `{ refreshing, onRefresh }` wrapping an async callback.
- `useHistoryStore.rides` is also read by `app/(tabs)/complaints.tsx` for its "related trip" picker — a real dependency, not dead code, even though complaint *submission* itself stays a `wait(600)` stub (item 9, out of scope here).

## New RPC — `get_passenger_trip_history`

Mirrors `get_driver_trip_history`, joins one level further for payment info:

```sql
create or replace function public.get_passenger_trip_history(p_limit integer default 50)
returns table (
  ride_request_id uuid,
  driver_name     text,
  pickup_label    text,
  dest_label      text,
  status          ride_status,
  fare            numeric,
  payment_method  payment_method,
  payment_status  payment_status,
  requested_at    timestamptz,
  completed_at    timestamptz,
  cancelled_at    timestamptz
)
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  return query
  select
    rr.id,
    u.full_name,
    rr.pickup_label,
    rr.dest_label,
    rr.status,
    coalesce(rr.final_fare, rr.estimated_fare),
    tx.method,
    tx.status,
    rr.requested_at,
    rr.completed_at,
    rr.cancelled_at
  from public.ride_requests rr
  left join public.trips t on t.id = rr.trip_id
  left join public.users u on u.id = t.driver_id
  left join public.transactions tx on tx.ride_request_id = rr.id
  where rr.passenger_id = auth.uid()
    and rr.status in ('completed', 'cancelled')
  order by coalesce(rr.completed_at, rr.cancelled_at, rr.requested_at) desc
  limit p_limit;
end;
$function$
```

Notes:
- `trips`/`users` joins are `left join`, not `join` — a ride cancelled before a driver was ever assigned has `trip_id is null`, and `get_driver_trip_history`'s inner joins (safe there, since a driver-owned row always has a matched trip) would incorrectly drop that row here.
- `transactions` join is also `left` — a cancelled-before-payment ride has no transaction row at all; `payment_method`/`payment_status` come back `null` in that case, which both consuming screens treat as "no payment info," not an error.
- Deployed live via Supabase MCP `apply_migration`, then documented in `docs/SCHEMA.MD` next to `get_trip_driver_info`/`get_driver_trip_history`.

## Service layer — `packages/services/src/trip-history/index.ts`

```ts
export type PassengerTripStatus = 'done' | 'cancelled';

export interface PassengerTripHistoryItem {
  id: string;
  driverName: string;
  pickup: string;
  dropoff: string;
  status: PassengerTripStatus;
  fare: number;
  date: string; // completed_at ?? cancelled_at ?? requested_at
  paymentMethod: 'cash' | 'gcash' | null;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' | null;
}

export interface ListPassengerTripHistoryResult {
  data: PassengerTripHistoryItem[];
  error: string | null;
}

export async function listPassengerTripHistory(limit = 50): Promise<ListPassengerTripHistoryResult>
```

- Calls `.rpc('get_passenger_trip_history', { p_limit: limit })`.
- Maps `status: 'completed' | 'cancelled'` → `'done' | 'cancelled'` (matching `history.tsx`'s existing filter vocabulary, same mapping the driver store already does).
- `driverName` falls back to `''` when `driver_name` is null (cancelled-before-assignment) — `history.tsx`/`complaints.tsx` already render `item.driverName || 'Driver'`.
- On RPC error, returns `{ data: [], error: error.message }` — same convention as `listDriverTripHistory`.
- Follows the `ratings`/`discount` module convention: no thrown exceptions, plain `{ data, error }` return.

## Store — `useHistoryStore` becomes async

Replaces the current `{ rides, addRide }` shape:

```ts
interface HistoryState {
  items: PassengerTripHistoryItem[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
}
```

`load()` calls `listPassengerTripHistory()`, sets `loading`/`error`/`items` — same shape as the driver app's `useHistoryStore.load()`. `src/mocks/rideHistory.ts` (the empty `seedRideHistory` array) is deleted; `items` starts as `[]` before the first `load()`.

**`addRide` is removed, not replaced.** `payment.tsx`'s `finishSuccessfulPayment()` currently synthesizes a fake row (`id: r-${Date.now()}`, driver name/fare from local state) to make the ride appear in history immediately. This is now redundant: `trip.tsx` only navigates to `payment.tsx` once `ride_requests.status` is already `'completed'` server-side (per item 6, already shipped), so `get_passenger_trip_history` already includes this ride the moment `history.tsx` next calls `load()` — no client-side synthesis needed, and keeping it would produce a duplicate, non-matching-id row once the real fetch lands. The `addRide(...)` call block in `payment.tsx` is deleted; `driver`/`dropoff` reads there that exist *only* to build that object are removed with it (confirmed via read: nothing else in `finishSuccessfulPayment` needs them).

## UI changes — `app/(tabs)/history.tsx`

- Read `{ items, loading, error, load }` from the store instead of `rides`.
- `useEffect(() => { load(); }, [])` on mount.
- `usePullToRefresh(load)` → `refreshing`/`onRefresh`, passed to `FlatList`'s `refreshControl` prop (`RefreshControl` from `react-native`, same import `apply-discount.tsx` already uses).
- First-load state: while `loading && items.length === 0`, show a centered `Spinner` instead of the list (matches `apply-discount.tsx`'s `loading` branch).
- `error` (non-null, from a failed `load()`): render inline error text above the list, list still renders with whatever `items` it has (don't blank the screen over a refresh failure).
- Filter logic (`all`/`done`/`cancelled`) unchanged, just operates on `items` instead of `rides`.

## UI changes — `app/(tabs)/complaints.tsx`

- Reads `items` (renamed from `rides`) from the same store.
- Adds its own `useEffect(() => { load(); }, [])` — this screen doesn't currently trigger any fetch of its own, and without this the "related trip" picker would silently stay empty forever unless the passenger happened to visit the History tab first in the same session. No other change; submission stays `wait(600)` (item 9).

## New screen — `app/profile/payment-history.tsx`

- Reads `{ items, loading, error, load }` from `useHistoryStore` (same store, no new fetch).
- Filters to `item.paymentStatus === 'paid' || item.paymentStatus === 'refunded'` — a `pending`/`failed`/`null` entry means the ride's payment never actually resolved (still mid-checkout elsewhere, or no transaction was ever created), which doesn't belong in a "history" list.
- Each row: date, route (`pickup → dropoff`, same omit-if-missing rule `history.tsx` already uses), fare, a method badge (`GCash`/`Cash`), and a status badge (`Paid` green / `Refunded` blue).
- Same loading/error/pull-to-refresh treatment as `history.tsx`.
- `ScreenHeader` + `EmptyState` ("No payments yet"), matching `apply-discount.tsx`/`payment-methods.tsx`'s existing screen shell conventions.

## UI changes — `app/profile/payment-methods.tsx`

Adds one new `ListRow` ("Payment history", chevron trailing) below the existing GCash/Cash rows, navigating to `/profile/payment-history`.

## Out of scope (explicitly deferred)

- Item 9 (complaint submission wiring) — `complaints.tsx` only gets the `load()` safety net above, not a real `complaints` insert.
- Pagination past `p_limit = 50` — matches the driver app's own history RPC, not revisited here.
- Any change to `transactions`/`ride_requests` writes — this item is read-only.

## Testing

New `packages/services/tests/trip-history.test.ts` (mocked Supabase client, matching `ratings.test.ts`/`payments.test.ts` style):
- `listPassengerTripHistory` maps a full RPC row (with driver, payment info) correctly.
- Maps a row with `driver_name`/`payment_method`/`payment_status` all `null` (cancelled-before-assignment, no transaction) without throwing.
- `status: 'completed'` → `'done'`, `status: 'cancelled'` → `'cancelled'`.
- RPC error returns `{ data: [], error: error.message }`.

No component-level test harness exists for passenger screens (established pattern from the rate-driver work) — `history.tsx`/`complaints.tsx`/`payment-history.tsx` changes are verified via `npm run typecheck` plus manual review, not a new screen test.

# Ride Request & Matching Flow — Audit (2026-08-30)

Audit of the passenger request → matching → trip → payment → rating flow against `docs/CONTEXT.MD` (FR-2, FR-3, FR-9, FR-10) and the user-described flow. Read-only investigation, no code changed. Re-open and update this file as gaps are fixed or re-checked.

## Status legend
- ✅ Implemented as spec
- ⚠️ Implemented differently / partially
- ❌ Not implemented

## 1. Pickup + destination selection, fare/distance estimate — ✅
- `apps/passenger/app/booking/set-pickup.tsx`, `set-destination.tsx` — map tap/drag pin + text search (Nominatim, 450ms debounce).
- `apps/passenger/app/booking/confirm.tsx:76-107` — fetches route, then `estimateFare()`; Request button disabled until fare resolves.
- Fare computed server-side only: `packages/services/src/fare/index.ts:16-23` → RPC `compute_fare` (`docs/SCHEMA.MD:786-816`), ₱15/≤4km + ₱1/km beyond × seats, with discount branch.

## 2. Payment method selection (cash vs GCash) — ✅
- `confirm.tsx:301-311` — segmented control, stored in booking store, passed to `createRideRequest`.
- Cash skips PayMongo entirely; GCash checkout only invoked later from `payment.tsx:121` when `paymentMethod === 'gcash'`.

## 3. "Request ride" → DB insert / match trigger — ⚠️
- `createRideRequest()` (`packages/services/src/booking/index.ts:24-46`) inserts into `ride_requests`, status defaults to `pending`.
- No explicit "start matching" call from the passenger. Matching only runs when a **driver's** client re-invokes `match-ride-request`, triggered by a debounced (500ms) Realtime subscription on `ride_requests` (`booking/index.ts:356-367`). The passenger's insert doesn't push/notify drivers directly.

## 4. Matching logic (`supabase/functions/match-ride-request/index.ts`) — ⚠️
- Hard filter: `isClusterAuthorized()` (lines 91-100) implements Ord. 37 cluster rule, but **is currently a no-op** — `pickup_barangay_id` is never populated on request creation (self-documented in file header, lines 9-17), so every request passes the null-barangay branch.
- Soft filter: bearing/detour heuristic (lines 205-234) using `bearing_tolerance_deg`, `detour_ratio_max`, `search_radius_km` from `system_settings`. This is a **single fixed radius**, not an expanding-radius scan.
- Invocation is **pull/poll-based** (driver client calls the function on Realtime change), not a server-initiated broadcast — a deliberate scope trim, documented in the function's own header (lines 27-33), but a departure from `CONTEXT.MD §9`'s "pushes results via Realtime."

## 5. Passenger's "waiting for match" screen — ⚠️
- `apps/passenger/app/booking/finding-driver.tsx` shows only the passenger's own pickup pin + a pulsing search animation. No candidate/available-driver markers are ever rendered (consistent with NFR-2.5's "no pre-match driver visibility," but there's no scanning-radius visualization either).

## 6. Driver availability toggle / location transmission — ⚠️
- `apps/driver/app/(tabs)/dashboard.tsx:80-95` — one-time GPS fix captured only when toggling online; `packages/services/src/location/index.ts:34-54` writes it once.
- **No `watchPositionAsync`/background location task anywhere in `apps/driver`** — location never updates again while online or during an active ride. Matching heuristic uses this same stale snapshot for every match attempt until the driver re-toggles.

## 7. Driver receiving ride requests — ⚠️
- Dashboard shows one incoming request at a time with Accept/Decline + countdown (`dashboard.tsx:77-78, 233-263`).
- Requests tab (`apps/driver/app/(tabs)/requests.tsx`) lists all pending requests, each accepted independently — not the FR-2.5a/b "declare direction, multi-select up to seat capacity, then depart" batch flow.
- Mid-trip pickup (FR-2.5c) **is** implemented: `apps/driver/app/trip/active.tsx:29-37, 183-205` keeps the board live during an active trip, capacity-enforced server-side.

## 8. Driver accept → passenger notification → live tracking — ⚠️ (biggest gap)
- Accept is race-safe: `acceptRideRequest()` (`booking/index.ts:149-230`) guards on `.eq('status','pending')`, returns a clear error on lost race.
- Passenger picks up the `assigned` status via Realtime (`finding-driver.tsx:62-80`), fetches driver info via `getTripDriverInfo()` RPC.
- **No live driver marker, no route polyline, no ETA on `booking/trip.tsx`.** `finding-driver.tsx:56` hardcodes `etaMinutes: null`, so the ETA badge in `DriverInfoCard` can never render. No Realtime subscription to driver location exists on this screen at all — and even if it did, there's nothing to subscribe to per point 6.
- **Driver photo dropped**: `getTripDriverInfo()` returns `avatarUrl` (`booking/index.ts:538`), but `finding-driver.tsx:51-57` discards it, and the passenger's `Driver` type has no such field. `DriverInfoCard` renders initials only. FR-2.9 ("name, photo, plate") is two-thirds delivered.

## 9. "Confirm passenger picked up" vs "start ride" — ❌
- `ride_status` enum defines `ongoing` (`docs/SCHEMA.MD:103-109`) between `assigned` and `completed`, but **no code path ever sets it**. `complete_ride_leg` goes straight `assigned` → `completed`. No "picked up"/"start trip" button exists anywhere in `apps/driver` — only per-passenger Complete/Cancel on `trip/active.tsx:158-178`.

## 10. Trip completion — cash confirm / GCash webhook — ✅
- Cash: `trip/active.tsx:145-156` — "Confirm cash received" toggle gates the Complete button (`active.tsx:126`); scoped UPDATE relies on RLS policy `txn_driver_confirm_cash`. Matches FR-9.9.
- GCash: only `paymongo-webhook/index.ts:94-119` sets `status='paid'`, gated on verified signature + `.eq('status','pending')`. Passenger's `payment.tsx` only reacts to the Realtime change — never trusts a client-side signal. Matches FR-9.2.

## 11. Post-completion summary + rating — ⚠️
- No distinct "trip complete" success screen — `trip.tsx:53-58` routes straight to `/booking/payment`, which routes straight to `/booking/rate-driver` (`payment.tsx:98-104`) once paid. The amount-due card in `payment.tsx` is the closest thing to a summary.
- `rate-driver.tsx` — 1-5 stars + optional comment, `submitRating()` writes to `ratings` with proper RLS/trigger enforcement (`validate_rating()`, `trg_ratings_refresh`). One-directional only, confirmed. Matches FR-10.1/10.2.

---

## Prioritized fix list

| # | Gap | Priority |
|---|---|---|
| 1 | No live driver location updates after going online (single stale GPS snapshot) | **P0 — blocks #2** |
| 2 | No live driver tracking / route / ETA on passenger trip screen | **P0** |
| 3 | `ongoing` status dead — no "confirm pickup" / "start ride" step | **P0** |
| 4 | Driver photo dropped in passenger UI | P1 |
| 5 | Matching is poll-based (driver-client-invoked), not server-pushed | P2 (documented scope trim, revisit if NFR-1 5-10s SLA is missed under load) |
| 6 | Cluster hard-filter is a no-op (no barangay resolution on request insert) | P2 (documented interim compromise) |
| 7 | No multi-select "request board" batch-accept UX (FR-2.5a/b) | P2 (pooling still achieved via one-at-a-time accept) |
| 8 | No distinct trip-summary/success screen before rating | P3 |

**This session is fixing #1, #2, #3** (live driver tracking + the dead `ongoing` status) as the highest-priority, most user-visible gaps.

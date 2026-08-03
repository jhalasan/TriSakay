# Driver App — Build Backlog

**Scope:** `apps/driver` only (plus the shared `packages/*` it needs). Written 2026-08-03 against a fresh code survey; the database side is already applied and live (see `docs/SCHEMA.MD`'s header note) — nothing here is blocked on schema work.

Cross-reference: `docs/CONTEXT.MD` §7 (Driver App feature list), FR-1 (verification), FR-2.5a–e (request board / mid-trip pickup), FR-9.6/9.9 (earnings, cash confirmation), FR-10 (ratings), FR-11 (consent/location). `docs/PASSENGER_TODO.MD` is the sibling doc and the pattern this one follows.

---

## Where things actually stand

**Driver app: still the stock template.** `apps/driver/src/App.tsx` renders a static "Driver App" / `getAppName('driver')` placeholder and nothing else — no `expo-router`, no navigation, no screens, no stores, no Supabase client wiring. `apps/driver/package.json` only has bare `expo`/`react`/`react-native` — none of the dependencies the passenger app needed to go from template to real app: `expo-router`, `zustand`, `react-hook-form`, `zod`, `expo-location`, `expo-image-picker`, `@react-native-async-storage/async-storage`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-safe-area-context`, `react-native-screens`, `react-native-svg`, Poppins fonts, or the `@trisakay/services`/`@trisakay/ui` workspace deps.

**Reusable as-is from `packages/*`:**
- `packages/services/src/supabase` (client), `storage` (`uploadAvatar` pattern), `notifications`/`location` stubs — same shape driver needs.
- `packages/ui` — design tokens (`colors`, `fontFamily`) and `OsmMap`.
- `packages/utils` — `haversineDistanceKm`, etc.

**Needs extension before driver can use it:**
- `packages/services/src/auth/index.ts` — `signUp()` **hardcodes `role: 'passenger'`** in the signup metadata (line 32). A driver cannot register at all until this is parameterized (or a `signUpDriver` added).
- `packages/services/src/booking/index.ts` — currently just `export const bookingServiceStatus = 'Booking service ready'`. Nothing exists yet for availability toggle, request-board queries, accept/decline, or trip start/complete — this is where most of the driver-specific service logic will land.

**Database/backend: ready, not a blocker.** `driver_profiles`, `tricycles`, `driver_documents`, `trips`, `ride_requests`, `ratings`, `transactions`, `complaints`, `complaint_attachments`, `notifications`, `user_consents`, `account_actions` all exist with RLS already scoped to the `driver` role (`docs/SCHEMA.MD` §7.2–7.8). Triggers already enforce: driver can't go available until verified (`trg_driver_verified_before_available`), location is cleared on going offline (`trg_driver_clear_location`), seat capacity (`trg_ride_requests_seat_cap`).

---

## Build order

Ordered by dependency, same convention as `docs/PASSENGER_TODO.MD`'s table.

| # | Item | Notes |
|---|---|---|
| 0 | **Foundations.** Bring `apps/driver` up to the passenger app's base: add `expo-router` (switch `package.json` `main` to `expo-router/entry`), `zustand`, `react-hook-form`, `zod`, `expo-location`, `expo-image-picker`, `async-storage`, `gesture-handler`, `reanimated`, `safe-area-context`, `screens`, `svg`, Poppins fonts, `@trisakay/services` + `@trisakay/ui` + `@trisakay/utils`. Create `app/` route structure mirroring passenger's `(auth)/`, `(tabs)/` grouping. Add `.env.example`, extend `tests/sample.test.js` pattern. | config only |
| 1 | **Auth service fix + Registration/Login.** Parameterize `signUp()`'s role (or add a driver-specific signup) before anything else can work — this is the actual first blocker. | `packages/services/src/auth`, new `app/(auth)/` |
| 2 | **ToS/Privacy consent gate (FR-11.1–11.3, UC45).** Reuse the passenger's `useConsentStore` + `consents` service pattern verbatim — same `user_consents` table, applies to all roles identically. | `app/consent.tsx`, store |
| 3 | **Location permission gate (FR-11.4–11.5, UC46).** Same `useLocationPermission` hook pattern as passenger. Higher stakes here than for passenger: availability toggle (below) is meaningless without a live GPS fix. | `app/location-permission.tsx`, hook |
| 4 | **Profile + Document upload (FR-1.4).** Driver's license, OR/CR, franchise permit, tricycle photo → `driver_documents` + `tricycles`. New private storage bucket, same pattern as passenger's `discount-ids` bucket (owner + PSO-read RLS). | new screens, `driver_documents`, `tricycles` |
| 5 | **Verification status tracking (FR-1.5–1.6).** Read-only view of `driver_profiles.verification_status` / per-document status. Enforcement already exists server-side (`trg_driver_verified_before_available`); UI just needs to make the barred state legible ("pending review", "rejected — remarks: …"). | `driver_profiles`, `driver_documents` |
| 6 | **Availability toggle (FR-2.6).** `is_available` flag + live GPS write to `current_lat`/`current_lng` while online only. Privacy behavior (clear on going offline, never a trail) is already trigger-enforced — don't re-implement it client-side, just don't fight it. | `driver_profiles` |
| 7 | **Request Board (FR-2.5a/b, UC20–21).** Query pending `ride_requests` compatible with the driver's declared direction; multi-select up to seat capacity. Real matching depends on the `match-ride-request` Edge Function, which **does not exist anywhere in the repo yet** — see open item #1 below. Can build the board UI against a naive query first and swap the query source later. | `ride_requests`, `trips` |
| 8 | **Accept/decline + start trip (FR-2.5d, FR-2.8, UC22–23).** Writes `trips` (status → `active`) and `ride_requests.status` (→ `assigned`/`ongoing`). | `trips`, `ride_requests` |
| 9 | **Passenger info view.** Post-match: matched passenger's name/photo only — no contact/messaging (out of scope per FR-2.9/Wireframe Kit Review §11 item 1). | `users`, `ride_requests` |
| 10 | **Mid-trip pickup (FR-2.5c).** Surface new compatible requests once a trip is active, subject to remaining seats. Seat-capacity enforcement is already trigger-side (`trg_ride_requests_seat_cap`). | `ride_requests` |
| 11 | **Trip completion + cash confirmation (FR-9.9, UC24).** The "Confirm cash received" step explicitly called out as missing from the wireframe kit (`docs/CONTEXT.MD` §11 item 4). Writes `transactions.status = 'paid'` with `cash_confirmed_by`; GCash path is webhook-only and doesn't need a driver-side write. | `transactions`, `trips` |
| 12 | **Trip history.** Mirrors passenger's `history.tsx` pattern — own completed/cancelled trips. | `trips`, `ride_requests` |
| 13 | **Earnings (simulated, FR-9.6).** Read from `v_driver_earnings` view. Keep UI copy strictly "tracked/simulated" — never "payout" or "withdraw" (the exact wording trap flagged for the wireframe kit, §11 item 2; no real disbursement exists anywhere in the system). | `v_driver_earnings` (view) |
| 14 | **View own ratings (FR-10.2–10.3).** `rating_avg`/`rating_count` plus the list of individual ratings/comments received. | `ratings`, `driver_profiles` |
| 15 | **Complaint submission/management (FR-4.1–4.2).** Same `complaints`/`complaint_attachments` tables and pattern as passenger's `complaints.tsx`. | `complaints`, `complaint_attachments` |
| 16 | **Notifications (FR-7).** Same `notifications` table + Realtime subscription pattern as passenger. Driver additionally cares about `verification_status` and `payment_status` (cash-confirm) notification types. | `notifications` |
| 17 | **Logout.** Trivial, mirrors passenger's `logout.tsx`. | — |
| 18 | **`eas.json` + internal distribution build.** Shared concern with passenger (CONTEXT §3) — neither app has one yet; can likely be done once for both. | config |

---

## Open decisions / cross-app blockers (flagged, not resolved)

1. **`match-ride-request` Edge Function does not exist anywhere in the repo yet.** It's required for both stages of FR-2.5 (cluster-authorization hard filter + bearing/detour heuristic) and is what makes the Request Board (#7) and Mid-trip pickup (#10) real instead of a naive client-side query. This is the single biggest blocker shared between the driver and passenger apps — worth prioritizing over polishing either app's UI further.
2. **`gcash-webhook` Edge Function also doesn't exist.** Blocks the GCash path on both apps equally. Driver-side exposure is limited to cash confirmation (#11), so this can be deferred longer for the driver app's first build pass than for the passenger app's.
3. **Map reuse for the Request Board.** Passenger's `OsmMap` (Leaflet/WebView) can likely be reused as-is for a driver map view, but rendering multiple pending-request pins on a board is new UI, not just wiring — don't assume it's a drop-in.
4. **MapLibre vs. Leaflet/WebView divergence** (same one `docs/PASSENGER_TODO.MD` #1 flags for CONTEXT §3) applies identically here the moment the driver app adds any map view.

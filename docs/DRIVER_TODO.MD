# Driver App — Build Backlog

**Scope:** `apps/driver` only (plus the shared `packages/*` it needs). Originally written 2026-08-03 against a fresh code survey when `apps/driver` was still the stock template; **updated 2026-08-04** after the UI/navigation build (`docs/superpowers/plans/2026-08-03-driver-app-ui.md`, 24 tasks + a final-review fix wave) merged to `main`; **updated again 2026-08-10** after re-checking every item live against the current code — verification-status reading, the availability toggle, the request board, and accept/complete/cancel trip are all real now (items #5–#8 below), and the `match-ride-request`/`paymongo-webhook` Edge Functions this doc previously called missing have both been deployed and verified live since 2026-08-05/07. The database side has been live since before this doc was first written (see `docs/SCHEMA.MD`'s header note) — nothing here is blocked on schema work.

Cross-reference: `docs/CONTEXT.MD` §7 (Driver App feature list), FR-1 (verification), FR-2.5a–e (request board / mid-trip pickup), FR-9.6/9.9 (earnings, cash confirmation), FR-10 (ratings), FR-11 (consent/location). `docs/PASSENGER_TODO.MD` is the sibling doc. `docs/superpowers/specs/2026-08-03-driver-app-ui-design.md` is the design spec the UI build followed.

---

## Where things actually stand (updated 2026-08-10)

**All 14 wireframe screens exist and are navigable end-to-end**, built to match `apps/passenger`'s design system and patterns exactly (Poppins fonts, `packages/ui` components, expo-router structure, per-screen Zustand stores). Typecheck clean, 17 driver-side tests passing. What's real vs. mock, precisely:

**Genuinely real, backend-wired (writes to live Supabase, same project as passenger — `ygdgbvxxqrkxlezpckif`):**
- Registration & login (`app/(auth)/login.tsx`, `register.tsx`) — real `auth.signUp`/`signInWithPassword`, now correctly passing `role: 'driver'` (the old hardcoded-`'passenger'` bug is fixed).
- ToS/Privacy consent gate (`app/consent.tsx`) — writes real rows to `user_consents`, identical mechanism to passenger.
- Location permission gate (`app/location-permission.tsx`) — real `expo-location` foreground permission flow.
- Profile name edit (`app/(tabs)/profile.tsx`) — real `updateProfile()` write to `public.users`, with a `refreshProfile()` call so the Dashboard greeting doesn't go stale after a rename.
- Verification-status gate (`app/verification-pending.tsx`, `useVerificationStore`) — real read of `driver_profiles.verification_status`, gates app entry with pending/rejected-specific copy. **Remaining gap:** no persistent "Verified" indicator once approved — Profile has nowhere that shows it.
- Availability toggle (`useDriverStore.setAvailable`) — real write to `driver_profiles.is_available`/`current_lat`/`current_lng` via `updateDriverAvailability()`, including a one-time GPS fix on going online. The two verification/tricycle trigger rejections are translated into driver-facing copy. **Known bug (undocumented until now):** `isAvailable` initializes to `false` in memory on every app boot and is never read back from `driver_profiles.is_available` — if the app restarts while the driver was online, the backend still shows them available and matchable, but the UI shows "Offline" and never re-subscribes to the request board, so an assigned ride can go unseen. Not yet fixed.
- Request board (`useRequestsStore.subscribe`) — real: calls the `match-ride-request` Edge Function and holds a live Realtime subscription on `ride_requests`, not a client-side timer. (Inherits the bug above — subscribe only fires from the manual toggle handler, never on mount.)
- Accept / complete / cancel trip (`useRequestsStore.accept`, `useTripStore.complete`/`cancel`) — real writes to `trips`/`ride_requests` via `acceptRideRequest()`/`completeTrip()`/`cancelTrip()`.

**Still local/mock — nothing below reads or writes `driver_documents`, `transactions`, `ratings`, `complaints`, or `notifications` yet, and two trip-flow pieces are still local state:**
- `useTripStore.startTrip` — pure local UI state (there's no separate backend "start" step to wire it to; arguably fine as-is).
- `useTripStore.confirmCash` — local toggle only; no `transactions.status='paid'`/`cash_confirmed_by` write yet.
- `useHistoryStore` / `useEarningsStore` — trip history and earnings are local state seeded by completed trips in-session; nothing reads `trips`/`ride_requests`/`v_driver_earnings`.
- `useDocumentsStore` — the Documents & Tricycle screen's upload flow flips a local status flag; nothing is actually uploaded to Storage or written to `driver_documents`/`tricycles`.
- `useComplaintsStore` / `useNotificationsStore` — same pattern, local only.
- Profile's rating display reads `useDriverStore.rating`/`ratingCount`, which nothing ever populates from `driver_profiles.rating_avg`/`ratings`.
- Passenger info on an active trip is still hardcoded `null` (`useTripStore.startTrip` never receives a real name/photo) — no join happens yet.

**Database/backend: ready, still not a blocker.** `driver_profiles`, `tricycles`, `driver_documents`, `trips`, `ride_requests`, `ratings`, `transactions`, `complaints`, `complaint_attachments`, `notifications`, `user_consents`, `account_actions` all exist with RLS already scoped to the `driver` role (`docs/SCHEMA.MD` §7.2–7.8). Triggers already enforce: driver can't go available until verified (`trg_driver_verified_before_available`), location is cleared on going offline (`trg_driver_clear_location`), seat capacity (`trg_ride_requests_seat_cap`).

---

## Build order (backend wiring — the actual remaining work)

Every item below now starts from "screen exists, reads/writes a local store" rather than "screen doesn't exist." The UI-building step from the old version of this table is done for all of them.

| # | Item | Notes |
|---|---|---|
| 4 | **Document upload → real Storage + `driver_documents`/`tricycles`.** `app/profile/documents.tsx` exists; swap `useDocumentsStore` for real `expo-image-picker` → Storage upload → `driver_documents` insert, mirroring passenger's `discount-ids` bucket pattern (owner + PSO-read RLS). Needs a new private bucket (e.g. `driver-docs`). | `apps/driver/src/store/useDocumentsStore.ts`, new storage bucket, `driver_documents`, `tricycles` |
| 5 | ~~Verification status tracking (FR-1.5–1.6)~~ — **done.** `verification-pending.tsx` + `useVerificationStore` read `driver_profiles.verification_status` for real. **Still open:** no persistent "Verified" indicator on Profile once approved — small follow-up, not tracked as its own line before now. | `driver_profiles` |
| 6 | ~~Availability toggle → real `driver_profiles` write (FR-2.6)~~ — **done.** `setAvailable()` writes real `is_available`/`current_lat`/`current_lng`; trigger rejections surface as driver-facing copy. **Bug found 2026-08-10, not yet fixed:** `isAvailable` never hydrates from the backend on app boot, so a restart while online leaves the driver silently unreachable for new matches (UI shows "Offline", backend still shows available) — see the note in "Where things actually stand" above. | `driver_profiles` |
| 7 | ~~Request Board → real query (FR-2.5a/b, UC20–21)~~ — **done.** `useRequestsStore.subscribe()` calls the live `match-ride-request` Edge Function plus a Realtime subscription on `ride_requests` — no simulated-timer code remains. Inherits item 6's hydration bug (subscription only starts from the toggle handler, never on mount). | `ride_requests`, `trips` |
| 8 | ~~Accept/decline + start trip → real writes (FR-2.5d, FR-2.8, UC22–23)~~ — **mostly done.** Accept (`acceptRideRequest`), complete (`completeTrip`), and cancel (`cancelTrip`) all write real `trips`/`ride_requests` rows. `startTrip()` stays local UI state only (no separate backend "start" step exists to wire it to — likely fine as-is, not a gap). | `trips`, `ride_requests` |
| 9 | **Passenger info view.** Post-match: matched passenger's real name/photo via `ride_requests`/`users` join, not the always-`null` `passengerName` local field. No contact/messaging (out of scope per FR-2.9). | `users`, `ride_requests` |
| 10 | **Mid-trip pickup (FR-2.5c).** Surface new compatible requests once a trip is active, subject to remaining seats. Seat-capacity enforcement is already trigger-side (`trg_ride_requests_seat_cap`). No UI for this exists yet at all (out of scope for the wireframe-matching pass) — this is new screen work, not just a wiring swap. | `ride_requests` |
| 11 | **Cash confirmation → real write (FR-9.9, UC24).** Trip completion/cancellation itself is now real (item 8); what's still open is `app/trip/active.tsx`'s "Confirm cash received" toggle (`useTripStore.confirmCash`) — swap its local-only flip for a real `transactions.status = 'paid'` write with `cash_confirmed_by`. GCash path is webhook-only, no driver-side write needed. | `transactions` |
| 12 | **Trip history → real read.** `app/(tabs)/history.tsx` exists; swap `useHistoryStore` for a real query over the driver's own completed/cancelled trips. | `trips`, `ride_requests` |
| 13 | **Earnings → real read (simulated settlement, FR-9.6).** `app/(tabs)/earnings.tsx` exists; swap `useEarningsStore` for a read from `v_driver_earnings`. Keep UI copy strictly "tracked/simulated" — already enforced in the current copy, don't let real wiring introduce "payout"/"withdraw" wording. | `v_driver_earnings` (view) |
| 14 | **View own ratings (FR-10.2–10.3).** Profile's `StarRating` already has the correct empty-until-`ratingCount>0` gating logic; swap the local `useDriverStore.rating`/`ratingCount` for a real read of `driver_profiles.rating_avg`/`rating_count` + `ratings`. | `ratings`, `driver_profiles` |
| 15 | **Complaint submission/management → real write (FR-4.1–4.2).** `app/complaints.tsx` and `useComplaintsStore` exist (already fixed to persist across navigation, still local-only); swap for real `complaints`/`complaint_attachments` writes. | `complaints`, `complaint_attachments` |
| 16 | **Notifications → real read (FR-7).** `app/notifications.tsx` exists; swap `useNotificationsStore` for a real `notifications` table read + Realtime subscription. Driver additionally cares about `verification_status` and `payment_status` (cash-confirm) notification types. | `notifications` |
| 17 | ~~Logout~~ — **done**, real (`app/logout.tsx`). |  |
| 18 | **`eas.json` + internal distribution build.** Shared concern with passenger (CONTEXT §3) — neither app has one yet; can likely be done once for both. | config |

---

## Open decisions / cross-app blockers (flagged, not resolved)

1. ~~`match-ride-request` Edge Function does not exist anywhere in the repo yet~~ — **resolved.** Deployed and live since 2026-08-05 (`supabase/functions/match-ride-request/index.ts`), implementing the FR-2.5 cluster-authorization hard filter + seat capacity, with the bearing/detour soft filter falling back to hard-filter-only until driver GPS is populated (now is, via item #6). Request Board (#7) is wired to it for real; Mid-trip pickup (#10) still needs its own screen built.
2. ~~`gcash-webhook` Edge Function also doesn't exist~~ — **resolved.** Renamed `paymongo-webhook`, deployed alongside `create-gcash-checkout`, and verified end-to-end live (real PayMongo test-mode GCash payment, webhook delivery confirmed) on 2026-08-07. Driver-side exposure is still limited to cash confirmation (#11), which remains open.
3. **Map reuse for the Request Board.** Passenger's `OsmMap` (Leaflet/WebView) can likely be reused as-is for a driver map view, but rendering multiple pending-request pins on a board is new UI, not just wiring — don't assume it's a drop-in. `app/trip/active.tsx` already reuses `OsmMap` for the single-trip route view.
4. **MapLibre vs. Leaflet/WebView divergence** (same one `docs/PASSENGER_TODO.MD` #1 flags for CONTEXT §3) applies identically here.
5. **New: driver test accounts require manual email confirmation right now.** The live Supabase project has "Confirm email" enabled and a low built-in email-send rate limit, so creating test driver accounts via the Register screen is currently friction-prone (confirmation email required, rate limit hit easily during repeated testing). Either disable "Confirm email" in the dashboard for dev convenience, or use the `service_role` key for one-off pre-confirmed test-account creation. Not a blocker for further development, but worth resolving before QA/demo prep.

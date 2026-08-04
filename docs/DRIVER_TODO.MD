# Driver App — Build Backlog

**Scope:** `apps/driver` only (plus the shared `packages/*` it needs). Originally written 2026-08-03 against a fresh code survey when `apps/driver` was still the stock template; **updated 2026-08-04** after the UI/navigation build (`docs/superpowers/plans/2026-08-03-driver-app-ui.md`, 24 tasks + a final-review fix wave) merged to `main`. The database side has been live since before this doc was first written (see `docs/SCHEMA.MD`'s header note) — nothing here is blocked on schema work.

Cross-reference: `docs/CONTEXT.MD` §7 (Driver App feature list), FR-1 (verification), FR-2.5a–e (request board / mid-trip pickup), FR-9.6/9.9 (earnings, cash confirmation), FR-10 (ratings), FR-11 (consent/location). `docs/PASSENGER_TODO.MD` is the sibling doc. `docs/superpowers/specs/2026-08-03-driver-app-ui-design.md` is the design spec the UI build followed.

---

## Where things actually stand (updated)

**All 14 wireframe screens exist and are navigable end-to-end**, built to match `apps/passenger`'s design system and patterns exactly (Poppins fonts, `packages/ui` components, expo-router structure, per-screen Zustand stores). Typecheck clean, 16 driver-side tests passing, whole-branch review clean. What's real vs. mock, precisely:

**Genuinely real, backend-wired (writes to live Supabase, same project as passenger — `ygdgbvxxqrkxlezpckif`):**
- Registration & login (`app/(auth)/login.tsx`, `register.tsx`) — real `auth.signUp`/`signInWithPassword`, now correctly passing `role: 'driver'` (the old hardcoded-`'passenger'` bug is fixed).
- ToS/Privacy consent gate (`app/consent.tsx`) — writes real rows to `user_consents`, identical mechanism to passenger.
- Location permission gate (`app/location-permission.tsx`) — real `expo-location` foreground permission flow.
- Profile name edit (`app/(tabs)/profile.tsx`) — real `updateProfile()` write to `public.users`, with a `refreshProfile()` call so the Dashboard greeting doesn't go stale after a rename.

**UI is fully built and interactive, but every domain store is local/in-memory only — nothing below reads or writes `driver_profiles`, `tricycles`, `driver_documents`, `trips`, `ride_requests`, `transactions`, `ratings`, `complaints`, or `notifications` yet:**
- `useDriverStore` — availability toggle and today's stats are local state, not `driver_profiles.is_available`/GPS columns.
- `useRequestsStore` — the "pending requests" board is populated by a client-side timer (`startSimulatingArrivals`), not a real query against `ride_requests`.
- `useTripStore` / `useHistoryStore` / `useEarningsStore` — active trip, trip history, and earnings are all local state seeded by the simulated requests above; nothing touches `trips`, `ride_requests`, or `transactions`.
- `useDocumentsStore` — the Documents & Tricycle screen's upload flow flips a local status flag; nothing is actually uploaded to Storage or written to `driver_documents`/`tricycles`.
- `useComplaintsStore` / `useNotificationsStore` — same pattern, local only.
- Profile's rating display reads `useDriverStore` (always empty/hidden), not `driver_profiles.rating_avg`/`ratings`.

This was a deliberate, approved scope decision for that build pass (UI-first, mirroring how `apps/passenger` itself was built) — not an oversight. It means the app is fully clickable for demo/UX purposes right now, but no driver action in it persists anywhere except auth/consent/profile-name.

**Database/backend: ready, still not a blocker.** `driver_profiles`, `tricycles`, `driver_documents`, `trips`, `ride_requests`, `ratings`, `transactions`, `complaints`, `complaint_attachments`, `notifications`, `user_consents`, `account_actions` all exist with RLS already scoped to the `driver` role (`docs/SCHEMA.MD` §7.2–7.8). Triggers already enforce: driver can't go available until verified (`trg_driver_verified_before_available`), location is cleared on going offline (`trg_driver_clear_location`), seat capacity (`trg_ride_requests_seat_cap`).

---

## Build order (backend wiring — the actual remaining work)

Every item below now starts from "screen exists, reads/writes a local store" rather than "screen doesn't exist." The UI-building step from the old version of this table is done for all of them.

| # | Item | Notes |
|---|---|---|
| 4 | **Document upload → real Storage + `driver_documents`/`tricycles`.** `app/profile/documents.tsx` exists; swap `useDocumentsStore` for real `expo-image-picker` → Storage upload → `driver_documents` insert, mirroring passenger's `discount-ids` bucket pattern (owner + PSO-read RLS). Needs a new private bucket (e.g. `driver-docs`). | `apps/driver/src/store/useDocumentsStore.ts`, new storage bucket, `driver_documents`, `tricycles` |
| 5 | **Verification status tracking (FR-1.5–1.6).** No screen currently reads `driver_profiles.verification_status` at all — Profile just shows the always-empty local rating. Add a real read (and ideally realtime subscription) so a driver can see "pending review" / "rejected — remarks: …". Enforcement is already server-side (`trg_driver_verified_before_available`); this is purely making the barred state legible. | `driver_profiles`, `driver_documents` |
| 6 | **Availability toggle → real `driver_profiles` write (FR-2.6).** Dashboard's toggle currently only flips local `useDriverStore.isAvailable`. Wire it to write `is_available` + live `current_lat`/`current_lng` while online. The privacy behavior (clear on going offline, never a trail) is already trigger-enforced server-side — don't reimplement it client-side. This will immediately start failing with a clear Postgres error for any unverified test driver, which is correct (`trg_driver_verified_before_available`) — item 5 has to land first for a smooth test flow. | `driver_profiles` |
| 7 | **Request Board → real query (FR-2.5a/b, UC20–21).** Replace `useRequestsStore`'s simulated-arrival timer with a real query against pending `ride_requests`. Real matching still depends on the `match-ride-request` Edge Function (open item #1 below) — can start with a naive "all pending in my cluster" query and swap the source later. | `ride_requests`, `trips` |
| 8 | **Accept/decline + start trip → real writes (FR-2.5d, FR-2.8, UC22–23).** `app/trip/active.tsx` exists and already has the right client-side orchestration shape (accept → startTrip → navigate); swap the local `useTripStore.startTrip`/`complete`/`cancel` bodies for real `trips`/`ride_requests` writes. | `trips`, `ride_requests` |
| 9 | **Passenger info view.** Post-match: matched passenger's real name/photo via `ride_requests`/`users` join, not the always-`null` `passengerName` local field. No contact/messaging (out of scope per FR-2.9). | `users`, `ride_requests` |
| 10 | **Mid-trip pickup (FR-2.5c).** Surface new compatible requests once a trip is active, subject to remaining seats. Seat-capacity enforcement is already trigger-side (`trg_ride_requests_seat_cap`). No UI for this exists yet at all (out of scope for the wireframe-matching pass) — this is new screen work, not just a wiring swap. | `ride_requests` |
| 11 | **Trip completion + cash confirmation → real write (FR-9.9, UC24).** `app/trip/active.tsx`'s "Confirm cash received" toggle and Complete/Cancel flow already exist and are UI-correct; swap for a real `transactions.status = 'paid'` write with `cash_confirmed_by`. GCash path is webhook-only, no driver-side write needed. | `transactions`, `trips` |
| 12 | **Trip history → real read.** `app/(tabs)/history.tsx` exists; swap `useHistoryStore` for a real query over the driver's own completed/cancelled trips. | `trips`, `ride_requests` |
| 13 | **Earnings → real read (simulated settlement, FR-9.6).** `app/(tabs)/earnings.tsx` exists; swap `useEarningsStore` for a read from `v_driver_earnings`. Keep UI copy strictly "tracked/simulated" — already enforced in the current copy, don't let real wiring introduce "payout"/"withdraw" wording. | `v_driver_earnings` (view) |
| 14 | **View own ratings (FR-10.2–10.3).** Profile's `StarRating` already has the correct empty-until-`ratingCount>0` gating logic; swap the local `useDriverStore.rating`/`ratingCount` for a real read of `driver_profiles.rating_avg`/`rating_count` + `ratings`. | `ratings`, `driver_profiles` |
| 15 | **Complaint submission/management → real write (FR-4.1–4.2).** `app/complaints.tsx` and `useComplaintsStore` exist (already fixed to persist across navigation, still local-only); swap for real `complaints`/`complaint_attachments` writes. | `complaints`, `complaint_attachments` |
| 16 | **Notifications → real read (FR-7).** `app/notifications.tsx` exists; swap `useNotificationsStore` for a real `notifications` table read + Realtime subscription. Driver additionally cares about `verification_status` and `payment_status` (cash-confirm) notification types. | `notifications` |
| 17 | ~~Logout~~ — **done**, real (`app/logout.tsx`). |  |
| 18 | **`eas.json` + internal distribution build.** Shared concern with passenger (CONTEXT §3) — neither app has one yet; can likely be done once for both. | config |

---

## Open decisions / cross-app blockers (flagged, not resolved)

1. **`match-ride-request` Edge Function does not exist anywhere in the repo yet.** It's required for both stages of FR-2.5 (cluster-authorization hard filter + bearing/detour heuristic) and is what makes the Request Board (#7) and Mid-trip pickup (#10) real instead of a naive client-side query. This is the single biggest blocker shared between the driver and passenger apps.
2. **`gcash-webhook` Edge Function also doesn't exist.** Blocks the GCash path on both apps equally. Driver-side exposure is limited to cash confirmation (#11), so this can be deferred longer for the driver app than for passenger's.
3. **Map reuse for the Request Board.** Passenger's `OsmMap` (Leaflet/WebView) can likely be reused as-is for a driver map view, but rendering multiple pending-request pins on a board is new UI, not just wiring — don't assume it's a drop-in. `app/trip/active.tsx` already reuses `OsmMap` for the single-trip route view.
4. **MapLibre vs. Leaflet/WebView divergence** (same one `docs/PASSENGER_TODO.MD` #1 flags for CONTEXT §3) applies identically here.
5. **New: driver test accounts require manual email confirmation right now.** The live Supabase project has "Confirm email" enabled and a low built-in email-send rate limit, so creating test driver accounts via the Register screen is currently friction-prone (confirmation email required, rate limit hit easily during repeated testing). Either disable "Confirm email" in the dashboard for dev convenience, or use the `service_role` key for one-off pre-confirmed test-account creation. Not a blocker for further development, but worth resolving before QA/demo prep.

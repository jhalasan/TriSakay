# Passenger App — Build Backlog

**Scope:** `apps/passenger` only (plus the shared `packages/*` it needs). Written 2026-07-31 against a fresh code survey and the live Supabase project `ygdgbvxxqrkxlezpckif`, after `docs/SCHEMA.MD` was reconciled and applied (see that file's header note and the migration history in `list_migrations`).

Cross-reference: `docs/CONTEXT.MD` §7 (Passenger App feature list) and FR-11 (consent/location permission).

---

## Where things actually stand

**✅ Real, backend-wired:**
- Registration & Login (`app/(auth)/register.tsx`, `login.tsx`) — real Supabase sign-up/sign-in via `packages/services/src/auth`. Missing: password reset (`login.tsx`'s "Forgot password?" is an `Alert.alert` stub).
- ToS / Privacy consent gate (`app/consent.tsx`) — versioned, auditable, writes to `user_consents` via `packages/services/src/consents`. Legal copy itself is still 3 hardcoded "Placeholder —" paragraphs.
- Location permission (`app/location-permission.tsx`, `src/hooks/useLocationPermission.ts`) — full granted/denied/blocked flow, re-prompts every foreground.
- Logout (`app/logout.tsx`).
- Profile name edit (`app/(tabs)/profile.tsx` → `updateProfile({fullName})`).

**🟡 Partial (UI real, data fake or missing):**
- Ride status tracking, driver info, ride history, settings — see the per-screen table in the exploration notes; all are either `setTimeout` simulations or empty in-memory Zustand stores.

**❌ No code at all:**
- GPS pickup capture, destination search, fare estimation, ride request insert, payment (both methods), payment history screen, rate-driver insert, complaint insert, notifications, and the entire fare-discount feature (FR-3.10–3.15).

Root cause for most of the above: `apps/passenger/src/mocks/` (destinations, drivers, notifications, rideHistory, fareCalculator) are deliberately emptied seams, not real mocks — they're where backend wiring plugs in. `packages/services/src/{booking,location,notifications}/index.ts` are each a single-line status-string stub.

Two spec divergences to resolve, not silently pick a side on:
- **Map library:** CONTEXT §3 specifies MapLibre; the actual implementation (`packages/ui/src/components/OsmMap`) is Leaflet inside a `react-native-webview`, using OSMF's free tile service — which the component's own `mapHtml.ts` documents as dev/low-volume only, not production-safe.
- **`supabase/` directory:** CONTEXT §3's repo structure lists one at the root; none exists. Supabase MCP `apply_migration` is still the only applied path — there are no migration files in version control (see `docs/SCHEMA.MD`'s header note).

---

## Build order

Ordered by dependency — each step needs the state the previous one produces. Table names are the ones just applied/confirmed live.

| # | Item | Files / stores | DB touched |
|---|---|---|---|
| 0 | **Foundations.** Add `zod` + `react-hook-form` (CONTEXT §3 mandates both; neither is installed — all forms are raw `useState`). Create `apps/passenger/tests/` so `npm run test:passenger` stops failing outright. Drop the dead `@expo-google-fonts/inter` dependency (repo moved Inter→Poppins in `a028f92`/`53d2df0`, package never removed). Delete the three one-line service stubs (`booking`, `location`, `notifications` in `packages/services/src/index.ts`) once step 4/10 replace them for real. Fix the stale claim at `apps/passenger/PRODUCT.md:29` ("No backend integration" / "Supabase vs. PocketBase undecided" — both false; PocketBase was removed in `5da79be`). | config, `package.json` | — |
| 1 | **GPS pickup.** `useBookingStore` has no `setPickup` action at all — `pickup` is permanently `null`, silently defaulting every consumer to the GenSan map center. Add the action, call `Location.getCurrentPositionAsync()`, reverse-geocode, add a draggable pin to `OsmMap`. | `src/store/useBookingStore.ts`, `src/components` | — |
| 2 | **Destination search.** Replace the permanently-empty `mocks/destinations.ts` with a real search/geocode source and a map-pin-drop → coordinates flow. | `app/booking/set-destination.tsx` | `barangays` (for `pickup_barangay_id` resolution) |
| 3 | **Fare estimation.** `mocks/fareCalculator.estimateFare()` is hardcoded to return `null`. Add a haversine helper to `packages/utils`, and call the live `compute_fare(p_distance_km, p_seats, p_passenger_id)` RPC from a new `packages/services/src/fare` module (the RPC exists and is confirmed working — see `docs/SCHEMA.MD` verification — but nothing in the client calls it yet). | `app/booking/confirm.tsx` | `fare_config`, `compute_fare()` RPC |
| 4 | **Ride request.** Insert into `ride_requests` on "Request ride"; wire cancel; subscribe to status changes via Realtime (already in the publication). Replaces the local-only status flip in `confirm.tsx`. | `app/booking/confirm.tsx`, new `packages/services/src/booking` | `ride_requests` |
| 5 | **Trip tracking & real driver info.** Replace the `wait(randomBetween(...))` chains in `finding-driver.tsx` / `driver-found.tsx` / `trip-in-progress.tsx` with real subscriptions to `trips`/`driver_profiles`; `DriverInfoCard` already exists and is real, it's just fed a hollow `{id:'pending'}` record today. | `app/booking/finding-driver.tsx`, `driver-found.tsx`, `trip-in-progress.tsx` | `trips`, `driver_profiles` |
| 6 | **Payment — cash first.** `app/booking/payment.tsx` currently fakes payment with `wait(800)` then a local history append. Wire the real cash-confirmation path (FR-9.9: marked `paid` only after driver confirms). Defer GCash to the `gcash-webhook` Edge Function, which doesn't exist yet either. | `app/booking/payment.tsx` | `transactions` |
| 7 | **Rate driver.** `app/booking/rate-driver.tsx` UI is real; submit is `wait(500)` then reset. Insert into `ratings` (server-side trigger already verifies the passenger owns the completed ride **and** that the named driver actually drove it — see `docs/SCHEMA.MD` §4.6, freshly hardened). | `app/booking/rate-driver.tsx` | `ratings` |
| 8 | **Ride history + new Payment History screen.** `history.tsx` reads `useHistoryStore`, seeded empty, nothing fetched. **`profile/payment-methods.tsx` is a static informational page, not history — a real payment-history screen doesn't exist at all yet** and needs to be added, not just wired. | `app/(tabs)/history.tsx`, new screen | `ride_requests`, `transactions` |
| 9 | **Complaint submission.** `complaints.tsx`'s `handleSubmit` is `wait(600)` then a local success flag — nothing is written. Use the real `complaint_category` enum (form currently only has free-text subject/message) and, once needed, `complaint_attachments` for evidence uploads (FR-4.7, table added in this session's migration). | `app/(tabs)/complaints.tsx` | `complaints`, `complaint_attachments` |
| 10 | **Notifications.** No `expo-notifications` dependency yet. Start with a `notifications` table read + Realtime subscription (replacing the empty `seedNotifications`), then layer in push tokens. | `app/notifications.tsx` | `notifications` |
| 11 | **Apply for Fare Discount (FR-3.10–3.15) — completely absent today.** No screen, no route, no ID-upload, no service, no store — not even a placeholder exists. The DB side (`passenger_discounts` table, `discount_category` enum, `compute_fare`'s discount branch) was applied in this session's migration and is live; this item is 100% client-side work. Needs a Storage bucket for `id_photo_path` uploads — **none exists in the project yet** (checked via `storage.buckets`), so this blocks on that infra decision too. | new screen + route | `passenger_discounts` |
| 12 | **Profile completion.** Phone update, avatar upload (`expo-image-picker` not installed), password reset. | `app/(tabs)/profile.tsx` | `users` |
| 13 | **Settings persistence + Filipino i18n** (NFR-3). `useSettingsStore` toggles are in-memory and wired to nothing; the language cycler flips a label with no i18n behind it. | `app/(tabs)/settings.tsx` | — |
| 14 | **`eas.json` + internal distribution build.** CONTEXT §3 specifies EAS internal distribution (Android) + TestFlight (iOS); no `eas.json` exists anywhere in the repo yet. | config | — |

---

## Open decisions (flagged, not resolved)

1. **MapLibre vs. Leaflet/WebView** — keep the current implementation, swap to real MapLibre, or explicitly amend CONTEXT.MD to match reality? The OSMF tile source used today is documented by the component itself as unsuitable past dev/low-volume use.
2. **Storage buckets** — none exist yet, but steps 11 (discount ID photos) and 12 (avatar upload) both need one. Decide bucket layout/naming before either lands.
3. **`supabase/` directory** — keep MCP-only with no local migration files, or start committing migrations locally so `git log` shows schema history the way it shows app history?

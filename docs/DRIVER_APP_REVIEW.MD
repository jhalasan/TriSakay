# Driver App — Code Review Findings & Remaining Work

**Date:** 2026-08-10
**Scope:** `apps/driver/` (screens, `src/store`, `src/hooks`) and the driver-consumed parts of `packages/services/src/` (`booking`, `payments`, `driver-profile`, `driver-documents`, `location`, `notifications`).

**How this doc came to be:** `docs/DRIVER_TODO.MD` and `docs/CHECKLIST.MD` were already re-verified as accurate against the code as of today (see `docs/superpowers/specs/2026-08-10-cash-payment-confirmation-design.md`'s companion doc-reconciliation pass) — they correctly track *which features are wired up*. This doc is a different pass: it assumes a feature is "done" per those docs and asks whether the code behind it is actually *correct*. It also lists feature gaps that a fresh read of the code surfaced, independent of what the TODO docs already say.

Every finding below with a file:line reference was read directly from the source, not taken on faith from a prior summary — this is a review doc, not a stale-doc problem like the ones already fixed.

---

## Part 1 — Bugs in code that's already "done"

Ordered most-to-least severe. Each entry: what's wrong, the exact failure scenario that triggers it, and a suggested fix direction (not full code — that's the implementer's job).

### Critical — trip lifecycle integrity

These four all touch the same accept → active-trip → complete/cancel path and the same `useTripStore`. Worth fixing as one connected pass rather than four isolated patches, since #2/#3/#4 all stem from the same root cause: nothing about "the trip a driver is currently on" is treated as a single source of truth that the backend and the client agree on.

**1. No active-trip rehydration on app restart.**
- `apps/driver/src/store/useTripStore.ts` — `current: ActiveTrip | null` is in-memory only. There is no boot-time query for "does this driver already have an active trip in the DB." Compare the passenger app, which has `getActiveRideForPassenger` in `packages/services/src/booking/index.ts` — there is no driver-side equivalent.
- **Failure scenario:** driver accepts a ride, OS kills the app (or the driver force-quits it) mid-trip, driver relaunches. Dashboard shows no active trip. The driver can never complete or cancel it from the UI. Worse, `acceptRideRequest`'s "does this driver have an active trip" check (`packages/services/src/booking/index.ts:152-157`) still finds the orphaned `active` trip row, so the driver can't even accept a *new* ride — they're stuck until someone manually fixes the DB.
- **Fix direction:** add a `getActiveTripForDriver(driverId)` service function (mirroring the passenger-side one), and call it once at driver-app boot (in `apps/driver/app/_layout.tsx`, alongside the other `use*Sync(sessionUserId)` hooks) to rehydrate `useTripStore.current` if a matching `active` trip exists.

**2. `useTripStore` is never reset on logout/session change.**
- `apps/driver/app/_layout.tsx` resets `useConsentStore`, `useVerificationStore`, `useNotificationsStore`, etc. whenever `sessionUserId` goes `null` (see the `use*Sync` hooks around lines 79-143). There is no equivalent reset for `useTripStore`, and `useTripStore` has no `reset()` action to call even if it were wired up.
- **Failure scenario:** driver A is mid-trip, their session expires or they explicitly log out without completing/cancelling first, driver B logs in on the same device. `useTripStore.current` still holds driver A's trip. `dashboard.tsx:79` (`handleAccept`) sees `current` truthy and routes driver B straight to `/trip/active`, showing driver A's passenger name/avatar/fare. If driver B taps "Complete," `completeTrip` runs with driver A's `tripId` — RLS filters the update to 0 affected rows (see finding #4), which is currently reported as success.
- **Fix direction:** add a `reset()` action to `useTripStore` (clear `current`, `error`), and call it from `_layout.tsx`'s session-change effect the same way the other stores do.

**3. Double-tap "Accept" can create duplicate trip rows and brick future accepts.**
- `apps/driver/app/(tabs)/dashboard.tsx:78-97` (`handleAccept`) and `apps/driver/app/(tabs)/requests.tsx:22` (its own `handleAccept`) have no in-flight guard or disabled state on the accept button (`apps/driver/src/components/RequestCard.tsx` — no `disabled`/loading prop passed from either caller).
- `packages/services/src/booking/index.ts:acceptRideRequest` (line 149) does a check-then-insert: SELECT for an existing `active` trip (152-157), and only if none exists, INSERT a new one (163-188). This is a classic TOCTOU race — nothing (no unique constraint, no upsert, no advisory lock) stops two concurrent calls from both seeing "no active trip" and both inserting one.
- **Failure scenario:** driver double-taps "Accept" (or taps it on both the Dashboard incoming-request card and the Requests tab within the same race window). Two `acceptRideRequest` calls run concurrently, both pass the active-trip check, both INSERT a `trips` row with `status='active'`. From then on, the very next accept attempt's `.eq('status','active').maybeSingle()` (line 152-157) errors because it matched 2 rows instead of 0 or 1 — every future accept fails with "Couldn't check your active trips" until someone manually deletes the duplicate row.
- Note: the *ride request* itself is correctly protected against double-assignment (lines 191-204 do check `.select().maybeSingle()` and return "This ride was just accepted by another driver" on 0 rows) — the bug is specifically in the trip-creation branch, not the ride-request-assignment branch.
- **Fix direction:** the cleanest fix is DB-level — a partial unique index on `trips (driver_id) where status = 'active'` (see `docs/SCHEMA.MD`'s conventions for how existing constraints are documented) turns the race into a clean insert failure the client can catch and retry-as-"fetch the existing trip" instead of silently succeeding twice. Pair with a client-side disabled-while-pending state on both accept buttons as defense in depth.

**4. `completeTrip`/`cancelTrip` are two independent, unchecked UPDATEs.**
- `packages/services/src/booking/index.ts:321-348` (`completeTrip`) and the analogous `cancelTrip` (line 354) each do two separate `.update()` calls (one on `trips`, one on `ride_requests`) with no transaction/RPC wrapping them, and — confirmed by reading the code — neither checks whether either UPDATE actually matched a row. Contrast `cancelRideRequest` and `confirmCashPayment` elsewhere in the same file, which both correctly use `.select().maybeSingle()` and treat "0 rows" as a real error.
- **Failure scenario A (partial write):** network drops between the `trips` update succeeding and the `ride_requests` update running. `trips.status='completed'` but `ride_requests.status` is still `'assigned'`. If the driver's app then dies or the driver navigates away, there's no retry — the ride request is stuck, no history row, no earnings row gets counted correctly downstream.
- **Failure scenario B (silent no-op):** an RLS-filtered update (e.g. from bug #2's stale `tripId` belonging to a different driver) returns `error: null` but 0 rows affected — Supabase's `.update()` without a trailing `.select()` doesn't distinguish "updated 0 rows because of RLS" from "updated 1 row successfully." The app reports success and clears local state while the DB is untouched.
- **Fix direction:** wrap both writes in a single `security definer` Postgres function (RPC) that does both updates in one transaction and returns the affected row so the client can verify a real update happened — same pattern already used for `get_trip_driver_info`/`get_trip_passenger_info`. At minimum, add `.select().maybeSingle()` to both existing UPDATEs and treat a null result as an error, matching `cancelRideRequest`'s existing pattern, until the RPC version is built.

### Important

**5. Double-tap "Complete trip" / "Cancel" can double-count earnings.**
- `apps/driver/app/trip/active.tsx:40` (`handleComplete`) and `:52` (`handleConfirmCancel`) have no pending/in-flight guard, unlike the cash-confirm toggle on the same screen (`confirmingCash` state exists for that one action but not these two).
- **Failure scenario:** two fast taps on "Complete trip" fire two `completeTrip` calls and two `recordCompletedTrip(fare)` calls before the first `router.replace` unmounts the screen — today's local earnings/trip-count tile is inflated by one extra trip that doesn't exist. Likewise the cancel confirm modal stays visible during its own `await`, so "Cancel" is double-tappable too.
- **Fix direction:** add a `completing`/`cancelling` boolean state (same shape as `confirmingCash`) and disable both buttons while true.

**6. In-flight Realtime refetch can repopulate state after unsubscribe.**
- `packages/services/src/booking/index.ts:275-290` (`subscribeToPendingRideRequests`'s internal `refetch()`) and the equivalent in `packages/services/src/notifications/index.ts:42-54` have no cancellation flag tied to the subscription's lifetime.
- **Failure scenario:** driver toggles availability off right as a `refetch()` call is in flight (triggered by some other Realtime event just before). `unsubscribe()` clears `pending` in the store, but the already-in-flight `refetch()` resolves afterward and calls `onData`/`onChange` anyway, silently repopulating the request list (or notification list) even though the driver is offline / logged out.
- **Fix direction:** capture a local `let cancelled = false` in the closure returned by the subscribe function, set it `true` in the returned unsubscribe callback, and check it before calling `onData`/`onChange` inside `refetch()`.

**7. Requests tab never fetches passenger info — Dashboard does. (Confirmed independently.)**
- `apps/driver/app/(tabs)/dashboard.tsx:92` calls `getTripPassengerInfo(accepted.id)` after a successful accept and populates the trip store's passenger name/avatar. `apps/driver/app/(tabs)/requests.tsx:22`'s own `handleAccept` does not — confirmed by reading the file, there is no `getTripPassengerInfo` call anywhere in it.
- **Failure scenario:** accepting a ride from the Requests tab (instead of the Dashboard's incoming-request card) leaves the passenger's name/photo blank ("Passenger" placeholder) for the entire trip.
- **Fix direction:** extract the accept-then-fetch-passenger-info logic from `dashboard.tsx:78-97` into one shared function (e.g. in a hook or the trip store itself) and call it from both screens instead of maintaining two copies.

**8. Unhandled rejection can strand the document-upload submit button.**
- `apps/driver/app/(auth)/register.tsx:68` calls `new File(uri).arrayBuffer()` directly in the submit handler, outside the try/catch that only wraps the `submitDriverDocuments()` call itself. `setSubmitting(false)` (line 102) is inside that same try/catch's `finally`-equivalent path.
- **Failure scenario:** a stale/expired image-picker URI (common after an OS-level cache clear or a long-backgrounded app) throws when read. The thrown error isn't caught, so `setSubmitting(false)` never runs — the submit button spins forever with no error message, even though the account may have already been created.
- **Fix direction:** move the `arrayBuffer()` read (or the whole per-file read step) inside the same try/catch that wraps `submitDriverDocuments`, or wrap the entire handler body in one top-level try/catch/finally.

**9. RLS gap: no column-level restriction on driver-writable ride requests.**
- `docs/SCHEMA.MD:1331-1335` — the `rr_driver_update` policy: `for update using (trip_id in (select id from trips where driver_id = auth.uid()) or (status = 'pending' and app_current_role() = 'driver'))`. Confirmed: there is no `WITH CHECK` clause narrowing which *columns* can change — RLS in Postgres controls which *rows* qualify, not which columns within an allowed row. Nothing in the policy stops a driver from writing arbitrary values to `final_fare`, `estimated_fare`, or `discount_percent` on a ride they're assigned to.
- The app's own code (`completeTrip` etc.) never does this — it's not an app-code bug, it's a defense-in-depth gap. `docs/SCHEMA.MD`'s own comment on `final_fare` ("Locked at trip completion") implies an intent this policy doesn't actually enforce against a modified/malicious client hitting Supabase directly with valid driver credentials.
- **Fix direction:** either a trigger that rejects/ignores driver writes to fare-related columns outside the specific `completeTrip` RPC path (once #4's fix introduces one), or a narrower policy that only allows the specific columns `completeTrip` actually needs to change. Flag to whoever owns `docs/SCHEMA.MD` changes — this is a schema/RLS change, not an app-code one.

**10. Notification "mark all read" has no rollback or reconcile on failure.**
- `apps/driver/src/store/useNotificationsStore.ts:38-45` — optimistically flips every notification to read locally, then on a failed Supabase write only sets a local `error` field. `apps/driver/app/notifications.tsx` never renders that `error` field anywhere.
- **Failure scenario:** the "mark all read" UPDATE fails (network blip, RLS edge case) — no Realtime event fires (since nothing changed server-side), so there's no reconcile path. The unread badge stays cleared client-side while the rows are still unread in the DB, until the next full app restart re-fetches real state.
- **Fix direction:** either roll back the optimistic update on failure, or render the `error` field so the driver at least sees something went wrong instead of a silently-incorrect badge.

### Minor (cheap fixes / cleanup, no urgency)

- `apps/driver/src/store/useDriverStore.ts` — `acceptRate: null` is never computed or written anywhere; the dashboard's "Accept rate" tile permanently shows "—". Needs a real query (e.g. accepted vs. seen requests) if this is meant to be a real metric, or should be removed if it's not planned.
- `useRequestsStore`'s `decline()` only mutates a module-level `Set` in memory — declines are lost on app relaunch and never reach the backend, so a declined request can resurface.
- `useDocumentsStore`'s `submit()` marks a freshly-picked file `'pending'` before any upload has happened, so the UI briefly claims "Pending review" before the file is even sent — cosmetic mislabel, not a data bug (the real `driver_documents.status` is unaffected).
- `subscribeToPendingRideRequests` (`packages/services/src/booking/index.ts:268-308`) listens to `event: '*'` on the entire unfiltered `ride_requests` table and re-invokes the `match-ride-request` Edge Function on every single change, with no debounce — every passenger action anywhere in the system triggers one Edge Function call per currently-online driver. Fine at prototype scale, worth a debounce or a narrower filter before any real load.
- `apps/driver/app/splash.tsx` still imports `wait()` from `src/mocks/delay.ts` — this is a live import, not dead code (it pads the splash screen by 1400ms), but worth noting since `src/mocks/` reads as "should be empty by now" at a glance.

---

## Part 2 — Features still genuinely incomplete

Independent of the bugs above — these are gaps found by reading the actual screens/stores fresh, not carried over from `docs/DRIVER_TODO.MD` (which is already accurate and can be cross-referenced for the full backlog).

**Blocks the core ride flow:**
- Multi-passenger request pooling (FR-2.5b) and the mid-trip pickup screen (FR-2.5c) don't exist at all — the entire request/trip data model here is single-passenger only.
- Driver verification approve/reject is **blocked**, not just undone: `useVerificationStore` correctly polls `driver_profiles.verification_status`, but nothing in the system can actually flip that status — the admin verification-review screen (`docs/ADMIN_TODO.MD` F-something) and the FR-1.6a email-notification infra both don't exist yet.

**Real features to build, currently UI theater:**
- `useEarningsStore.notifyPsoForSettlement` only appends to an in-memory array — no Supabase write of any kind. PSO is never actually notified; state is wiped on reload.
- The entire Settings screen (push/location toggles, language, SMS/email receipt preferences) is in-memory only — no AsyncStorage, no backend table, resets to hardcoded defaults every app restart.
- The earnings chart (`apps/driver/app/(tabs)/earnings.tsx`) is a static placeholder component, not a real chart driven by data.

**Polish:**
- `apps/driver/app/consent.tsx` — ToS/Privacy/Limitations body copy is still literal "Placeholder —" filler text (same issue already tracked for the passenger app).
- `apps/driver/app/(auth)/login.tsx` — "Forgot password?" is an `Alert.alert` stub, no real reset flow (same as passenger).

---

## Suggested work order

1. **Trip-lifecycle cluster (findings 1-4)** — highest severity, all touch the same code, worth doing as one connected piece of work rather than four separate patches. This is the one area where a real bug can strand a passenger, corrupt earnings data, or permanently brick a driver's ability to accept rides.
2. **Findings 5-10** — independent, lower-severity, can be picked off individually or batched.
3. **Minor cleanup items** — opportunistic, no urgency.
4. **Feature gaps (Part 2)** — each is real, multi-file work; treat as separate planning items, not quick fixes. Cross-reference `docs/DRIVER_TODO.MD` and `docs/CHECKLIST.MD` for how these rank against passenger/admin work.

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

~~**1. No active-trip rehydration on app restart.**~~ — **done.** New `get_active_trip_for_driver()` security-definer RPC (same passenger-name/avatar join trick as `get_trip_passenger_info`, scoped to `auth.uid()` internally) + `getActiveTripForDriver()` service wrapper. `useTripStore` gained a `hydrate()` action (epoch-guarded, same pattern as `useDriverStore.checkAvailability`/`checkRating`), called from a new `useTripSync(sessionUserId)` hook in `app/_layout.tsx`. Rehydrating into the store alone wasn't enough to actually fix the described failure ("driver can never complete or cancel it from the UI") — `dashboard.tsx` now also redirects to `/trip/active` whenever `useTripStore.current` is truthy, so a relaunched app with an in-progress trip lands the driver back on it instead of silently stranding the state in the store.

~~**2. `useTripStore` is never reset on logout/session change.**~~ — **done.** Added a `reset()` action (clears `current`/`error`, and bumps the hydrate epoch so an in-flight `hydrate()` from the previous session can't land after reset). Wired into the same `useTripSync` hook's `sessionUserId === null` branch — matches how `useConsentStore`/`useVerificationStore`/`useNotificationsStore` already reset themselves reactively from `_layout.tsx`, so `logout.tsx` itself needed no changes.

~~**3. Double-tap "Accept" can create duplicate trip rows and brick future accepts.**~~ — **done.** Added `trips_one_active_per_driver`, a partial unique index on `trips (driver_id) where status = 'active'`. `acceptRideRequest` now catches the resulting `23505` on insert and treats it as "a concurrent accept already won" — it re-fetches that driver's now-existing active trip and continues the assignment with it, so a double-tap still ends in one accepted ride instead of a stuck error. (Client-side disabled-while-pending state was not added on top of this — the DB-level fix alone closes the actual bug the finding described; RequestCard's buttons are not further guarded.)

~~**4. `completeTrip`/`cancelTrip` are two independent, unchecked UPDATEs.**~~ — **done.** New `complete_trip(p_trip_id, p_ride_request_id)` and `cancel_trip(p_trip_id, p_ride_request_id, p_reason)` security-definer RPCs, each doing both the `trips` and `ride_requests` writes as one transaction (a raised exception aborts the whole call, so a partial write is now structurally impossible) and re-checking `driver_id = auth.uid()`/`status = 'active'` as the access-control gate that used to live in the client's WHERE clauses. `completeTrip`/`cancelTrip` in `packages/services` now just call the RPC and translate any error to the existing friendly message — same public signatures, so `useTripStore` needed no changes here.

### Important

~~**5. Double-tap "Complete trip" / "Cancel" can double-count earnings.**~~ — **done.** Added `completing`/`confirmingCancel` boolean state in `trip/active.tsx` (same shape as `confirmingCash`); the Complete button disables+shows a spinner while in flight, and `packages/ui`'s `ConfirmModal` gained an optional `confirmLoading` prop (disables both its buttons, spinner on confirm) so the cancel modal's confirm button can't be double-tapped either.

~~**6. In-flight Realtime refetch can repopulate state after unsubscribe.**~~ — **done.** Both `subscribeToPendingRideRequests` and `subscribeToNotifications` now capture a local `let cancelled = false`, set `true` in the returned unsubscribe, and check it before calling `onData`/`onChange`/`onError` inside their `refetch()`.

~~**7. Requests tab never fetches passenger info — Dashboard does.**~~ — **done.** Extracted the accept-then-fetch-passenger-info logic into a new `useAcceptRideRequest()` hook (`apps/driver/src/hooks/useAcceptRideRequest.ts`); both `dashboard.tsx` and `requests.tsx` now call the same hook instead of each maintaining its own `handleAccept`.

~~**8. Unhandled rejection can strand the document-upload submit button.**~~ — **done.** `register.tsx`'s `handleSubmit` now wraps the `uploadPickedDocuments()` call (which does the `File(uri).arrayBuffer()` read) in its own try/catch, falling through to the same `setSubmitting(false)` + friendly-error path on a thrown read failure instead of leaving the button spinning forever.

~~**9. RLS gap: no column-level restriction on driver-writable ride requests.**~~ — **done.** New `enforce_driver_fare_columns_locked()` BEFORE UPDATE trigger on `ride_requests` rejects any driver-role write that changes `final_fare`/`estimated_fare`/`discount_percent`, unless a transaction-local `trisakay.allow_fare_write` flag is set — which `complete_trip` (finding #4) now sets immediately before its own legitimate `final_fare` write, since `app_current_role()` still reports `'driver'` inside a SECURITY DEFINER call (only the privilege context escalates, not the underlying session identity the role lookup reads).

~~**10. Notification "mark all read" has no rollback or reconcile on failure.**~~ — **done.** `markAllRead()` now snapshots `items` before the optimistic flip and restores that snapshot (plus surfaces `error`) if the write fails; `notifications.tsx` renders the `error` field for the first time.

### Minor (cheap fixes / cleanup, no urgency)

- `apps/driver/src/store/useDriverStore.ts` — `acceptRate: null` is never computed or written anywhere; the dashboard's "Accept rate" tile permanently shows "—". **Not done** — needs a product decision (what counts as "seen," where the query lives) before it's a quick fix; flagged, not fixed.
- `useRequestsStore`'s `decline()` only mutates a module-level `Set` in memory — declines are lost on app relaunch and never reach the backend, so a declined request can resurface. **Not done** — would need a schema decision (a `declined_by` table, or similar) that's out of scope for an opportunistic cleanup pass.
- ~~`useDocumentsStore`'s `submit()` marks a freshly-picked file `'pending'` before any upload has happened~~ — **done.** Added a distinct `'selected'` status (`apps/driver/src/types/document.ts`) used when a file is picked but not yet uploaded; `'pending'` is reserved for the real post-upload/PSO-review state (though nothing currently transitions a document back to `'pending'` after `submitDriverDocuments` succeeds, since the registration screen navigates away immediately after).
- ~~`subscribeToPendingRideRequests` ... no debounce~~ — **done.** Change-triggered refetches are now debounced 500ms (`PENDING_REQUESTS_REFETCH_DEBOUNCE_MS`); the initial post-`SUBSCRIBED` refetch stays immediate.
- `apps/driver/app/splash.tsx` still imports `wait()` from `src/mocks/delay.ts` — confirmed correct as-is (live import, not dead code); no change needed.

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

1. ~~**Trip-lifecycle cluster (findings 1-4)**~~ — **done** (2026-08-11), fixed as one connected pass across four migrations (`get_active_trip_for_driver`, `trips_one_active_per_driver` unique index, `complete_trip`/`cancel_trip` RPCs) plus the client wiring (`useTripStore.hydrate()`/`reset()`, `useTripSync` in `_layout.tsx`, Dashboard's active-trip redirect). Full typecheck + test sweep green across all four workspaces (114 services / 39 driver / 9 passenger / 21 admin) after each step.
2. ~~**Findings 5-10**~~ — **done** (2026-08-11), including finding #9's RLS/trigger fix, fixed individually with the same verify-after-each pattern.
3. **Minor cleanup items** — 3 of 5 done (document-status mislabel, Realtime debounce, splash.tsx confirmed correct as-is); 2 remain flagged, not fixed (`acceptRate`, decline persistence — both need a product/schema decision first, not just a quick patch).
4. **Feature gaps (Part 2)** — untouched, still each real multi-file work; treat as separate planning items, not quick fixes. Cross-reference `docs/DRIVER_TODO.MD` and `docs/CHECKLIST.MD` for how these rank against passenger/admin work.

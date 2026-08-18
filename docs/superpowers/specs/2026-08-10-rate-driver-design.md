# Rate driver — design

**Date:** 2026-08-10
**Scope:** `apps/passenger` + a new `packages/services/src/ratings` module. Corresponds to `docs/PASSENGER_TODO.MD` build-order item 7 / `docs/CHECKLIST.MD` P1 "Passenger: rate-driver → real `ratings` insert."

## Problem

`app/booking/rate-driver.tsx`'s `handleSubmit` is a fake: `await wait(500)` then `reset()` + navigate home. No `ratings` row is ever written, so completed trips are never actually rated despite the UI (star picker + optional comment) being fully real.

## What already exists (verified against `docs/SCHEMA.MD` — nothing here needs to be built)

- `ratings` table: `id`, `ride_request_id` (unique — one rating per ride), `passenger_id`, `driver_id`, `stars` (1–5, checked), `comment` (nullable), `created_at`.
- `trg_ratings_validate` (`validate_rating()`) runs `before insert` and raises one of three exceptions if the insert is invalid: the ride isn't the submitting passenger's own, the ride isn't `'completed'` yet, or the named driver didn't actually drive that trip.
- `trg_ratings_refresh` (`refresh_driver_rating()`) recomputes `driver_profiles.rating_avg`/`rating_count` automatically on insert/update/delete — nothing in the app needs to touch those columns directly.
- RLS: `ratings_passenger_insert` (`with check (passenger_id = auth.uid())`) is the only write policy — no update/delete policy exists, so ratings are insert-once by design. `ratings_read` lets the passenger, the named driver, or PSO read a row.
- `useBookingStore.driver` (type `Driver`, `src/types/driver.ts`) already carries `id` — threaded through since the trip-tracking work specifically so this step wouldn't need a second RPC round-trip (see `docs/superpowers/specs/2026-08-09-trip-tracking-driver-info-design.md`). `useBookingStore.rideRequestId` is also still populated at this point in the flow — `payment.tsx`'s `finishSuccessfulPayment()` does not call `reset()` before navigating to `rate-driver.tsx`; only `rate-driver.tsx` itself does, after submission.

## The missing-driver-id edge case

`finding-driver.tsx:49-55` sets `driver.id` to `data?.driverId ?? ''` when the `get_trip_driver_info` RPC fails — a deliberate, already-accepted "never strand the passenger over a display-only failure" fallback from a prior session. That means `driver.id` can legitimately be `''` by the time the passenger reaches `rate-driver.tsx`, and this screen currently has **no back button or header at all** — if submission required a valid driver id, an empty one would leave the passenger stuck with no way forward.

**Decision:** when `!driver?.id || !rideRequestId`, disable the rating UI entirely and offer a **"Continue"** button that finishes the flow (`reset()` + `router.replace('/(tabs)/home')`) without attempting an insert. This is scoped narrowly to this broken-data case — the normal rating flow gains no general "skip rating" feature.

## Service layer

New module `packages/services/src/ratings/index.ts`, following the existing `complaints`/`location` module pattern (a local `getSignedInUserId()` helper, a `toFriendlyMessage()` translator for known Postgres exceptions):

```ts
export interface SubmitRatingInput {
  rideRequestId: string;
  driverId: string;
  stars: number;
  comment?: string;
}

export interface SubmitRatingResult {
  error: string | null;
}

export async function submitRating(input: SubmitRatingInput): Promise<SubmitRatingResult>
```

- Inserts `{ ride_request_id, passenger_id: userId, driver_id, stars, comment: comment?.trim() || null }`.
- `toFriendlyMessage()` maps:
  - `"Rating must be submitted by the ride's own passenger"` → generic "Something went wrong — please try again." (shouldn't be reachable from the app's own UI; not worth a specific message).
  - `"Cannot rate a ride that is not completed"` → "This ride isn't marked complete yet — please try again in a moment."
  - `"Rating must name the driver who actually drove this trip"` → generic "Something went wrong — please try again." (shouldn't be reachable given `driverId` comes from the same RPC that populated the trip).
  - A duplicate-key violation on `ratings_ride_request_id_key` → **treated as success, not an error** — `submitRating` returns `{ error: null }` in this case. If the ride's already been rated (e.g. a slow network response followed by a retry), there's nothing wrong to report; the screen should proceed exactly as if the insert had just succeeded.
  - Any other error passes through as-is (network, unexpected RLS, etc.).

## UI changes — `app/booking/rate-driver.tsx`

1. Read `rideRequestId` from `useBookingStore` (currently only `driver`/`reset` are read).
2. Add `submitError: string | null` state.
3. Replace `handleSubmit`:
   ```ts
   async function handleSubmit() {
     setSubmitting(true);
     setSubmitError(null);
     const { error } = await submitRating({
       rideRequestId: rideRequestId!,
       driverId: driver!.id,
       stars: rating,
       comment,
     });
     setSubmitting(false);
     if (error) {
       setSubmitError(error);
       return;
     }
     reset();
     router.replace('/(tabs)/home');
   }
   ```
   (The `!` assertions are safe here because the missing-id guard below prevents this button from being reachable when either is falsy.)
4. Remove the `wait` import (`src/mocks/delay`), now unused.
5. Add the missing-driver-id branch: when `!driver?.id || !rideRequestId`, render an inline note below the driver card ("We couldn't confirm your driver for this trip — you can still continue.") and swap the star-rating/comment/submit UI for a single full-width "Continue" button that calls `reset()` + `router.replace('/(tabs)/home')` directly (no service call).
6. Render `submitError` (if set) below the comment field, in the same inline-error style already used elsewhere in the booking flow (`payment.tsx`'s `styles.gcashErrorText`-equivalent pattern — reuse or mirror `rate-driver.styles.ts`'s existing text styles rather than importing payment's).

## Out of scope (explicitly deferred)

- Any change to `driver_profiles.rating_avg`/`rating_count` computation — already handled server-side by `trg_ratings_refresh`.
- Editing or deleting a previously-submitted rating — no RLS policy permits it, and it's not part of this backlog item.
- A general "skip rating" feature for the happy path — only the broken-data fallback gets a Continue button, per the design decision above.

## Testing

New `packages/services/tests/ratings.test.ts` (mocked Supabase client, matching the existing style used for `packages/services/tests/complaints.test.ts`/`payments.test.ts`):
- `submitRating` inserts the right row shape on success.
- `submitRating` returns `{ error: 'Not signed in' }` when there's no session.
- Each of the three translated trigger-exception messages produces its mapped friendly copy.
- A duplicate-key violation on `ratings_ride_request_id_key` returns `{ error: null }` (treated as success).
- An untranslated error message passes through verbatim.

No component-level test harness exists for passenger screens (established pattern this session) — `rate-driver.tsx`'s UI changes are verified via `npm run typecheck` plus a manual smoke test, not a new screen test.

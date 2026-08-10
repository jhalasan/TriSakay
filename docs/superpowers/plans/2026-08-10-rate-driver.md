# Rate Driver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `app/booking/rate-driver.tsx`'s fake `wait(500)` submit with a real `ratings` insert, without ever stranding the passenger on a dead-end screen.

**Architecture:** A new `packages/services/src/ratings` module (following the existing `complaints`/`location` module pattern: a local `getSignedInUserId()` helper, a friendly-message translator for known Postgres errors) provides `submitRating()`. `rate-driver.tsx` calls it on submit, and gains a narrowly-scoped fallback UI for the one pre-existing edge case where `driver.id` can be empty (a prior session's accepted "don't strand the passenger over a display-only RPC failure" behavior in `finding-driver.tsx`).

**Tech Stack:** React Native (Expo Router), Zustand (`useBookingStore`), `packages/services`, TypeScript, `node:test` for service-layer tests.

## Global Constraints

- New module lives at `packages/services/src/ratings/index.ts`, exported from `packages/services/src/index.ts`'s barrel (add `export * from './ratings/index.ts';` in the same alphabetical-ish position as the other entries — after `payments`, before `location`, matching the existing list's rough ordering... actually the existing barrel is not strictly alphabetical; just add it anywhere in the list, consistent placement doesn't matter to this codebase's existing barrel).
- A duplicate-key violation on `ratings_ride_request_id_key` (Postgres unique_violation, SQLSTATE `23505`) is **not an error** — `submitRating` returns `{ error: null }` in that case, since the ride already has a rating and there's nothing to report.
- The three `validate_rating()` trigger exceptions get translated to passenger-facing copy (see Task 1's exact strings) using the codebase's existing message-substring-matching pattern (see `packages/services/src/location/index.ts`'s `toFriendlyMessage`), not error codes — Postgres `raise exception` surfaces as SQLSTATE `P0001` for all three, so the code alone can't distinguish them.
- `rate-driver.tsx`'s missing-driver-id fallback (when `!driver?.id || !rideRequestId`) must never call `submitRating` — it takes a completely separate UI path (a single "Continue" button, no service call) per the design's explicit "never strand the passenger" requirement (this screen has no back button or header).
- No component-level tests for `rate-driver.tsx` — this repo has no test harness for passenger screens (established pattern). Verify via `npm run typecheck` (scoped to files in this plan — this repo has one known PRE-EXISTING, UNRELATED typecheck failure in `packages/services/tests/discount.test.ts` from an earlier commit; ignore it, your bar is zero errors in files this plan touches) plus a manual smoke-test note.

---

### Task 1: `ratings` service module with tests

**Files:**
- Create: `packages/services/src/ratings/index.ts`
- Create: `packages/services/tests/ratings.test.ts`
- Modify: `packages/services/src/index.ts` (add one barrel export line)

**Interfaces:**
- Produces (consumed by Task 2):
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

This is TDD: write each failing test, run it, then add just enough implementation to pass it, repeating until all tests in this task are green. The steps below group the whole cycle per behavior rather than spelling out every micro-iteration — implement in the order given, running the growing test file after each addition.

- [ ] **Step 1: Write the test file (all cases), confirm it fails**

Create `packages/services/tests/ratings.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createFakeSupabaseClient } from './fakeSupabaseClient.ts';
import { submitRating } from '../src/ratings/index.ts';

const SESSION = { data: { session: { user: { id: 'passenger1' } } } };

test('submitRating inserts the right row shape on success', async () => {
  let capturedInsert: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      from: (table) => {
        assert.equal(table, 'ratings');
        return {
          insert: async (row: unknown) => {
            capturedInsert = row;
            return { error: null };
          },
        };
      },
    })
  );

  const { error } = await submitRating({
    rideRequestId: 'rr1',
    driverId: 'driver1',
    stars: 5,
    comment: 'Great ride!',
  });

  assert.equal(error, null);
  assert.deepEqual(capturedInsert, {
    ride_request_id: 'rr1',
    passenger_id: 'passenger1',
    driver_id: 'driver1',
    stars: 5,
    comment: 'Great ride!',
  });
});

test('submitRating sends null for an empty/whitespace-only comment', async () => {
  let capturedInsert: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      from: () => ({
        insert: async (row: unknown) => {
          capturedInsert = row;
          return { error: null };
        },
      }),
    })
  );

  await submitRating({ rideRequestId: 'rr1', driverId: 'driver1', stars: 4, comment: '   ' });

  assert.equal(capturedInsert.comment, null);
});

test('submitRating returns an error when there is no active session', async () => {
  __setSupabaseClientForTests(createFakeSupabaseClient({ getSession: async () => ({ data: { session: null } }) }));

  const { error } = await submitRating({ rideRequestId: 'rr1', driverId: 'driver1', stars: 5 });
  assert.equal(error, 'Not signed in');
});

test('submitRating treats a duplicate-rating violation as success, not an error', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      from: () => ({
        insert: async () => ({
          error: {
            message: 'duplicate key value violates unique constraint "ratings_ride_request_id_key"',
            code: '23505',
          },
        }),
      }),
    })
  );

  const { error } = await submitRating({ rideRequestId: 'rr1', driverId: 'driver1', stars: 5 });
  assert.equal(error, null);
});

test('submitRating translates the "ride not completed" trigger exception', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      from: () => ({
        insert: async () => ({
          error: { message: 'Cannot rate a ride that is not completed', code: 'P0001' },
        }),
      }),
    })
  );

  const { error } = await submitRating({ rideRequestId: 'rr1', driverId: 'driver1', stars: 5 });
  assert.equal(error, "This ride isn't marked complete yet — please try again in a moment.");
});

test('submitRating translates the "wrong passenger" trigger exception', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      from: () => ({
        insert: async () => ({
          error: { message: "Rating must be submitted by the ride's own passenger", code: 'P0001' },
        }),
      }),
    })
  );

  const { error } = await submitRating({ rideRequestId: 'rr1', driverId: 'driver1', stars: 5 });
  assert.equal(error, 'Something went wrong — please try again.');
});

test('submitRating translates the "wrong driver" trigger exception', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      from: () => ({
        insert: async () => ({
          error: { message: 'Rating must name the driver who actually drove this trip', code: 'P0001' },
        }),
      }),
    })
  );

  const { error } = await submitRating({ rideRequestId: 'rr1', driverId: 'driver1', stars: 5 });
  assert.equal(error, 'Something went wrong — please try again.');
});

test('submitRating passes an untranslated error through verbatim', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      from: () => ({
        insert: async () => ({ error: { message: 'network error' } }),
      }),
    })
  );

  const { error } = await submitRating({ rideRequestId: 'rr1', driverId: 'driver1', stars: 5 });
  assert.equal(error, 'network error');
});
```

Run: `npm run test:services`
Expected: FAIL — `../src/ratings/index.ts` does not exist yet (module-not-found error).

- [ ] **Step 2: Implement `packages/services/src/ratings/index.ts`**

```ts
import { getSupabaseClient } from '../supabase/client.ts';

async function getSignedInUserId(): Promise<string | null> {
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session?.user.id ?? null;
}

/**
 * Translates the `validate_rating()` trigger's exceptions (docs/SCHEMA.MD §4.6)
 * into passenger-facing copy. None of the three should be reachable from this
 * app's own UI (the ride is only ever navigable when completed, and driverId
 * comes from the same RPC that populated the trip) — generic copy is enough
 * for the two that would indicate a real bug rather than a user-facing state.
 * Any other error (network, unexpected RLS) passes through as-is.
 */
function toFriendlyMessage(error: { message: string; code?: string }): string | null {
  if (error.code === '23505' || error.message.includes('ratings_ride_request_id_key')) {
    // Already rated — nothing wrong to report.
    return null;
  }
  if (error.message.includes('Cannot rate a ride that is not completed')) {
    return "This ride isn't marked complete yet — please try again in a moment.";
  }
  if (
    error.message.includes("Rating must be submitted by the ride's own passenger") ||
    error.message.includes('Rating must name the driver who actually drove this trip')
  ) {
    return 'Something went wrong — please try again.';
  }
  return error.message;
}

export interface SubmitRatingInput {
  rideRequestId: string;
  driverId: string;
  stars: number;
  comment?: string;
}

export interface SubmitRatingResult {
  error: string | null;
}

/**
 * Inserts a rating as the signed-in passenger (`passenger_id = auth.uid()`,
 * enforced by the `ratings_passenger_insert` RLS policy). `driver_profiles`'s
 * rating_avg/rating_count are recomputed server-side by trg_ratings_refresh —
 * nothing here touches them directly.
 */
export async function submitRating({
  rideRequestId,
  driverId,
  stars,
  comment,
}: SubmitRatingInput): Promise<SubmitRatingResult> {
  const userId = await getSignedInUserId();
  if (!userId) return { error: 'Not signed in' };

  const { error } = await getSupabaseClient()
    .from('ratings')
    .insert({
      ride_request_id: rideRequestId,
      passenger_id: userId,
      driver_id: driverId,
      stars,
      comment: comment?.trim() || null,
    });

  if (error) return { error: toFriendlyMessage(error) };
  return { error: null };
}
```

- [ ] **Step 3: Run the test file, confirm it passes**

Run: `npm run test:services`
Expected: all 8 tests in `ratings.test.ts` PASS, plus every pre-existing test in the package still passing (no regressions).

- [ ] **Step 4: Add the barrel export**

In `packages/services/src/index.ts`, add one line anywhere in the `export *` list (e.g. after the `payments` line):

```ts
export * from './ratings/index.ts';
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors in `packages/services/src/ratings/index.ts`, `packages/services/src/index.ts`, or `packages/services/tests/ratings.test.ts`. (Ignore the pre-existing unrelated `discount.test.ts` failure — see Global Constraints.)

- [ ] **Step 6: Commit**

```bash
git add packages/services/src/ratings/index.ts packages/services/tests/ratings.test.ts packages/services/src/index.ts
git commit -m "$(cat <<'EOF'
feat(services): add submitRating for real ratings inserts

Adds a ratings service module following the complaints/location
pattern, with friendly translations for the validate_rating trigger's
exceptions and duplicate-rating-treated-as-success handling.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Wire `rate-driver.tsx` to the real insert, with the missing-driver-id fallback

**Files:**
- Modify: `apps/passenger/app/booking/rate-driver.tsx`
- Modify: `apps/passenger/src/styles/booking/rate-driver.styles.ts`

**Interfaces:**
- Consumes: `submitRating({ rideRequestId, driverId, stars, comment }): Promise<{ error: string | null }>` from `@trisakay/services` (Task 1's export — already available on `main`/this branch by the time this task runs).
- Consumes: `useBookingStore` fields `driver: Driver | null`, `rideRequestId: string | null`, `reset: () => void` — all already defined in `apps/passenger/src/store/useBookingStore.ts`, no changes needed there.
- Produces: nothing consumed by later tasks — this is the last task in this plan.

- [ ] **Step 1: Add the two new style entries**

In `apps/passenger/src/styles/booking/rate-driver.styles.ts`, add these two entries to the `StyleSheet.create({...})` object (after the existing `submitWrap` entry):

```ts
  errorText: {
    ...typography.body,
    color: colors.ink,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  fallbackNote: {
    ...typography.body,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
```

(`typography`, `colors`, `spacing` are already imported at the top of this file — no new imports needed.)

- [ ] **Step 2: Rewrite `apps/passenger/app/booking/rate-driver.tsx`**

Replace the full file with:

```tsx
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Avatar, Button, Card, StarRating, Textarea } from '@trisakay/ui';
import { submitRating } from '@trisakay/services';
import { useBookingStore } from '../../src/store/useBookingStore';
import { styles } from '../../src/styles/booking/rate-driver.styles';

export default function RateDriverScreen() {
  const router = useRouter();
  const driver = useBookingStore((state) => state.driver);
  const rideRequestId = useBookingStore((state) => state.rideRequestId);
  const reset = useBookingStore((state) => state.reset);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canRate = Boolean(driver?.id) && Boolean(rideRequestId);

  function finish() {
    reset();
    router.replace('/(tabs)/home');
  }

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

    finish();
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card variant="raised" style={styles.driverCard}>
          <Avatar name={driver?.name} size="xl" />
          <Text style={styles.name}>{driver?.name ?? 'Your driver'}</Text>
          <Text style={styles.subtitle}>How was your ride?</Text>
        </Card>

        {canRate ? (
          <>
            <View style={styles.starsRow}>
              <StarRating value={rating} onChange={setRating} size={34} />
            </View>

            <View style={styles.commentWrap}>
              <Textarea
                label="Comment (optional)"
                placeholder="Tell us about your trip"
                value={comment}
                onChangeText={setComment}
              />
            </View>

            {submitError && <Text style={styles.errorText}>{submitError}</Text>}

            <View style={styles.submitWrap}>
              <Button
                label="Submit rating"
                fullWidth
                disabled={rating === 0}
                loading={submitting}
                onPress={handleSubmit}
              />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.fallbackNote}>
              We couldn't confirm your driver for this trip — you can still continue.
            </Text>
            <View style={styles.submitWrap}>
              <Button label="Continue" fullWidth onPress={finish} />
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

Note: `wait` and the `src/mocks/delay` import are gone (no longer used anywhere in this file).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors in `apps/passenger/app/booking/rate-driver.tsx` or `apps/passenger/src/styles/booking/rate-driver.styles.ts`. (Ignore the pre-existing unrelated `discount.test.ts` failure.)

- [ ] **Step 4: Manual smoke test**

No emulator/live-Supabase access in this sandboxed environment (same caveat as every prior passenger-flow change this session). Flag as **typecheck-verified, not device-verified** until a human runs it:
1. Complete a full ride to reach the rate-driver screen normally (driver info populated) — confirm stars + optional comment submit successfully, land on Home, and a new row appears in `ratings` for that `ride_request_id`.
2. Confirm `driver_profiles.rating_avg`/`rating_count` for that driver updates automatically (no app code needed — `trg_ratings_refresh` handles it).
3. Attempt to submit a second rating for the same already-rated ride (if reachable via back-navigation) — confirm it's treated as success (navigates home, no error shown), not a blocking error.
4. Force the missing-driver-id fallback (e.g. temporarily stub `driver.id` to `''` in dev, or trigger the known `get_trip_driver_info` RPC-failure path from a prior session) — confirm the screen shows the fallback note and a working "Continue" button instead of the star-rating UI, and that tapping it returns to Home without inserting a row.

- [ ] **Step 5: Commit**

```bash
git add apps/passenger/app/booking/rate-driver.tsx apps/passenger/src/styles/booking/rate-driver.styles.ts
git commit -m "$(cat <<'EOF'
feat(passenger): wire rate-driver to a real ratings insert

Replaces rate-driver.tsx's fake wait() submit with submitRating().
Adds a narrowly-scoped fallback (a single Continue button, no rating
UI) for the known case where driver.id is empty, so this screen -
which has no back button - can never strand the passenger.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Post-plan follow-up (not part of this plan)

- `docs/PASSENGER_TODO.MD` item 7 and `docs/CHECKLIST.MD`'s corresponding P1 line should be marked done once this lands, mirroring the doc-reconciliation pass already done for payment.tsx.

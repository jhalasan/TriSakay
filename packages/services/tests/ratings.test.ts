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

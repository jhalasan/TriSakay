import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createFakeSupabaseClient } from './fakeSupabaseClient.ts';
import { createRideRequest } from '../src/booking/index.ts';

test('createRideRequest inserts the full payload and returns the row', async () => {
  let capturedInsert: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: (table) => {
        assert.equal(table, 'ride_requests');
        return {
          insert: (row: unknown) => {
            capturedInsert = row;
            return {
              select: () => ({
                single: async () => ({ data: { id: 'rr1', ...(row as object) }, error: null }),
              }),
            };
          },
        };
      },
    })
  );

  const { data, error } = await createRideRequest({
    passengerId: 'p1',
    pickup: { latitude: 6.11, longitude: 125.17, label: 'Home' },
    dropoff: { latitude: 6.12, longitude: 125.18, label: 'Mall' },
    seats: 2,
    distanceKm: 1.4,
    estimatedFare: 18,
    preferredMethod: 'cash',
    discountApplied: true,
    discountPercent: 20,
  });

  assert.equal(error, null);
  assert.equal(data?.id, 'rr1');
  assert.deepEqual(capturedInsert, {
    passenger_id: 'p1',
    pickup_lat: 6.11,
    pickup_lng: 125.17,
    pickup_label: 'Home',
    dest_lat: 6.12,
    dest_lng: 125.18,
    dest_label: 'Mall',
    seats_requested: 2,
    distance_km: 1.4,
    estimated_fare: 18,
    preferred_method: 'cash',
    discount_applied: true,
    discount_percent: 20,
  });
});

test('createRideRequest surfaces the Postgres error message', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: () => ({
        insert: () => ({
          select: () => ({
            single: async () => ({ data: null, error: { message: 'insert failed' } }),
          }),
        }),
      }),
    })
  );

  const { data, error } = await createRideRequest({
    passengerId: 'p1',
    pickup: { latitude: 0, longitude: 0, label: 'A' },
    dropoff: { latitude: 0, longitude: 0, label: 'B' },
    seats: 1,
    distanceKm: 1,
    estimatedFare: 15,
    preferredMethod: 'cash',
    discountApplied: false,
    discountPercent: null,
  });

  assert.equal(data, null);
  assert.equal(error, 'insert failed');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createFakeSupabaseClient } from './fakeSupabaseClient.ts';
import { listPassengerTripHistory } from '../src/trip-history/index.ts';

test('listPassengerTripHistory maps a full RPC row and picks the right date', async () => {
  let capturedFn: string | null = null;
  let capturedArgs: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (fn, args) => {
        capturedFn = fn;
        capturedArgs = args;
        return {
          data: [
            {
              ride_request_id: 'rr1',
              driver_name: 'Juan Dela Cruz',
              driver_rating: 4.8,
              plate_no: 'TRK 4821',
              body_no: '042',
              pickup_label: 'SM City',
              dest_label: 'City Hall',
              status: 'completed',
              fare: 45,
              seats: 2,
              payment_method: 'gcash',
              payment_status: 'paid',
              requested_at: '2026-08-09T23:00:00.000Z',
              completed_at: '2026-08-10T00:00:00.000Z',
              cancelled_at: null,
              distance_km: 3.4,
              duration_minutes: 11,
              discount_applied: true,
              discount_percent: 20,
              cancel_reason: null,
            },
          ],
          error: null,
        };
      },
    })
  );

  const { data, error } = await listPassengerTripHistory(20);

  assert.equal(error, null);
  assert.equal(capturedFn, 'get_passenger_trip_history');
  assert.deepEqual(capturedArgs, { p_limit: 20 });
  assert.deepEqual(data, [
    {
      rideRequestId: 'rr1',
      driverName: 'Juan Dela Cruz',
      driverRating: 4.8,
      plateNo: 'TRK 4821',
      bodyNo: '042',
      pickup: 'SM City',
      dropoff: 'City Hall',
      status: 'completed',
      fare: 45,
      seats: 2,
      paymentMethod: 'gcash',
      paymentStatus: 'paid',
      date: '2026-08-10T00:00:00.000Z',
      distanceKm: 3.4,
      durationMinutes: 11,
      discountApplied: true,
      discountPercent: 20,
      cancelReason: null,
    },
  ]);
});

test('listPassengerTripHistory handles a cancelled-before-assignment row with no driver/payment', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async () => ({
        data: [
          {
            ride_request_id: 'rr2',
            driver_name: null,
            driver_rating: null,
            plate_no: null,
            body_no: null,
            pickup_label: 'Home',
            dest_label: null,
            status: 'cancelled',
            fare: null,
            seats: null,
            payment_method: null,
            payment_status: null,
            requested_at: '2026-08-07T23:00:00.000Z',
            completed_at: null,
            cancelled_at: '2026-08-08T00:00:00.000Z',
            distance_km: null,
            duration_minutes: null,
            discount_applied: false,
            discount_percent: null,
            cancel_reason: 'No drivers available',
          },
        ],
        error: null,
      }),
    })
  );

  const { data, error } = await listPassengerTripHistory();

  assert.equal(error, null);
  assert.deepEqual(data, [
    {
      rideRequestId: 'rr2',
      driverName: null,
      driverRating: null,
      plateNo: null,
      bodyNo: null,
      pickup: 'Home',
      dropoff: null,
      status: 'cancelled',
      fare: null,
      seats: null,
      paymentMethod: null,
      paymentStatus: null,
      date: '2026-08-08T00:00:00.000Z',
      distanceKm: null,
      durationMinutes: null,
      discountApplied: false,
      discountPercent: null,
      cancelReason: 'No drivers available',
    },
  ]);
});

test('listPassengerTripHistory uses the default limit of 50', async () => {
  let capturedArgs: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (_fn, args) => {
        capturedArgs = args;
        return { data: [], error: null };
      },
    })
  );

  await listPassengerTripHistory();
  assert.deepEqual(capturedArgs, { p_limit: 50 });
});

test('listPassengerTripHistory returns an empty array and the error message on RPC failure', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async () => ({ data: null, error: { message: 'connection refused' } }),
    })
  );

  const { data, error } = await listPassengerTripHistory();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});

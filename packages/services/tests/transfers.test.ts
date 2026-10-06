import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createFakeSupabaseClient } from './fakeSupabaseClient.ts';
import { getTransferInviteDetails } from '../src/transfers/index.ts';

const ROW = {
  pickup_place: 'Plaza Heneral Santos',
  destination_place: 'City Hall',
  seats: 2,
  ride_km: 3.4,
  fare: 35,
  handoff_after_pickup: false,
  handoff_km: 1.2,
};

test('getTransferInviteDetails asks for one invite and maps the row to camel case', async () => {
  let captured: { fn: string; args: unknown } | null = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (fn, args) => {
        captured = { fn, args };
        return { data: [ROW], error: null };
      },
    }),
  );

  assert.deepEqual(await getTransferInviteDetails('inv1'), {
    data: {
      pickupPlace: 'Plaza Heneral Santos',
      destinationPlace: 'City Hall',
      seats: 2,
      rideKm: 3.4,
      fare: 35,
      handoffAfterPickup: false,
      handoffKm: 1.2,
    },
    error: null,
  });
  assert.deepEqual(captured, { fn: 'get_transfer_invite_details', args: { p_invite_id: 'inv1' } });
});

test('getTransferInviteDetails keeps missing values as null instead of inventing them', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async () => ({
        data: [{ ...ROW, pickup_place: null, destination_place: null, ride_km: null, fare: null, handoff_km: null }],
        error: null,
      }),
    }),
  );

  const result = await getTransferInviteDetails('inv1');
  assert.equal(result.error, null);
  assert.deepEqual(result.data, {
    pickupPlace: null,
    destinationPlace: null,
    seats: 2,
    rideKm: null,
    fare: null,
    handoffAfterPickup: false,
    handoffKm: null,
  });
});

test('getTransferInviteDetails returns no data when the invite is gone or expired', async () => {
  __setSupabaseClientForTests(createFakeSupabaseClient({ rpc: async () => ({ data: [], error: null }) }));

  assert.deepEqual(await getTransferInviteDetails('inv1'), { data: null, error: null });
});

test('getTransferInviteDetails returns the database message when the call fails', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({ rpc: async () => ({ data: null, error: { message: 'Account is not active' } }) }),
  );

  assert.deepEqual(await getTransferInviteDetails('inv1'), { data: null, error: 'Account is not active' });
});

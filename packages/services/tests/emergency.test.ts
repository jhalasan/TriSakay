import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { triggerEmergencyAlert } from '../src/emergency/index.ts';

const SESSION = { session: { user: { id: 'driver1' } } };

test('triggerEmergencyAlert inserts triggered_by from the signed-in session, passing the rest through', async () => {
  let captured: Record<string, unknown> | null = null;
  __setSupabaseClientForTests({
    from: (table: string) => {
      assert.equal(table, 'emergency_alerts');
      return {
        insert: async (row: Record<string, unknown>) => {
          captured = row;
          return { error: null };
        },
      };
    },
    auth: { getSession: async () => ({ data: SESSION }) },
  } as any);

  const { error } = await triggerEmergencyAlert({
    rideRequestId: 'rr1',
    triggeredRole: 'driver',
    counterpartId: 'pax1',
    lat: 6.1128,
    lng: 125.1717,
  });

  assert.equal(error, null);
  assert.deepEqual(captured, {
    ride_request_id: 'rr1',
    triggered_by: 'driver1',
    triggered_role: 'driver',
    counterpart_id: 'pax1',
    lat: 6.1128,
    lng: 125.1717,
  });
});

test('triggerEmergencyAlert returns an error without inserting when there is no active session', async () => {
  __setSupabaseClientForTests({
    from: () => {
      throw new Error('must not query when there is no session');
    },
    auth: { getSession: async () => ({ data: { session: null } }) },
  } as any);

  const { error } = await triggerEmergencyAlert({
    rideRequestId: null,
    triggeredRole: 'passenger',
    counterpartId: null,
    lat: 6.1128,
    lng: 125.1717,
  });

  assert.equal(error, 'Not signed in');
});

test('triggerEmergencyAlert surfaces an insert error', async () => {
  __setSupabaseClientForTests({
    from: () => ({ insert: async () => ({ error: { message: 'connection refused' } }) }),
    auth: { getSession: async () => ({ data: SESSION }) },
  } as any);

  const { error } = await triggerEmergencyAlert({
    rideRequestId: null,
    triggeredRole: 'driver',
    counterpartId: null,
    lat: 6.1128,
    lng: 125.1717,
  });

  assert.equal(error, 'connection refused');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { listEmergencyAlertsForAdmin, markEmergencyAlertReviewed } from '../src/admin/emergency.ts';

const SESSION = { session: { user: { id: 'supervisor1' } } };

function fakeClient() {
  const alerts = [
    {
      id: 'alert1',
      ride_request_id: 'rr1',
      triggered_by: 'd1',
      triggered_role: 'driver',
      counterpart_id: 'p1',
      lat: 6.1128,
      lng: 125.1717,
      status: 'logged',
      reviewed_by: null as string | null,
      reviewed_at: null as string | null,
      notes: null as string | null,
      created_at: '2026-08-21T03:00:00.000Z',
    },
  ];
  const users = [
    { id: 'd1', full_name: 'Ferdinand Amaro' },
    { id: 'p1', full_name: 'Maria Fe Santos' },
    { id: 'supervisor1', full_name: 'Rina Cabuslay' },
  ];

  return {
    from: (table: string) => {
      if (table === 'emergency_alerts') {
        return {
          select: () => ({ order: async () => ({ data: alerts, error: null }) }),
          update: (patch: Record<string, unknown>) => ({
            eq: async (_col: string, id: string) => {
              const a = alerts.find((row) => row.id === id);
              if (a) Object.assign(a, patch);
              return { error: null };
            },
          }),
        };
      }
      if (table === 'users') {
        return { select: () => ({ in: async () => ({ data: users, error: null }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
    auth: { getSession: async () => ({ data: SESSION }) },
  } as any;
}

test('listEmergencyAlertsForAdmin resolves triggered-by/counterpart names and passes the rest through', async () => {
  __setSupabaseClientForTests(fakeClient());

  const { data, error } = await listEmergencyAlertsForAdmin();
  assert.equal(error, null);
  assert.deepEqual(data, [
    {
      id: 'alert1',
      triggeredByName: 'Ferdinand Amaro',
      triggeredRole: 'driver',
      counterpartName: 'Maria Fe Santos',
      rideRequestId: 'rr1',
      lat: 6.1128,
      lng: 125.1717,
      status: 'logged',
      reviewedByName: null,
      reviewedAt: null,
      notes: null,
      createdAt: '2026-08-21T03:00:00.000Z',
    },
  ]);
});

test('listEmergencyAlertsForAdmin returns { data: [], error } when the query fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ order: async () => ({ data: null, error: { message: 'connection refused' } }) }) }),
  } as any);

  const { data, error } = await listEmergencyAlertsForAdmin();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});

test('markEmergencyAlertReviewed stamps status/reviewed_by/reviewed_at and passes notes through when given', async () => {
  __setSupabaseClientForTests(fakeClient());

  const { error } = await markEmergencyAlertReviewed('alert1', 'Contacted both parties, no further action.');
  assert.equal(error, null);

  const { data } = await listEmergencyAlertsForAdmin();
  assert.equal(data[0].status, 'reviewed');
  assert.equal(data[0].reviewedByName, 'Rina Cabuslay');
  assert.equal(data[0].notes, 'Contacted both parties, no further action.');
});

test('markEmergencyAlertReviewed leaves notes untouched when omitted', async () => {
  __setSupabaseClientForTests(fakeClient());

  const { error } = await markEmergencyAlertReviewed('alert1');
  assert.equal(error, null);

  const { data } = await listEmergencyAlertsForAdmin();
  assert.equal(data[0].status, 'reviewed');
  assert.equal(data[0].notes, null);
});

test('markEmergencyAlertReviewed returns an error when there is no active session', async () => {
  __setSupabaseClientForTests({ auth: { getSession: async () => ({ data: { session: null } }) } } as any);

  const { error } = await markEmergencyAlertReviewed('alert1');
  assert.equal(error, 'Not signed in');
});

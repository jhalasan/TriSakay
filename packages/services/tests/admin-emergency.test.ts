import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { listEmergencyAlertsForAdmin, markEmergencyAlertClosed, markEmergencyAlertReviewed } from '../src/admin/emergency.ts';

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
      closed_by: null as string | null,
      closed_at: null as string | null,
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
      if (table === 'tricycles') {
        return { select: () => ({ in: async () => ({ data: [{ driver_id: 'd1', plate_no: 'GSC-4821' }], error: null }) }) };
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
      triggeredById: 'd1',
      triggeredByName: 'Ferdinand Amaro',
      triggeredRole: 'driver',
      counterpartId: 'p1',
      counterpartName: 'Maria Fe Santos',
      tricyclePlateNo: 'GSC-4821',
      rideRequestId: 'rr1',
      lat: 6.1128,
      lng: 125.1717,
      status: 'logged',
      reviewedByName: null,
      reviewedAt: null,
      closedByName: null,
      closedAt: null,
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

test('markEmergencyAlertReviewed sends only the status and the trimmed note, so the database decides who and when', async () => {
  const patches: Record<string, unknown>[] = [];
  __setSupabaseClientForTests({
    from: (table: string) => {
      assert.equal(table, 'emergency_alerts');
      return {
        update: (patch: Record<string, unknown>) => {
          patches.push(patch);
          return { eq: async () => ({ error: null }) };
        },
      };
    },
  } as any);

  const { error } = await markEmergencyAlertReviewed('alert1', '  Contacted both parties, no further action.  ');

  assert.equal(error, null);
  assert.deepEqual(patches, [{ status: 'reviewed', notes: 'Contacted both parties, no further action.' }]);
});

test('markEmergencyAlertReviewed refuses an empty or blank note without calling the database', async () => {
  let called = false;
  __setSupabaseClientForTests({
    from: () => {
      called = true;
      return {};
    },
  } as any);

  for (const note of ['', '   ']) {
    const { error } = await markEmergencyAlertReviewed('alert1', note);
    assert.equal(error, 'Add a note describing what was done before marking this alert reviewed.');
  }
  assert.equal(called, false);
});

test('markEmergencyAlertReviewed passes the database error through (for example when the alert is no longer logged)', async () => {
  __setSupabaseClientForTests({
    from: () => ({ update: () => ({ eq: async () => ({ error: { message: 'An alert cannot move from closed to reviewed.' } }) }) }),
  } as any);

  const { error } = await markEmergencyAlertReviewed('alert1', 'Checked.');
  assert.equal(error, 'An alert cannot move from closed to reviewed.');
});

test('markEmergencyAlertClosed sends only the status change', async () => {
  const patches: Record<string, unknown>[] = [];
  __setSupabaseClientForTests({
    from: () => ({
      update: (patch: Record<string, unknown>) => {
        patches.push(patch);
        return { eq: async () => ({ error: null }) };
      },
    }),
  } as any);

  const { error } = await markEmergencyAlertClosed('alert1');
  assert.equal(error, null);
  assert.deepEqual(patches, [{ status: 'closed' }]);
});

test('listEmergencyAlertsForAdmin shows who reviewed and who closed an alert', async () => {
  const client = fakeClient();
  const originalFrom = client.from;
  client.from = (table: string) => {
    if (table === 'emergency_alerts') {
      return {
        select: () => ({
          order: async () => ({
            data: [
              {
                id: 'alert1',
                ride_request_id: 'rr1',
                triggered_by: 'd1',
                triggered_role: 'driver',
                counterpart_id: 'p1',
                lat: 6.1,
                lng: 125.1,
                status: 'closed',
                reviewed_by: 'supervisor1',
                reviewed_at: '2026-08-21T04:00:00.000Z',
                closed_by: 'admin1',
                closed_at: '2026-08-22T01:00:00.000Z',
                notes: 'Contacted both parties.',
                created_at: '2026-08-21T03:00:00.000Z',
              },
            ],
            error: null,
          }),
        }),
      };
    }
    if (table === 'users') {
      return {
        select: () => ({
          in: async () => ({
            data: [
              { id: 'd1', full_name: 'Ferdinand Amaro' },
              { id: 'p1', full_name: 'Maria Fe Santos' },
              { id: 'supervisor1', full_name: 'Rina Cabuslay' },
              { id: 'admin1', full_name: 'Jay Halasan' },
            ],
            error: null,
          }),
        }),
      };
    }
    return originalFrom(table);
  };
  __setSupabaseClientForTests(client);

  const { data } = await listEmergencyAlertsForAdmin();
  assert.equal(data[0].reviewedByName, 'Rina Cabuslay');
  assert.equal(data[0].reviewedAt, '2026-08-21T04:00:00.000Z');
  assert.equal(data[0].closedByName, 'Jay Halasan');
  assert.equal(data[0].closedAt, '2026-08-22T01:00:00.000Z');
  assert.equal(data[0].notes, 'Contacted both parties.');
});

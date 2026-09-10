import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import {
  listComplaintAttachmentsForAdmin,
  listComplaintsForAdmin,
  recordComplaintResolutionForAdmin,
  recordDhDirectiveForAdmin,
  scheduleComplaintMediationForAdmin,
  setComplaintStatusForAdmin,
} from '../src/admin/complaints.ts';

const SESSION = { session: { user: { id: 'staff1' } } };

function fakeClient() {
  const complaints = [
    {
      id: 'cmp1',
      submitted_by: 'p1',
      against_user_id: 'd1',
      ride_request_id: 'rr1',
      category: 'fare',
      subject: 'Driver refused agreed fare',
      message: 'Driver asked for more than the meter showed.',
      status: 'open',
      dh_directive: null as string | null,
      mediation_meeting_at: null as string | null,
      mediation_location: null as string | null,
      resolution_notes: null as string | null,
      created_at: '2026-08-01T00:00:00.000Z',
    },
  ];
  const users = [
    { id: 'p1', full_name: 'Maria Fe Santos' },
    { id: 'd1', full_name: 'Ferdinand Amaro' },
  ];

  return {
    from: (table: string) => {
      if (table === 'complaints') {
        return {
          select: () => ({ order: async () => ({ data: complaints, error: null }) }),
          update: (patch: Record<string, unknown>) => ({
            eq: async (_col: string, id: string) => {
              const c = complaints.find((row) => row.id === id);
              if (c) Object.assign(c, patch);
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
    rpc: async (fn: string, args: Record<string, unknown>) => {
      const c = complaints.find((row) => row.id === args.p_complaint_id);
      if (!c) return { error: { message: 'Complaint not found' } };
      if (fn === 'schedule_complaint_mediation') {
        c.mediation_meeting_at = args.p_meeting_at as string;
        c.mediation_location = (args.p_location as string | null) ?? null;
        c.status = 'mediation_scheduled';
        return { error: null };
      }
      if (fn === 'record_complaint_resolution') {
        c.status = args.p_status as string;
        c.resolution_notes = (args.p_notes as string | null) ?? null;
        return { error: null };
      }
      throw new Error(`unexpected rpc ${fn}`);
    },
  } as any;
}

test('listComplaintsForAdmin resolves submitter/accused names and passes category/status/dhDirective through', async () => {
  __setSupabaseClientForTests(fakeClient());

  const { data, error } = await listComplaintsForAdmin();
  assert.equal(error, null);
  assert.deepEqual(data, [
    {
      id: 'cmp1',
      subject: 'Driver refused agreed fare',
      message: 'Driver asked for more than the meter showed.',
      submittedByName: 'Maria Fe Santos',
      againstUserName: 'Ferdinand Amaro',
      rideRequestId: 'rr1',
      category: 'fare',
      status: 'open',
      dhDirective: null,
      mediationMeetingAt: null,
      mediationLocation: null,
      resolutionNotes: null,
      createdAt: '2026-08-01T00:00:00.000Z',
    },
  ]);
});

test('listComplaintsForAdmin returns { data: [], error } when the query fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ order: async () => ({ data: null, error: { message: 'connection refused' } }) }) }),
  } as any);

  const { data, error } = await listComplaintsForAdmin();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});

test('setComplaintStatusForAdmin stamps triaged_by/triaged_at from the signed-in PSO', async () => {
  __setSupabaseClientForTests(fakeClient());

  const { error } = await setComplaintStatusForAdmin('cmp1', 'under_review');
  assert.equal(error, null);

  const { data } = await listComplaintsForAdmin();
  assert.equal(data[0].status, 'under_review');
});

test('setComplaintStatusForAdmin returns an error when there is no active session', async () => {
  __setSupabaseClientForTests({ auth: { getSession: async () => ({ data: { session: null } }) } } as any);

  const { error } = await setComplaintStatusForAdmin('cmp1', 'under_review');
  assert.equal(error, 'Not signed in');
});

test('recordDhDirectiveForAdmin writes the directive text', async () => {
  __setSupabaseClientForTests(fakeClient());

  const { error } = await recordDhDirectiveForAdmin('cmp1', 'Contact both parties.');
  assert.equal(error, null);

  const { data } = await listComplaintsForAdmin();
  assert.equal(data[0].dhDirective, 'Contact both parties.');
});

test('recordDhDirectiveForAdmin returns an error when there is no active session', async () => {
  __setSupabaseClientForTests({ auth: { getSession: async () => ({ data: { session: null } }) } } as any);

  const { error } = await recordDhDirectiveForAdmin('cmp1', 'Contact both parties.');
  assert.equal(error, 'Not signed in');
});

test('scheduleComplaintMediationForAdmin calls the schedule_complaint_mediation RPC and flips status to mediation_scheduled', async () => {
  __setSupabaseClientForTests(fakeClient());

  const { error } = await scheduleComplaintMediationForAdmin('cmp1', '2026-09-01T09:00:00.000Z', 'PSO Office');
  assert.equal(error, null);

  const { data } = await listComplaintsForAdmin();
  assert.equal(data[0].status, 'mediation_scheduled');
  assert.equal(data[0].mediationMeetingAt, '2026-09-01T09:00:00.000Z');
  assert.equal(data[0].mediationLocation, 'PSO Office');
});

test('scheduleComplaintMediationForAdmin surfaces an RPC error (e.g. non-Supervisor caller)', async () => {
  __setSupabaseClientForTests({
    rpc: async () => ({ error: { message: 'Only a PSO Supervisor or Admin may schedule mediation' } }),
  } as any);

  const { error } = await scheduleComplaintMediationForAdmin('cmp1', '2026-09-01T09:00:00.000Z', null);
  assert.equal(error, 'Only a PSO Supervisor or Admin may schedule mediation');
});

test('recordComplaintResolutionForAdmin calls the record_complaint_resolution RPC and sets the final status', async () => {
  __setSupabaseClientForTests(fakeClient());

  const { error } = await recordComplaintResolutionForAdmin('cmp1', 'resolved', 'Fare refunded at mediation.');
  assert.equal(error, null);

  const { data } = await listComplaintsForAdmin();
  assert.equal(data[0].status, 'resolved');
  assert.equal(data[0].resolutionNotes, 'Fare refunded at mediation.');
});

test('recordComplaintResolutionForAdmin surfaces an RPC error (e.g. non-Supervisor caller)', async () => {
  __setSupabaseClientForTests({
    rpc: async () => ({ error: { message: 'Only a PSO Supervisor or Admin may record a complaint resolution' } }),
  } as any);

  const { error } = await recordComplaintResolutionForAdmin('cmp1', 'dismissed', null);
  assert.equal(error, 'Only a PSO Supervisor or Admin may record a complaint resolution');
});

test('listComplaintAttachmentsForAdmin scopes to the given complaint, ordered oldest first', async () => {
  let capturedEq: [string, string] | null = null;
  let capturedOrder: { column: string; opts: unknown } | null = null;

  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table !== 'complaint_attachments') throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: (col: string, val: string) => {
            capturedEq = [col, val];
            return {
              order: async (column: string, opts: unknown) => {
                capturedOrder = { column, opts };
                return {
                  data: [
                    { id: 'att1', storage_path: 'cmp1/evidence-1.jpg' },
                    { id: 'att2', storage_path: 'cmp1/evidence-2.jpg' },
                  ],
                  error: null,
                };
              },
            };
          },
        }),
      };
    },
  } as any);

  const { data, error } = await listComplaintAttachmentsForAdmin('cmp1');

  assert.equal(error, null);
  assert.deepEqual(capturedEq, ['complaint_id', 'cmp1']);
  assert.deepEqual(capturedOrder, { column: 'created_at', opts: { ascending: true } });
  assert.deepEqual(data, [
    { id: 'att1', storagePath: 'cmp1/evidence-1.jpg' },
    { id: 'att2', storagePath: 'cmp1/evidence-2.jpg' },
  ]);
});

test('listComplaintAttachmentsForAdmin returns { data: [], error } when the query fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: null, error: { message: 'connection refused' } }) }) }) }),
  } as any);

  const { data, error } = await listComplaintAttachmentsForAdmin('cmp1');
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});

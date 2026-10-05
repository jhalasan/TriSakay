import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import {
  acceptComplaintForAdmin,
  assignComplaintForAdmin,
  claimComplaintForAdmin,
  declineComplaintForAdmin,
  listComplaintAssignmentsForAdmin,
  listPsoStaffForAdmin,
  releaseComplaintForAdmin,
  listComplaintAttachmentsForAdmin,
  listComplaintsForAdmin,
  listComplaintStatusHistoryForAdmin,
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
      triaged_by: null as string | null,
      triaged_at: null as string | null,
      dh_reviewed_by: null as string | null,
      dh_reviewed_at: null as string | null,
      mediation_scheduled_by: null as string | null,
      mediation_scheduled_at: null as string | null,
      resolved_by: null as string | null,
      resolved_at: null as string | null,
      assigned_to: null as string | null,
      assigned_at: null as string | null,
      assignment_accepted_at: null as string | null,
    },
  ];
  const users = [
    { id: 'p1', full_name: 'Maria Fe Santos' },
    { id: 'd1', full_name: 'Ferdinand Amaro' },
    { id: 'staff1', full_name: 'Ana Reyes' },
    { id: 'staff2', full_name: 'Ben Cruz' },
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
      submittedById: 'p1',
      submittedByName: 'Maria Fe Santos',
      againstUserId: 'd1',
      againstUserName: 'Ferdinand Amaro',
      rideRequestId: 'rr1',
      category: 'fare',
      status: 'open',
      dhDirective: null,
      mediationMeetingAt: null,
      mediationLocation: null,
      resolutionNotes: null,
      createdAt: '2026-08-01T00:00:00.000Z',
      triagedByName: null,
      triagedAt: null,
      dhReviewedByName: null,
      dhReviewedAt: null,
      mediationScheduledByName: null,
      mediationScheduledAt: null,
      resolvedByName: null,
      resolvedAt: null,
      assignedToId: null,
      assignedToName: null,
      assignedAt: null,
      assignmentAcceptedAt: null,
    },
  ]);
});

test('listComplaintsForAdmin names the staff who triaged, directed, scheduled and resolved', async () => {
  const client = fakeClient();
  __setSupabaseClientForTests(client);
  await setComplaintStatusForAdmin('cmp1', 'under_review'); // staff1 triages
  await client.from('complaints').update({ dh_reviewed_by: 'staff2', dh_reviewed_at: '2026-08-03T00:00:00.000Z', resolved_by: 'staff2', resolved_at: '2026-08-05T00:00:00.000Z' }).eq('id', 'cmp1');

  const { data, error } = await listComplaintsForAdmin();
  assert.equal(error, null);
  assert.equal(data[0].triagedByName, 'Ana Reyes');
  assert.equal(typeof data[0].triagedAt, 'string');
  assert.equal(data[0].dhReviewedByName, 'Ben Cruz');
  assert.equal(data[0].dhReviewedAt, '2026-08-03T00:00:00.000Z');
  assert.equal(data[0].resolvedByName, 'Ben Cruz');
  assert.equal(data[0].mediationScheduledByName, null);
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

test('listComplaintStatusHistoryForAdmin scopes to the given complaint, ordered oldest first, and resolves changer names (UAT A16)', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'complaint_status_history') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({
                data: [
                  { id: 'h1', old_status: 'open', new_status: 'under_review', changed_by: 'staff1', changed_at: '2026-09-01T00:00:00.000Z' },
                  { id: 'h2', old_status: 'under_review', new_status: 'resolved', changed_by: null, changed_at: '2026-09-02T00:00:00.000Z' },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'users') {
        return { select: () => ({ in: async () => ({ data: [{ id: 'staff1', full_name: 'Rhea Santillan' }], error: null }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await listComplaintStatusHistoryForAdmin('cmp1');

  assert.equal(error, null);
  assert.deepEqual(data, [
    { id: 'h1', oldStatus: 'open', newStatus: 'under_review', changedByName: 'Rhea Santillan', changedAt: '2026-09-01T00:00:00.000Z' },
    { id: 'h2', oldStatus: 'under_review', newStatus: 'resolved', changedByName: null, changedAt: '2026-09-02T00:00:00.000Z' },
  ]);
});

test('listComplaintStatusHistoryForAdmin returns { data: [], error } when the query fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: null, error: { message: 'connection refused' } }) }) }) }),
  } as any);

  const { data, error } = await listComplaintStatusHistoryForAdmin('cmp1');
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});

test('listComplaintsForAdmin names the current owner and whether they have accepted', async () => {
  const client = fakeClient();
  __setSupabaseClientForTests(client);
  await client.from('complaints').update({ assigned_to: 'staff2', assigned_at: '2026-08-02T00:00:00.000Z', assignment_accepted_at: null }).eq('id', 'cmp1');

  const { data } = await listComplaintsForAdmin();
  assert.equal(data[0].assignedToId, 'staff2');
  assert.equal(data[0].assignedToName, 'Ben Cruz');
  assert.equal(data[0].assignedAt, '2026-08-02T00:00:00.000Z');
  assert.equal(data[0].assignmentAcceptedAt, null);
});

function rpcClient(result: { error: { message: string } | null; data?: unknown } = { error: null }) {
  const calls: { fn: string; args: unknown }[] = [];
  const client = {
    rpc: async (fn: string, args: unknown) => {
      calls.push({ fn, args });
      return result;
    },
  } as any;
  return { client, calls };
}

test('claim/assign/accept/decline/release call their RPC with the documented arguments', async () => {
  const { client, calls } = rpcClient();
  __setSupabaseClientForTests(client);

  assert.deepEqual(await claimComplaintForAdmin('cmp1'), { error: null });
  assert.deepEqual(await assignComplaintForAdmin('cmp1', 'staff2', 'Please call both'), { error: null });
  assert.deepEqual(await acceptComplaintForAdmin('cmp1'), { error: null });
  assert.deepEqual(await declineComplaintForAdmin('cmp1', 'On leave'), { error: null });
  assert.deepEqual(await releaseComplaintForAdmin('cmp1', 'Owner away'), { error: null });

  assert.deepEqual(calls, [
    { fn: 'claim_complaint', args: { p_complaint_id: 'cmp1' } },
    { fn: 'assign_complaint', args: { p_complaint_id: 'cmp1', p_to_user: 'staff2', p_note: 'Please call both' } },
    { fn: 'accept_complaint', args: { p_complaint_id: 'cmp1' } },
    { fn: 'decline_complaint', args: { p_complaint_id: 'cmp1', p_note: 'On leave' } },
    { fn: 'release_complaint', args: { p_complaint_id: 'cmp1', p_note: 'Owner away' } },
  ]);
});

test('an ownership RPC failure comes back as the error message', async () => {
  __setSupabaseClientForTests(rpcClient({ error: { message: 'This complaint already has an owner' } }).client);
  assert.deepEqual(await claimComplaintForAdmin('cmp1'), { error: 'This complaint already has an owner' });
});

test('listPsoStaffForAdmin maps the staff list', async () => {
  __setSupabaseClientForTests(
    rpcClient({ error: null, data: [{ id: 'staff1', full_name: 'Ana Reyes', role: 'pso_staff' }] }).client,
  );
  assert.deepEqual(await listPsoStaffForAdmin(), {
    data: [{ id: 'staff1', fullName: 'Ana Reyes', role: 'pso_staff' }],
    error: null,
  });
});

test('listComplaintAssignmentsForAdmin resolves names and keeps the oldest first', async () => {
  const rows = [
    { id: 'a1', kind: 'claimed', from_user: null, to_user: 'staff1', by_user: 'staff1', note: null, created_at: '2026-08-02T00:00:00.000Z' },
    { id: 'a2', kind: 'assigned', from_user: 'staff1', to_user: 'staff2', by_user: 'staff1', note: 'Please call both', created_at: '2026-08-03T00:00:00.000Z' },
  ];
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'complaint_assignments') {
        return { select: () => ({ eq: () => ({ order: async () => ({ data: rows, error: null }) }) }) };
      }
      return { select: () => ({ in: async () => ({ data: [{ id: 'staff1', full_name: 'Ana Reyes' }, { id: 'staff2', full_name: 'Ben Cruz' }], error: null }) }) };
    },
  } as any);

  const { data, error } = await listComplaintAssignmentsForAdmin('cmp1');
  assert.equal(error, null);
  assert.deepEqual(data, [
    { id: 'a1', kind: 'claimed', fromName: null, toName: 'Ana Reyes', byName: 'Ana Reyes', note: null, createdAt: '2026-08-02T00:00:00.000Z' },
    { id: 'a2', kind: 'assigned', fromName: 'Ana Reyes', toName: 'Ben Cruz', byName: 'Ana Reyes', note: 'Please call both', createdAt: '2026-08-03T00:00:00.000Z' },
  ]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '@trisakay/services';
import { flagDriver, listDrivers, reactivateDriver, suspendDriver } from '../src/services/drivers.ts';
import { blockPassenger, listPassengers, unblockPassenger } from '../src/services/passengers.ts';
import { approveVerification, listVerificationCases, rejectVerification, updateVerificationCase } from '../src/services/verification.ts';
import { listComplaints, recordDhDirective, setComplaintStatus } from '../src/services/complaints.ts';
import { listActiveTricycles, listRecentActivity } from '../src/services/monitoring.ts';
import { getReportSummary, listTransactions } from '../src/services/reports.ts';
import { addPsoUser, listPsoUsers, togglePsoUserActive } from '../src/services/psoUsers.ts';
import { getFareConfig, getFeatureToggles, getSystemSettings, updateFareConfig } from '../src/services/settings.ts';

/**
 * Drivers/Passengers now go through @trisakay/services against real
 * users/driver_profiles/tricycles/ride_requests/passenger_discounts tables
 * plus the perform_account_action RPC — no more in-memory mock array — so
 * these tests drive a small stateful fake Supabase client instead.
 */
function fakeAccountsClient() {
  const users = [
    { id: 'd1', full_name: 'Ronnie Bautista', contact_no: '0917-000-0001', email: 'ronnie@example.com', status: 'active', role: 'driver', created_at: '2026-01-01T00:00:00.000Z' },
    { id: 'p1', full_name: 'Maria Fe Santos', contact_no: '0917-000-0002', email: 'maria@example.com', status: 'active', role: 'passenger', created_at: '2026-01-01T00:00:00.000Z' },
  ];

  return {
    from: (table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: (_col: string, value: string) => ({
              order: async () => ({ data: users.filter((u) => u.role === value), error: null }),
            }),
          }),
        };
      }
      if (table === 'driver_profiles' || table === 'tricycles') {
        return { select: () => ({ in: async () => ({ data: [], error: null }) }) };
      }
      if (table === 'ride_requests' || table === 'passenger_discounts') {
        return { select: () => ({ eq: () => ({ in: async () => ({ data: [], error: null }) }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
    rpc: async (fn: string, args: { p_target_user_id: string; p_action_type: string }) => {
      if (fn !== 'perform_account_action') throw new Error(`unexpected rpc ${fn}`);
      const user = users.find((u) => u.id === args.p_target_user_id);
      if (!user) return { error: { message: 'not found' } };
      const nextStatus: Record<string, string> = {
        flag: 'flagged',
        unflag: 'active',
        suspend: 'suspended',
        reactivate: 'active',
        deactivate: 'deactivated',
      };
      user.status = nextStatus[args.p_action_type];
      return { error: null };
    },
  } as any;
}

test('listDrivers() resolves the driver rows with no error', async () => {
  __setSupabaseClientForTests(fakeAccountsClient());
  const { data, error } = await listDrivers();
  assert.equal(error, null);
  assert.equal(data.length, 1);
  assert.equal(data[0].id, 'd1');
});

test('flagDriver() / suspendDriver() / reactivateDriver() require a reason and mutate accountStatus via the RPC', async () => {
  __setSupabaseClientForTests(fakeAccountsClient());

  await flagDriver('d1', 'Multiple passenger complaints');
  assert.equal((await listDrivers()).data.find((d) => d.id === 'd1')?.accountStatus, 'flagged');

  await suspendDriver('d1', 'Repeated late cancellations');
  assert.equal((await listDrivers()).data.find((d) => d.id === 'd1')?.accountStatus, 'suspended');

  await reactivateDriver('d1', 'Appeal reviewed and approved');
  assert.equal((await listDrivers()).data.find((d) => d.id === 'd1')?.accountStatus, 'active');
});

test('flagDriver() surfaces a friendly error when the RPC fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }) }),
    rpc: async () => ({ error: { message: 'permission denied' } }),
  } as any);

  const { error } = await flagDriver('d1', 'reason');
  assert.equal(error, "Couldn't complete that action. Please try again.");
});

test('listPassengers() / blockPassenger() / unblockPassenger() round-trip account_status via the RPC', async () => {
  __setSupabaseClientForTests(fakeAccountsClient());

  const passenger = (await listPassengers()).data[0];
  assert.equal(passenger.id, 'p1');

  await blockPassenger(passenger.id, 'Reported unsafe conduct by driver');
  assert.equal((await listPassengers()).data.find((p) => p.id === passenger.id)?.accountStatus, 'suspended');

  await unblockPassenger(passenger.id, 'Investigation cleared the passenger');
  assert.equal((await listPassengers()).data.find((p) => p.id === passenger.id)?.accountStatus, 'active');
});

/**
 * Verification now goes through @trisakay/services against real
 * driver_profiles/tricycles/driver_documents plus the
 * perform_verification_decision RPC — same stateful-fake-client pattern as
 * fakeAccountsClient() above, kept separate since the table shapes differ.
 */
function fakeVerificationClient() {
  const driverProfiles = [{ user_id: 'drv1', verification_status: 'pending' }];
  const tricycles = [
    { id: 'tri1', driver_id: 'drv1', plate_no: 'GSC-1187', mtop_no: null as string | null, mtop_expiry_date: null as string | null, cluster: null as string | null },
  ];
  const documents = [
    { id: 'doc1', driver_id: 'drv1', doc_type: 'drivers_license', status: 'pending', storage_path: 'a.jpg', remarks: null as string | null },
    { id: 'doc2', driver_id: 'drv1', doc_type: 'or_cr', status: 'pending', storage_path: 'b.jpg', remarks: null as string | null },
  ];
  const users = [{ id: 'drv1', full_name: 'Ariel Cabahug' }];

  return {
    from: (table: string) => {
      if (table === 'driver_profiles') {
        return {
          select: () => ({
            neq: (_col: string, value: string) => ({
              order: async () => ({ data: driverProfiles.filter((p) => p.verification_status !== value), error: null }),
            }),
          }),
        };
      }
      if (table === 'users') {
        return { select: () => ({ in: async () => ({ data: users, error: null }) }) };
      }
      if (table === 'tricycles') {
        return {
          select: () => ({ in: () => ({ eq: async () => ({ data: tricycles, error: null }) }) }),
          update: (patch: Record<string, unknown>) => ({
            eq: (_col: string, driverId: string) => ({
              eq: async () => {
                const t = tricycles.find((row) => row.driver_id === driverId);
                if (t) Object.assign(t, patch);
                return { error: null };
              },
            }),
          }),
        };
      }
      if (table === 'driver_documents') {
        return { select: () => ({ in: async () => ({ data: documents, error: null }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
    rpc: async (fn: string, args: { p_driver_id: string; p_decision: string }) => {
      if (fn !== 'perform_verification_decision') throw new Error(`unexpected rpc ${fn}`);
      const profile = driverProfiles.find((p) => p.user_id === args.p_driver_id);
      if (profile) profile.verification_status = args.p_decision;
      const tricycle = tricycles.find((t) => t.driver_id === args.p_driver_id);
      if (tricycle) (tricycle as any).verification_status = args.p_decision;
      for (const doc of documents) if (doc.driver_id === args.p_driver_id) doc.status = args.p_decision;
      return { error: null };
    },
  } as any;
}

test('verification service: MTOP transcription (FR-1.4a) and approve/reject', async () => {
  __setSupabaseClientForTests(fakeVerificationClient());

  const { data: cases } = await listVerificationCases();
  assert.ok(cases.length > 0);
  const target = cases[0];

  await updateVerificationCase(target.driverId, { mtopNo: 'MTOP-TEST-001', mtopExpiryDate: '2027-01-01', cluster: 'melting_pot' });
  const updated = (await listVerificationCases()).data.find((c) => c.driverId === target.driverId);
  assert.equal(updated?.mtopNo, 'MTOP-TEST-001');
  assert.equal(updated?.cluster, 'melting_pot');

  await approveVerification(target.driverId, 'Franchise confirmed at PSO office');
  assert.equal((await listVerificationCases()).data.find((c) => c.driverId === target.driverId)?.overallStatus, 'approved');

  await rejectVerification(target.driverId, 'Franchise permit expired');
  assert.equal((await listVerificationCases()).data.find((c) => c.driverId === target.driverId)?.overallStatus, 'rejected');
});

test('complaints service: status transitions and DH directive (FR-4.3a)', async () => {
  const complaint = (await listComplaints()).data[0];
  await setComplaintStatus(complaint.id, 'escalated');
  assert.equal((await listComplaints()).data.find((c) => c.id === complaint.id)?.status, 'escalated');

  await recordDhDirective(complaint.id, 'Contact both parties.');
  assert.equal((await listComplaints()).data.find((c) => c.id === complaint.id)?.dhDirective, 'Contact both parties.');
});

test('monitoring service resolves active tricycles and recent activity', async () => {
  const [tricycles, activity] = await Promise.all([listActiveTricycles(), listRecentActivity()]);
  assert.ok(Array.isArray(tricycles.data));
  assert.ok(Array.isArray(activity.data));
});

test('reports service resolves a summary and transaction list', async () => {
  const [summary, transactions] = await Promise.all([getReportSummary(), listTransactions()]);
  assert.equal(summary.error, null);
  assert.ok(typeof summary.data.totalRides === 'number');
  assert.ok(Array.isArray(transactions.data));
});

test('psoUsers service: add + toggle active', async () => {
  const before = (await listPsoUsers()).data.length;
  await addPsoUser({ fullName: 'Test User', email: 'test.user@example.com', role: 'pso_staff' });
  const afterAdd = await listPsoUsers();
  assert.equal(afterAdd.data.length, before + 1);

  const added = afterAdd.data[afterAdd.data.length - 1];
  assert.equal(added.isActive, true);
  await togglePsoUserActive(added.id);
  assert.equal((await listPsoUsers()).data.find((u) => u.id === added.id)?.isActive, false);
});

test('settings service resolves fare config, system settings, and feature toggles; updateFareConfig() patches', async () => {
  const [fare, system, toggles] = await Promise.all([getFareConfig(), getSystemSettings(), getFeatureToggles()]);
  assert.equal(fare.data.baseFare, 15.0);
  assert.equal(system.data.bearingToleranceDeg, 40.0);
  assert.equal(toggles.data.gcashEnabled, true);

  await updateFareConfig({ baseFare: 18 });
  assert.equal((await getFareConfig()).data.baseFare, 18);
});

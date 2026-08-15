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

test('verification service: MTOP transcription (FR-1.4a) and approve/reject', async () => {
  const { data: cases } = await listVerificationCases();
  assert.ok(cases.length > 0);
  const target = cases[0];

  await updateVerificationCase(target.driverId, { mtopNo: 'MTOP-TEST-001', mtopExpiryDate: '2027-01-01', cluster: 'melting_pot' });
  const updated = (await listVerificationCases()).data.find((c) => c.driverId === target.driverId);
  assert.equal(updated?.mtopNo, 'MTOP-TEST-001');
  assert.equal(updated?.cluster, 'melting_pot');

  await approveVerification(target.driverId);
  assert.equal((await listVerificationCases()).data.find((c) => c.driverId === target.driverId)?.overallStatus, 'approved');

  await rejectVerification(target.driverId);
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

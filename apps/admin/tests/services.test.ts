import test from 'node:test';
import assert from 'node:assert/strict';
import { flagDriver, listDrivers, reactivateDriver, suspendDriver } from '../src/services/drivers.ts';
import { blockPassenger, listPassengers, unblockPassenger } from '../src/services/passengers.ts';
import { approveVerification, listVerificationCases, rejectVerification, updateVerificationCase } from '../src/services/verification.ts';
import { listComplaints, recordDhDirective, setComplaintStatus } from '../src/services/complaints.ts';
import { listActiveTricycles, listRecentActivity } from '../src/services/monitoring.ts';
import { getReportSummary, listTransactions } from '../src/services/reports.ts';
import { addPsoUser, listPsoUsers, togglePsoUserActive } from '../src/services/psoUsers.ts';
import { getFareConfig, getFeatureToggles, getSystemSettings, updateFareConfig } from '../src/services/settings.ts';

test('listDrivers() resolves a non-empty array with no error', async () => {
  const { data, error } = await listDrivers();
  assert.equal(error, null);
  assert.ok(Array.isArray(data) && data.length > 0);
});

test('flagDriver() / suspendDriver() / reactivateDriver() mutate accountStatus', async () => {
  const before = (await listDrivers()).data[0];
  await flagDriver(before.id);
  assert.equal((await listDrivers()).data.find((d) => d.id === before.id)?.accountStatus, 'flagged');

  await suspendDriver(before.id);
  assert.equal((await listDrivers()).data.find((d) => d.id === before.id)?.accountStatus, 'suspended');

  await reactivateDriver(before.id);
  assert.equal((await listDrivers()).data.find((d) => d.id === before.id)?.accountStatus, 'active');
});

test('listPassengers() / blockPassenger() / unblockPassenger() round-trip account_status', async () => {
  const passenger = (await listPassengers()).data[0];
  await blockPassenger(passenger.id);
  assert.equal((await listPassengers()).data.find((p) => p.id === passenger.id)?.accountStatus, 'suspended');
  await unblockPassenger(passenger.id);
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

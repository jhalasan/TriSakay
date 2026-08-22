import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '@trisakay/services';
import { flagDriver, listDrivers, reactivateDriver, suspendDriver } from '../src/services/drivers.ts';
import { blockPassenger, listPassengers, unblockPassenger } from '../src/services/passengers.ts';
import { approveVerification, listVerificationCases, rejectVerification, updateVerificationCase } from '../src/services/verification.ts';
import {
  listComplaints,
  recordComplaintResolution,
  recordDhDirective,
  scheduleComplaintMediation,
  setComplaintStatus,
} from '../src/services/complaints.ts';
import { listActiveTricycles, getActiveTricycleLocations } from '../src/services/monitoring.ts';
import { getReportSummary, listTransactions, getRidesRevenueOverTime, getPeakHourHistogram, dateRangeSinceIso } from '../src/services/reports.ts';
import { getRidesPerDay, getTripStatusBreakdown } from '../src/services/dashboard.ts';
import { getSignedDocumentUrl } from '../src/services/documents.ts';
import { addPsoUser, disablePsoUser, enablePsoUser, listPsoUsers } from '../src/services/psoUsers.ts';
import { getFareConfig, getFeatureToggles, getSystemSettings, updateFareConfig } from '../src/services/settings.ts';
import { listEmergencyAlerts, markAlertReviewed } from '../src/services/emergency.ts';

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

function fakeComplaintsClient() {
  const complaints = [
    {
      id: 'cmp1',
      submitted_by: 'p1',
      against_user_id: 'd1',
      category: 'fare',
      subject: 'Driver refused agreed fare',
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
      if (table === 'users') return { select: () => ({ in: async () => ({ data: users, error: null }) }) };
      throw new Error(`unexpected table ${table}`);
    },
    auth: { getSession: async () => ({ data: { session: { user: { id: 'staff1' } } } }) },
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

test('complaints service: status transitions and DH directive (FR-4.3a)', async () => {
  __setSupabaseClientForTests(fakeComplaintsClient());

  const complaint = (await listComplaints()).data[0];
  await setComplaintStatus(complaint.id, 'escalated');
  assert.equal((await listComplaints()).data.find((c) => c.id === complaint.id)?.status, 'escalated');

  await recordDhDirective(complaint.id, 'Contact both parties.');
  assert.equal((await listComplaints()).data.find((c) => c.id === complaint.id)?.dhDirective, 'Contact both parties.');
});

test('complaints service: mediation scheduling and outcome recording (FR-4.5/4.6)', async () => {
  __setSupabaseClientForTests(fakeComplaintsClient());

  const complaint = (await listComplaints()).data[0];
  await scheduleComplaintMediation(complaint.id, '2026-09-01T09:00:00.000Z', 'PSO Office');
  const scheduled = (await listComplaints()).data.find((c) => c.id === complaint.id);
  assert.equal(scheduled?.status, 'mediation_scheduled');
  assert.equal(scheduled?.mediationMeetingAt, '2026-09-01T09:00:00.000Z');
  assert.equal(scheduled?.mediationLocation, 'PSO Office');

  await recordComplaintResolution(complaint.id, 'resolved', 'Fare refunded at mediation.');
  const resolved = (await listComplaints()).data.find((c) => c.id === complaint.id);
  assert.equal(resolved?.status, 'resolved');
  assert.equal(resolved?.resolutionNotes, 'Fare refunded at mediation.');
});

function fakeEmergencyClient() {
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
      if (table === 'users') return { select: () => ({ in: async () => ({ data: users, error: null }) }) };
      throw new Error(`unexpected table ${table}`);
    },
    auth: { getSession: async () => ({ data: { session: { user: { id: 'supervisor1' } } } }) },
  } as any;
}

test('emergency service: lists alerts with resolved names and marks one reviewed (FR-12.4/12.5)', async () => {
  __setSupabaseClientForTests(fakeEmergencyClient());

  const alert = (await listEmergencyAlerts()).data[0];
  assert.equal(alert.triggeredByName, 'Ferdinand Amaro');
  assert.equal(alert.counterpartName, 'Maria Fe Santos');
  assert.equal(alert.status, 'logged');

  await markAlertReviewed(alert.id, 'Contacted both parties, no further action.');

  const reviewed = (await listEmergencyAlerts()).data.find((a) => a.id === alert.id);
  assert.equal(reviewed?.status, 'reviewed');
  assert.equal(reviewed?.reviewedByName, 'Rina Cabuslay');
  assert.equal(reviewed?.notes, 'Contacted both parties, no further action.');
});

test('monitoring service resolves on-duty drivers, splitting active trips from idle ones', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'driver_profiles') {
        return { select: () => ({ eq: async () => ({ data: [{ user_id: 'drv1' }, { user_id: 'drv2' }], error: null }) }) };
      }
      if (table === 'users') {
        return {
          select: () => ({
            in: async () => ({
              data: [
                { id: 'drv1', full_name: 'Ronnie Bautista' },
                { id: 'drv2', full_name: 'Ariel Cabahug' },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'tricycles') {
        return {
          select: () => ({
            in: () => ({
              eq: async () => ({
                data: [
                  { driver_id: 'drv1', plate_no: 'GSC-1187', seat_capacity: 6 },
                  { driver_id: 'drv2', plate_no: 'GSC-2214', seat_capacity: 4 },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'trips') {
        return {
          select: () => ({
            in: () => ({ eq: async () => ({ data: [{ id: 'trip1', driver_id: 'drv1', max_seats: 6 }], error: null }) }),
          }),
        };
      }
      if (table === 'ride_requests') {
        return {
          select: () => ({
            in: () => ({ in: async () => ({ data: [{ trip_id: 'trip1', seats_requested: 3 }], error: null }) }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await listActiveTricycles();
  assert.equal(error, null);
  assert.equal(data.length, 2);

  const onTrip = data.find((r) => r.driverId === 'drv1');
  assert.equal(onTrip?.tripStatus, 'active');
  assert.equal(onTrip?.seatsTaken, 3);
  assert.equal(onTrip?.maxSeats, 6);

  const idle = data.find((r) => r.driverId === 'drv2');
  assert.equal(idle?.tripStatus, 'idle');
  assert.equal(idle?.seatsTaken, 0);
  assert.equal(idle?.maxSeats, 4);
});

test('reports service resolves a summary', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'ride_requests') {
        return { select: () => ({ eq: () => ({ gte: async () => ({ data: [{ requested_at: '2026-08-05T07:00:00.000Z' }], error: null }) }) }) };
      }
      if (table === 'transactions') {
        return { select: () => ({ eq: () => ({ gte: async () => ({ data: [{ amount: '18.00' }], error: null }) }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const summary = await getReportSummary('30d');
  assert.equal(summary.error, null);
  assert.equal(summary.data.totalRides, 1);
  assert.equal(summary.data.totalRevenue, 18);
});

test('reports service resolves a transaction list', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'transactions') {
        return {
          select: () => ({
            gte: () => ({
              order: async () => ({
                data: [{ id: 'txn1', ride_request_id: 'rr1', amount: '18.00', method: 'cash', status: 'paid', created_at: '2026-08-05T07:00:00.000Z' }],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'ride_requests') {
        return { select: () => ({ in: async () => ({ data: [{ id: 'rr1', passenger_id: 'p1', trip_id: null }], error: null }) }) };
      }
      if (table === 'users') {
        return { select: () => ({ in: async () => ({ data: [{ id: 'p1', full_name: 'Maria Fe Santos' }], error: null }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const transactions = await listTransactions('30d');
  assert.equal(transactions.error, null);
  assert.equal(transactions.data.length, 1);
  assert.equal(transactions.data[0].passengerName, 'Maria Fe Santos');
  assert.equal(transactions.data[0].driverName, '—');
});

function fakePsoUsersClient() {
  const users = [{ id: 'pso1', full_name: 'Jasmin Oclarit', email: 'j.oclarit@pso.gensantos.gov.ph', role: 'pso_staff', status: 'active', created_at: '2025-05-20T00:00:00.000Z' }];

  return {
    from: (table: string) => {
      if (table !== 'users') throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({ in: () => ({ order: async () => ({ data: users, error: null }) }) }),
      };
    },
    functions: {
      invoke: async (fn: string, opts: { body: { fullName: string; email: string; role: string } }) => {
        if (fn !== 'admin-create-pso-user') throw new Error(`unexpected function ${fn}`);
        users.push({
          id: 'pso2',
          full_name: opts.body.fullName,
          email: opts.body.email,
          role: opts.body.role,
          status: 'active',
          created_at: '2026-08-17T00:00:00.000Z',
        });
        return { data: { userId: 'pso2', tempPassword: 'Tq7!generated', error: null }, error: null };
      },
    },
    rpc: async (fn: string, args: { p_target_user_id: string; p_action_type: string }) => {
      if (fn !== 'perform_account_action') throw new Error(`unexpected rpc ${fn}`);
      const user = users.find((u) => u.id === args.p_target_user_id);
      if (user) user.status = args.p_action_type === 'suspend' ? 'suspended' : 'active';
      return { error: null };
    },
  } as any;
}

test('psoUsers service: add + disable/enable', async () => {
  __setSupabaseClientForTests(fakePsoUsersClient());

  const before = (await listPsoUsers()).data.length;
  const { tempPassword, error: addError } = await addPsoUser({ fullName: 'Test User', email: 'test.user@example.com', role: 'pso_staff' });
  assert.equal(addError, null);
  assert.equal(tempPassword, 'Tq7!generated');

  const afterAdd = await listPsoUsers();
  assert.equal(afterAdd.data.length, before + 1);

  const added = afterAdd.data.find((u) => u.id === 'pso2')!;
  assert.equal(added.isActive, true);

  await disablePsoUser(added.id, 'Left the PSO office');
  assert.equal((await listPsoUsers()).data.find((u) => u.id === added.id)?.isActive, false);

  await enablePsoUser(added.id, 'Rehired');
  assert.equal((await listPsoUsers()).data.find((u) => u.id === added.id)?.isActive, true);
});

function fakeSettingsClient() {
  const fareConfig = { base_fare: 15.0, base_km: 4.0, rate_per_km: 1.0, discount_rate_percent: 20.0, ordinance_ref: 'Ordinance No. 08, s.2023' };
  const systemSettings = {
    bearing_tolerance_deg: 40.0,
    detour_ratio_max: 1.25,
    search_radius_km: 3.0,
    low_rating_threshold: 3.0,
    gcash_enabled: true,
    cash_enabled: true,
    franchise_expiry_notifications: true,
  };

  return {
    from: (table: string) => {
      if (table === 'fare_config') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: fareConfig, error: null }) }) }) };
      }
      if (table === 'system_settings') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: systemSettings, error: null }) }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
    rpc: async (fn: string, args: { p_base_fare: number; p_base_km: number; p_rate_per_km: number }) => {
      if (fn !== 'update_fare_config') throw new Error(`unexpected rpc ${fn}`);
      fareConfig.base_fare = args.p_base_fare;
      fareConfig.base_km = args.p_base_km;
      fareConfig.rate_per_km = args.p_rate_per_km;
      return { data: 'fare1', error: null };
    },
  } as any;
}

test('settings service resolves fare config, system settings, and feature toggles; updateFareConfig() patches', async () => {
  __setSupabaseClientForTests(fakeSettingsClient());

  const [fare, system, toggles] = await Promise.all([getFareConfig(), getSystemSettings(), getFeatureToggles()]);
  assert.equal(fare.data!.baseFare, 15.0);
  assert.equal(system.data!.bearingToleranceDeg, 40.0);
  assert.equal(toggles.data!.gcashEnabled, true);

  await updateFareConfig({ baseFare: 18, baseKm: 4.0, ratePerKm: 1.0 });
  assert.equal((await getFareConfig()).data!.baseFare, 18);
});

test('updateFareConfig() rejects an incomplete patch instead of silently sending undefined fields to the RPC', async () => {
  __setSupabaseClientForTests(fakeSettingsClient());

  const { error } = await updateFareConfig({ baseFare: 18 });
  assert.equal(error, 'Base fare, base distance, and rate per km are all required.');
});

test('getRidesPerDay() resolves 7 daily buckets with no error', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ eq: () => ({ gte: async () => ({ data: [], error: null }) }) }) }),
  } as any);

  const { data, error } = await getRidesPerDay();
  assert.equal(error, null);
  assert.equal(data.length, 7);
});

test('getTripStatusBreakdown() resolves counts per TripStatus with no error', async () => {
  __setSupabaseClientForTests({
    from: () => ({
      select: () => ({
        eq: async (_column: string, value: unknown) => ({ count: value === 'active' ? 5 : 1, error: null }),
      }),
    }),
  } as any);

  const { data, error } = await getTripStatusBreakdown();
  assert.equal(error, null);
  assert.equal(data.find((d) => d.status === 'active')?.count, 5);
});

test('getRidesRevenueOverTime() applies dateRangeSinceIso(range) to the gte(...) call', async () => {
  let capturedSince: string | null = null;

  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'ride_requests') {
        return {
          select: () => ({
            eq: () => ({
              gte: async (_col: string, value: string) => {
                capturedSince = value;
                return { data: [], error: null };
              },
            }),
          }),
        };
      }
      if (table === 'transactions') {
        return { select: () => ({ eq: () => ({ gte: async () => ({ data: [], error: null }) }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await getRidesRevenueOverTime('7d');
  assert.equal(error, null);
  assert.deepEqual(data, []);
  assert.ok(capturedSince !== null);
  assert.ok(Math.abs(new Date(capturedSince!).getTime() - new Date(dateRangeSinceIso('7d')).getTime()) < 1000);
});

test('getPeakHourHistogram() applies dateRangeSinceIso(range) to the gte(...) call', async () => {
  let capturedSince: string | null = null;

  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'ride_requests') {
        return {
          select: () => ({
            eq: () => ({
              gte: async (_col: string, value: string) => {
                capturedSince = value;
                return { data: [], error: null };
              },
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await getPeakHourHistogram('quarter');
  assert.equal(error, null);
  assert.equal(data.length, 12);
  assert.equal(capturedSince, dateRangeSinceIso('quarter'));
});


test('getActiveTricycleLocations() resolves grid cells with no error', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'driver_profiles') return { select: () => ({ eq: async () => ({ data: [], error: null }) }) };
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await getActiveTricycleLocations();
  assert.equal(error, null);
  assert.deepEqual(data, []);
});

test('getSignedDocumentUrl() resolves a signed URL with no error', async () => {
  __setSupabaseClientForTests({
    storage: {
      from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: 'https://example.test/signed/abc' }, error: null }) }),
    },
  } as any);

  const { url, error } = await getSignedDocumentUrl('driver-docs', 'drv1/drivers_license-123.jpg');
  assert.equal(error, null);
  assert.equal(url, 'https://example.test/signed/abc');
});

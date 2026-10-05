import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRidesRevenueReport } from '../src/lib/reports/ridesRevenueReport.ts';
import { buildFranchiseReport, expiryStatusText } from '../src/lib/reports/franchiseReport.ts';
import { buildComplaintsStatsReport, COMPLAINT_LIST_CAP } from '../src/lib/reports/complaintsStatsReport.ts';
import { buildDriverRosterReport } from '../src/lib/reports/driverRosterReport.ts';
import { manilaDateKey } from '../src/lib/format.ts';
import type { ReportModel, ReportSection } from '../src/lib/reports/types.ts';
import type { TransactionRow } from '../src/types/report.ts';
import type { TricycleRow } from '../src/types/tricycle.ts';
import type { ComplaintRow } from '../src/types/complaint.ts';
import type { DriverRow } from '../src/types/driver.ts';

const section = (report: ReportModel, heading: string): ReportSection => report.sections.find((s) => s.heading === heading)!;
const text = (value: unknown) => JSON.stringify(value);
const tableRows = (s: ReportSection): string[][] => {
  const block = s.blocks.find((b) => b.type === 'table');
  return block && block.type === 'table' ? block.rows : [];
};
const factRows = (s: ReportSection): [string, string][] => {
  const block = s.blocks.find((b) => b.type === 'facts');
  return block && block.type === 'facts' ? block.rows : [];
};

// ---------------------------------------------------------------- rides and revenue

function txn(i: number, overrides: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: `t${i}`,
    rideRequestId: `r${i}`,
    passengerName: 'A',
    driverName: 'B',
    amount: 20,
    method: 'cash',
    status: 'paid',
    rideStatus: 'completed',
    createdAt: '2026-10-03T01:00:00.000Z',
    ...overrides,
  };
}

const SUMMARY = { totalRides: 30, totalRevenue: 630, averageFare: 21, peakHourLabel: '2:00 PM–4:00 PM', totalRidesDeltaPct: 12.5, totalRevenueDeltaPct: null };

function ridesInput(overrides: Record<string, unknown> = {}) {
  return {
    periodLabel: 'Last 30 days · 5 September to 5 October 2026',
    previousLabel: 'previous 30 days',
    summary: SUMMARY,
    daily: [{ day: 'Oct 2', rides: 3, revenue: 46 }, { day: 'Oct 3', rides: 6, revenue: 165 }],
    peakHours: [{ hourLabel: '12:00 AM–2:00 AM', count: 0 }, { hourLabel: '2:00 PM–4:00 PM', count: 9 }],
    transactions: [txn(1), txn(2, { method: 'gcash', amount: 15 }), txn(3, { rideStatus: 'cancelled', amount: 15 }), txn(4, { status: 'pending', amount: 18 })],
    transactionsTruncated: false,
    ...overrides,
  };
}

test('the rides and revenue summary shows the totals with the change since the previous period', () => {
  const report = buildRidesRevenueReport(ridesInput());

  assert.equal(report.kind, 'report_rides');
  assert.equal(report.title, 'Rides and Revenue Summary');
  assert.equal(report.reference, 'Last 30 days · 5 September to 5 October 2026');
  assert.equal(report.open, false);
  const facts = factRows(section(report, 'Summary'));
  assert.deepEqual(facts[0], ['Completed rides', '30 (+12.5% vs previous 30 days)']);
  assert.deepEqual(facts[1], ['Revenue', '₱630.00 (No earlier period to compare with)']);
  assert.deepEqual(facts[2], ['Average fare', '₱21.00']);
  assert.deepEqual(facts[3], ['Busiest hours', '2:00 PM–4:00 PM']);
});

test('payment methods count only paid payments on completed rides, with a total row', () => {
  const rows = tableRows(section(buildRidesRevenueReport(ridesInput()), 'Payment methods'));

  assert.deepEqual(rows, [
    ['Cash', '1', '₱20.00'],
    ['GCash', '1', '₱15.00'],
    ['Total', '2', '₱35.00'],
  ]);
});

test('payment notes call out paid payments on cancelled rides and completed rides still unpaid, apart from revenue', () => {
  const notes = factRows(section(buildRidesRevenueReport(ridesInput()), 'Payment notes'));

  assert.deepEqual(notes[0], ['Paid payments on cancelled rides (not counted as revenue)', '1 · ₱15.00']);
  assert.deepEqual(notes[1], ['Completed rides with the payment still pending', '1 · ₱18.00']);
});

test('busiest hours list only the windows that had rides', () => {
  const rows = tableRows(section(buildRidesRevenueReport(ridesInput()), 'Busiest hours'));
  assert.deepEqual(rows, [['2:00 PM–4:00 PM', '9']]);
});

test('a period with no rides prints "none" lines instead of empty tables', () => {
  const report = buildRidesRevenueReport(
    ridesInput({ summary: { ...SUMMARY, totalRides: 0, totalRevenue: 0, averageFare: 0, peakHourLabel: '—' }, daily: [], peakHours: [], transactions: [] }),
  );

  assert.equal(section(report, 'Payment methods').emptyText, 'No paid payments on completed rides in this period.');
  assert.equal(section(report, 'Rides and revenue by day').emptyText, 'No completed rides in this period.');
  assert.equal(section(report, 'Busiest hours').emptyText, 'No completed rides in this period.');
});

test('a cut-off payment list is flagged under the payment methods', () => {
  const report = buildRidesRevenueReport(ridesInput({ transactionsTruncated: true }));
  assert.match(text(section(report, 'Payment methods')), /most recent 2,000 payments/);
  assert.doesNotMatch(text(section(buildRidesRevenueReport(ridesInput()), 'Payment methods')), /2,000/);
});

// ---------------------------------------------------------------- franchise status

function dayFromToday(offset: number): string {
  return new Date(Date.parse(manilaDateKey()) + offset * 86_400_000).toISOString().slice(0, 10);
}

function tricycle(i: number, expiryOffset: number | null, overrides: Partial<TricycleRow> = {}): TricycleRow {
  return {
    id: `tr${i}`,
    driverId: `d${i}`,
    driverName: `Driver ${i}`,
    driverContactNo: '09000000000',
    driverAccountStatus: 'active',
    plateNo: `GSC-000${i}`,
    bodyNo: String(i).padStart(3, '0'),
    seatCapacity: 4,
    cluster: 'red',
    verificationStatus: 'approved',
    mtopNo: `MTOP-${i}`,
    mtopExpiryDate: expiryOffset === null ? null : dayFromToday(expiryOffset),
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

test('the franchise report lists the most urgent tricycles first: lapsed, expiring, no expiry, then valid', () => {
  const report = buildFranchiseReport({
    tricycles: [tricycle(1, 200), tricycle(2, null), tricycle(3, 9), tricycle(4, -12), tricycle(5, -2)],
    asOfIso: new Date().toISOString(),
  });

  const plates = tableRows(section(report, 'Tricycles by franchise status')).map((r) => r[0]);
  assert.deepEqual(plates, ['GSC-0004', 'GSC-0005', 'GSC-0003', 'GSC-0002', 'GSC-0001']);
});

test('the franchise summary counts each group and the verification states', () => {
  const report = buildFranchiseReport({
    tricycles: [tricycle(1, 200), tricycle(2, null, { verificationStatus: 'pending' }), tricycle(3, 9), tricycle(4, -12), tricycle(5, 0)],
    asOfIso: new Date().toISOString(),
  });

  const facts = Object.fromEntries(factRows(section(report, 'Summary')));
  assert.equal(facts['Lapsed franchises'], '1');
  assert.equal(facts['Expiring within 30 days'], '2');
  assert.equal(facts['No expiry date on file'], '1');
  assert.equal(facts['Valid (more than 30 days left)'], '1');
  assert.match(facts['Verification'], /4 approved · 1 pending · 0 rejected · 0 not submitted/);
  assert.match(report.reference, /5 active tricycles/);
});

test('each row shows the plate, Tricycle ID, cluster, driver, MTOP number, expiry date and a plain status', () => {
  const report = buildFranchiseReport({ tricycles: [tricycle(1, 9, { mtopExpiryDate: '2026-12-25' })], asOfIso: new Date().toISOString() });
  const row = tableRows(section(report, 'Tricycles by franchise status'))[0];

  assert.deepEqual(row.slice(0, 6), ['GSC-0001', '001', 'Red', 'Driver 1', 'MTOP-1', '25 Dec 2026']);
});

test('the franchise report never prints a driver phone number, and says so when there are no tricycles', () => {
  const withData = buildFranchiseReport({ tricycles: [tricycle(1, 9)], asOfIso: new Date().toISOString() });
  assert.doesNotMatch(text(withData), /0900000000/);

  const empty = buildFranchiseReport({ tricycles: [], asOfIso: new Date().toISOString() });
  assert.equal(section(empty, 'Tricycles by franchise status').emptyText, 'No active tricycles are registered.');
});

test('expiryStatusText gives the same wording as the Tricycles screen', () => {
  assert.equal(expiryStatusText(null), 'No expiry on file');
  assert.equal(expiryStatusText(-12), 'Lapsed 12d ago');
  assert.equal(expiryStatusText(0), 'Expires today');
  assert.equal(expiryStatusText(9), 'Expires in 9d');
  assert.equal(expiryStatusText(30), 'Expires in 30d');
  assert.equal(expiryStatusText(31), 'Valid, 31d left');
});

// ---------------------------------------------------------------- complaints statistics

function complaint(i: number, overrides: Partial<ComplaintRow> = {}): ComplaintRow {
  return {
    id: `0000${i}0000-0000-0000-0000-0000000${String(i).padStart(5, '0')}`,
    subject: `Subject ${i}`,
    message: 'Message',
    submittedById: 'p1',
    submittedByName: 'Sample Passenger',
    againstUserId: 'd1',
    againstUserName: 'Sample Driver',
    rideRequestId: null,
    category: 'fare',
    status: 'open',
    dhDirective: null,
    mediationMeetingAt: null,
    mediationLocation: null,
    resolutionNotes: null,
    businessDaysElapsed: 1,
    createdAt: '2026-10-01T02:00:00.000Z',
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
    businessDaysUnowned: 1,
    ...overrides,
  };
}

test('the complaints report counts only complaints filed in the period', () => {
  const report = buildComplaintsStatsReport({
    complaints: [complaint(1), complaint(2, { createdAt: '2026-08-01T00:00:00.000Z' })],
    periodLabel: 'Last 30 days',
    sinceIso: '2026-09-05T00:00:00.000Z',
  });
  const facts = Object.fromEntries(factRows(section(report, 'Summary')));
  assert.equal(facts['Complaints filed'], '1');
  assert.equal(tableRows(section(report, 'Complaints in this period')).length, 1);

  const allTime = buildComplaintsStatsReport({ complaints: [complaint(1), complaint(2, { createdAt: '2026-08-01T00:00:00.000Z' })], periodLabel: 'All time', sinceIso: null });
  assert.equal(Object.fromEntries(factRows(section(allTime, 'Summary')))['Complaints filed'], '2');
});

test('the summary counts open, closed, overdue, unowned and the average time to close', () => {
  const report = buildComplaintsStatsReport({
    complaints: [
      complaint(1, { status: 'under_review', businessDaysElapsed: 5, assignedToId: 'u1', assignedToName: 'Sample Staff' }),
      complaint(2, { status: 'open', businessDaysElapsed: 2 }),
      complaint(3, { status: 'resolved', createdAt: '2026-10-01T00:00:00.000Z', resolvedAt: '2026-10-03T00:00:00.000Z' }),
      complaint(4, { status: 'dismissed', createdAt: '2026-10-01T00:00:00.000Z', resolvedAt: '2026-10-05T00:00:00.000Z' }),
    ],
    periodLabel: 'All time',
    sinceIso: null,
  });

  const facts = Object.fromEntries(factRows(section(report, 'Summary')));
  assert.equal(facts['Complaints filed'], '4');
  assert.equal(facts['Still open'], '2');
  assert.equal(facts['Closed (resolved or dismissed)'], '2');
  assert.equal(facts['Overdue (more than 3 business days, not yet handled)'], '1');
  assert.equal(facts['Open and not owned by anyone'], '1');
  assert.equal(facts['Average time to close'], '3.0 days');
});

test('with nothing closed the average time says it is not available instead of showing zero', () => {
  const report = buildComplaintsStatsReport({ complaints: [complaint(1)], periodLabel: 'All time', sinceIso: null });
  assert.equal(Object.fromEntries(factRows(section(report, 'Summary')))['Average time to close'], 'Not available yet');
});

test('status and category tables list every value, including the ones with no complaints', () => {
  const report = buildComplaintsStatsReport({ complaints: [complaint(1, { category: 'safety', status: 'escalated' })], periodLabel: 'All time', sinceIso: null });

  assert.deepEqual(tableRows(section(report, 'By status')), [
    ['Open', '0'],
    ['Under Review', '0'],
    ['Escalated', '1'],
    ['Mediation Scheduled', '0'],
    ['Resolved', '0'],
    ['Dismissed', '0'],
  ]);
  assert.equal(tableRows(section(report, 'By category')).length, 6);
  assert.deepEqual(tableRows(section(report, 'By category')).find((r) => r[0] === 'Safety'), ['Safety', '1']);
});

test('the list is newest first, shortens long subjects, and stops at the cap with a note', () => {
  const many = Array.from({ length: COMPLAINT_LIST_CAP + 5 }, (_, i) =>
    complaint(i + 1, { createdAt: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString(), subject: i === 0 ? 'x'.repeat(100) : `Subject ${i}` }),
  );
  const report = buildComplaintsStatsReport({ complaints: many, periodLabel: 'All time', sinceIso: null });

  const rows = tableRows(section(report, 'Complaints in this period'));
  assert.equal(rows.length, COMPLAINT_LIST_CAP);
  assert.ok(rows[0][0].startsWith('#'));
  assert.match(text(section(report, 'Complaints in this period')), /Showing the 200 most recent of 205 complaints/);
  assert.ok(many.length > rows.length);
});

test('a period with no complaints says so', () => {
  const report = buildComplaintsStatsReport({ complaints: [], periodLabel: 'Last 7 days', sinceIso: '2026-09-28T00:00:00.000Z' });
  assert.equal(section(report, 'Complaints in this period').emptyText, 'No complaints were filed in this period.');
  assert.equal(Object.fromEntries(factRows(section(report, 'Summary')))['Complaints filed'], '0');
});

// ---------------------------------------------------------------- driver roster

function driver(i: number, overrides: Partial<DriverRow> = {}): DriverRow {
  return {
    id: `d${i}`,
    firstName: 'F',
    lastName: 'L',
    fullName: `Driver ${i}`,
    contactNo: '09000000009',
    email: `d${i}@example.test`,
    accountStatus: 'active',
    verificationStatus: 'approved',
    ratingAvg: 4.25,
    ratingCount: 8,
    plateNo: `GSC-000${i}`,
    cluster: 'white',
    tripCount: 12,
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

test('the driver roster is sorted by name and shows plate, cluster, verification, account, rating and trips', () => {
  const report = buildDriverRosterReport({ drivers: [driver(2), driver(1)], asOfIso: '2026-10-05T07:15:00.000Z' });

  assert.equal(report.kind, 'report_drivers');
  assert.equal(report.reference, 'As of 5 October 2026 · 2 drivers');
  const rows = tableRows(section(report, 'Drivers'));
  assert.deepEqual(rows[0], ['Driver 1', 'GSC-0001', 'White', 'Approved', 'Active', '4.3 (8)', '12']);
  assert.equal(rows[1][0], 'Driver 2');
});

test('the roster summary counts verification and account states, and unrated or unassigned drivers show a dash', () => {
  const report = buildDriverRosterReport({
    drivers: [driver(1), driver(2, { verificationStatus: 'pending', accountStatus: 'suspended', ratingCount: 0, ratingAvg: 0, plateNo: '', cluster: null })],
    asOfIso: '2026-10-05T07:15:00.000Z',
  });

  const facts = Object.fromEntries(factRows(section(report, 'Summary')));
  assert.equal(facts['Verification'], '1 approved · 1 pending · 0 rejected · 0 not submitted');
  assert.equal(facts['Account status'], '1 active · 0 flagged · 1 suspended · 0 deactivated');
  assert.deepEqual(tableRows(section(report, 'Drivers'))[1].slice(1, 3), ['—', '—']);
  assert.equal(tableRows(section(report, 'Drivers'))[1][5], '—');
});

test('the roster never prints phone numbers or emails', () => {
  const report = buildDriverRosterReport({ drivers: [driver(1)], asOfIso: '2026-10-05T07:15:00.000Z' });
  assert.doesNotMatch(text(report), /0900000000/);
  assert.doesNotMatch(text(report), /@example\.test/);
});

test('an empty roster says so', () => {
  const report = buildDriverRosterReport({ drivers: [], asOfIso: '2026-10-05T07:15:00.000Z' });
  assert.equal(section(report, 'Drivers').emptyText, 'No drivers are registered.');
});

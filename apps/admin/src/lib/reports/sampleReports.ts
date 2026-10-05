import type { ReportMeta, ReportModel } from './types.ts';

/** Made-up cases for previewing the layout (scripts/previewReportPdf.ts) and for tests. No real people or numbers. */
export const SAMPLE_META: ReportMeta = {
  docNo: 'PSO-CMP-2026-000123',
  printedAt: '2026-10-05T07:15:00.000Z',
  printedByName: 'Sample Supervisor',
  printedByRole: 'PSO Supervisor',
};

const LONG_MESSAGE =
  'The driver asked for a higher fare than the amount shown in the app after we had already arrived at the drop-off point. ' +
  'I paid the amount in the app but he kept asking for more and spoke to me rudely in front of the other passengers. ' +
  'I would like the office to look into this and remind the driver of the approved fare. ' +
  'The fare in the app was ₱20.00 and he asked for ₱50.00 for a trip of less than three kilometers.';

export function sampleComplaintReport(): ReportModel {
  return {
    kind: 'complaint',
    title: 'Complaint Case Report',
    reference: 'Ref. #A1B2 · filed 1 October 2026',
    status: 'Under review',
    open: true,
    sections: [
      {
        heading: 'Parties',
        blocks: [
          {
            type: 'facts',
            rows: [
              ['Complainant', 'Sample Passenger (Passenger)'],
              ['Respondent', 'Sample Driver (Driver)'],
              ['Current owner', 'Sample Staff, PSO Staff — accepted 2 October 2026, 9:30 AM'],
            ],
          },
        ],
      },
      {
        heading: 'Linked ride',
        blocks: [
          {
            type: 'facts',
            rows: [
              ['Ride reference', '#9F3C21 · 30 September 2026, 4:10 PM'],
              ['Pickup', 'Barangay Dadiangas West'],
              ['Drop-off', 'Barangay Lagao'],
              ['Fare', '₱20.00'],
              ['Driver and plate', 'Sample Driver · GSC-0000'],
            ],
          },
        ],
      },
      {
        heading: 'Complaint',
        blocks: [
          { type: 'facts', rows: [['Category', 'Fare'], ['Subject', 'Driver asked for more than the app fare']] },
          { type: 'paragraph', text: LONG_MESSAGE },
        ],
      },
      {
        heading: 'Case handling',
        blocks: [
          {
            type: 'table',
            columns: ['Step', 'By', 'Date and time'],
            widths: [150, '*', 150],
            rows: [
              ['Filed', 'Sample Passenger', '1 October 2026, 10:02 AM'],
              ['Triaged', 'Sample Staff', '2 October 2026, 9:41 AM'],
              ['Department Head directive', 'Sample Supervisor', '3 October 2026, 2:15 PM'],
            ],
          },
          { type: 'paragraph', text: 'Directive: Contact both parties and schedule MTFRB mediation.' },
        ],
      },
      {
        heading: 'Assignment history',
        blocks: [
          {
            type: 'table',
            columns: ['Action', 'By', 'To', 'Date and time'],
            widths: [70, '*', '*', 130],
            rows: [
              ['Claimed', 'Sample Staff', '—', '2 October 2026, 9:30 AM'],
              ['Assigned', 'Sample Supervisor', 'Sample Staff', '2 October 2026, 9:12 AM'],
            ],
          },
        ],
      },
      { heading: 'Resolution', blocks: [], emptyText: 'Not resolved yet.' },
      { heading: 'Evidence', blocks: [], emptyText: 'No evidence was attached.' },
    ],
  };
}

export function sampleSosReport(): ReportModel {
  return {
    kind: 'sos_alert',
    title: 'SOS Alert Incident Report',
    reference: 'Alert #7D2E · 4 October 2026, 8:41 PM',
    status: 'Closed',
    open: false,
    sections: [
      {
        heading: 'People',
        blocks: [
          {
            type: 'facts',
            rows: [
              ['Triggered by', 'Sample Passenger (Passenger)'],
              ['Counterpart', 'Sample Driver (Driver)'],
              ['Tricycle', 'GSC-0000'],
            ],
          },
        ],
      },
      {
        heading: 'Location',
        blocks: [
          { type: 'facts', rows: [['Coordinates', '6.11280, 125.17170']] },
          { type: 'qr', text: 'https://www.google.com/maps?q=6.11280,125.17170', caption: 'Scan to open the location on a map' },
        ],
      },
      {
        heading: 'Ride summary',
        blocks: [
          {
            type: 'facts',
            rows: [
              ['Ride reference', '#4B8A10 · 4 October 2026, 8:20 PM'],
              ['Pickup', 'Barangay Dadiangas West'],
              ['Drop-off', 'Barangay Bula'],
              ['Ride status', 'Ongoing at the time of the alert'],
            ],
          },
        ],
      },
      {
        heading: 'Review record',
        blocks: [
          {
            type: 'facts',
            rows: [
              ['Reviewed by', 'Sample Supervisor · 5 October 2026, 8:05 AM'],
              ['Review note', 'Called both parties. The passenger is safe; the driver took a wrong turn and the passenger panicked.'],
              ['Closed by', 'Sample Supervisor · 5 October 2026, 8:20 AM'],
            ],
          },
        ],
      },
    ],
  };
}

// ---- summary reports (made-up data, for previews and tests)

import { buildComplaintsStatsReport } from './complaintsStatsReport.ts';
import { buildDriverRosterReport } from './driverRosterReport.ts';
import { buildFranchiseReport } from './franchiseReport.ts';
import { buildRidesRevenueReport } from './ridesRevenueReport.ts';

const SAMPLE_NOW = '2026-10-05T07:15:00.000Z';

export function sampleRidesRevenueReport(): ReportModel {
  return buildRidesRevenueReport({
    periodLabel: 'Last 30 days · 5 September to 5 October 2026',
    previousLabel: 'previous 30 days',
    summary: { totalRides: 30, totalRevenue: 630, averageFare: 21, peakHourLabel: '2:00 PM–4:00 PM', totalRidesDeltaPct: 12.5, totalRevenueDeltaPct: -4.2 },
    daily: [
      { day: 'Sep 29', rides: 3, revenue: 45 },
      { day: 'Sep 30', rides: 2, revenue: 30 },
      { day: 'Oct 1', rides: 2, revenue: 30 },
      { day: 'Oct 2', rides: 3, revenue: 46 },
      { day: 'Oct 3', rides: 6, revenue: 165 },
    ],
    peakHours: [
      { hourLabel: '6:00 AM–8:00 AM', count: 5 },
      { hourLabel: '2:00 PM–4:00 PM', count: 10 },
      { hourLabel: '4:00 PM–6:00 PM', count: 4 },
    ],
    transactions: [
      { id: 't1', rideRequestId: 'r1', passengerName: 'A', driverName: 'B', amount: 570, method: 'cash', status: 'paid', rideStatus: 'completed', createdAt: SAMPLE_NOW },
      { id: 't2', rideRequestId: 'r2', passengerName: 'A', driverName: 'B', amount: 60, method: 'gcash', status: 'paid', rideStatus: 'completed', createdAt: SAMPLE_NOW },
      { id: 't3', rideRequestId: 'r3', passengerName: 'A', driverName: 'B', amount: 231, method: 'cash', status: 'paid', rideStatus: 'cancelled', createdAt: SAMPLE_NOW },
      { id: 't4', rideRequestId: 'r4', passengerName: 'A', driverName: 'B', amount: 18, method: 'cash', status: 'pending', rideStatus: 'completed', createdAt: SAMPLE_NOW },
    ],
    transactionsTruncated: false,
  });
}

export function sampleFranchiseReport(): ReportModel {
  const clusters = ['red', 'white', 'apple_green', 'melting_pot'] as const;
  const offsets: (number | null)[] = [-40, -3, 5, 12, 28, null, 90, 160, 220, 300, 45, null];
  const day = (offset: number) => new Date(Date.parse('2026-10-05') + offset * 86_400_000).toISOString().slice(0, 10);
  return buildFranchiseReport({
    asOfIso: SAMPLE_NOW,
    tricycles: offsets.map((offset, i) => ({
      id: `tr${i}`,
      driverId: `d${i}`,
      driverName: `Sample Driver ${i + 1}`,
      driverContactNo: '',
      driverAccountStatus: 'active' as const,
      plateNo: `GSC-${String(1000 + i * 37)}`,
      bodyNo: String(i + 1).padStart(3, '0'),
      seatCapacity: 4,
      cluster: clusters[i % 4],
      verificationStatus: i === 5 ? ('pending' as const) : ('approved' as const),
      mtopNo: offset === null ? '' : `MTOP-${i + 1}`,
      mtopExpiryDate: offset === null ? null : day(offset),
      createdAt: '2026-09-01T00:00:00.000Z',
    })),
  });
}

export function sampleComplaintsStatsReport(): ReportModel {
  const base = {
    message: 'Message',
    submittedById: 'p1',
    submittedByName: 'Sample Passenger',
    againstUserId: 'd1',
    againstUserName: 'Sample Driver',
    rideRequestId: null,
    dhDirective: null,
    mediationMeetingAt: null,
    mediationLocation: null,
    resolutionNotes: null,
    triagedByName: null,
    triagedAt: null,
    dhReviewedByName: null,
    dhReviewedAt: null,
    mediationScheduledByName: null,
    mediationScheduledAt: null,
    resolvedByName: null,
    assignedAt: null,
    assignmentAcceptedAt: null,
    businessDaysUnowned: 1,
  };
  const make = (i: number, o: Record<string, unknown>) =>
    ({ ...base, id: `0000${i}000-0000-0000-0000-00000000${String(i).padStart(4, '0')}`, assignedToId: null, assignedToName: null, resolvedAt: null, ...o }) as never;
  return buildComplaintsStatsReport({
    periodLabel: 'Last 30 days · 5 September to 5 October 2026',
    sinceIso: '2026-09-05T00:00:00.000Z',
    complaints: [
      make(1, { subject: 'Driver asked for more than the app fare', category: 'fare', status: 'under_review', businessDaysElapsed: 5, createdAt: '2026-09-28T02:00:00.000Z', assignedToId: 'u1', assignedToName: 'Sample Staff' }),
      make(2, { subject: 'Rude behaviour during the ride', category: 'conduct', status: 'open', businessDaysElapsed: 1, createdAt: '2026-10-03T02:00:00.000Z' }),
      make(3, { subject: 'Unsafe driving near the market', category: 'safety', status: 'resolved', businessDaysElapsed: 4, createdAt: '2026-09-20T02:00:00.000Z', resolvedAt: '2026-09-24T02:00:00.000Z', assignedToId: 'u1', assignedToName: 'Sample Staff' }),
      make(4, { subject: 'Tricycle was in poor condition', category: 'vehicle_condition', status: 'dismissed', businessDaysElapsed: 2, createdAt: '2026-09-12T02:00:00.000Z', resolvedAt: '2026-09-14T02:00:00.000Z' }),
      make(5, { subject: 'Not accurate location pinning or change of plans', category: 'other', status: 'escalated', businessDaysElapsed: 6, createdAt: '2026-09-25T02:00:00.000Z', assignedToId: 'u2', assignedToName: 'Sample Supervisor' }),
    ],
  });
}

export function sampleDriverRosterReport(): ReportModel {
  const clusters = ['red', 'white', 'apple_green', 'melting_pot'] as const;
  return buildDriverRosterReport({
    asOfIso: SAMPLE_NOW,
    drivers: Array.from({ length: 12 }, (_, i) => ({
      id: `d${i}`,
      firstName: 'Sample',
      lastName: `Driver ${i + 1}`,
      fullName: `Sample Driver ${String(i + 1).padStart(2, '0')}`,
      contactNo: '',
      email: '',
      accountStatus: i === 9 ? ('suspended' as const) : i === 7 ? ('flagged' as const) : ('active' as const),
      verificationStatus: i === 10 ? ('pending' as const) : i === 11 ? ('unsubmitted' as const) : ('approved' as const),
      ratingAvg: 3.5 + (i % 4) * 0.4,
      ratingCount: i === 11 ? 0 : 3 + i,
      plateNo: i === 11 ? '' : `GSC-${1000 + i * 37}`,
      cluster: i === 11 ? null : clusters[i % 4],
      tripCount: i * 4,
      createdAt: '2026-09-01T00:00:00.000Z',
    })),
  });
}

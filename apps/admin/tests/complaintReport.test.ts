import test from 'node:test';
import assert from 'node:assert/strict';
import { buildComplaintReport, type ComplaintReportInput } from '../src/lib/reports/complaintReport.ts';
import type { ReportBlock, ReportSection } from '../src/lib/reports/types.ts';
import type { ComplaintRow } from '../src/types/complaint.ts';

function complaint(overrides: Partial<ComplaintRow> = {}): ComplaintRow {
  return {
    id: 'a1b2c3d4-0000-0000-0000-00000000a1b2',
    subject: 'Driver asked for more than the app fare',
    message: 'He asked for ₱50 instead of ₱20.',
    submittedById: 'p1',
    submittedByName: 'Sample Passenger',
    againstUserId: 'd1',
    againstUserName: 'Sample Driver',
    rideRequestId: 'ride-1',
    category: 'fare',
    status: 'under_review',
    dhDirective: null,
    mediationMeetingAt: null,
    mediationLocation: null,
    resolutionNotes: null,
    businessDaysElapsed: 2,
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
    businessDaysUnowned: 2,
    ...overrides,
  };
}

const RIDE = {
  id: 'ride-0000-0000-0000-00000009f3c21',
  status: 'completed' as const,
  requestedAt: '2026-09-30T08:10:00.000Z',
  completedAt: '2026-09-30T08:30:00.000Z',
  cancelledAt: null,
  pickupLabel: 'Plaza',
  destLabel: 'Market',
  fare: 20,
  passengerName: 'Sample Passenger',
  driverName: 'Sample Driver',
  plateNo: 'GSC-0000',
};

function input(overrides: Partial<ComplaintReportInput> = {}): ComplaintReportInput {
  return {
    complaint: complaint(),
    ride: RIDE,
    assignments: [],
    statusHistory: [],
    evidence: [],
    contacts: { p1: { phone: '09000000001', email: 'p1@example.test' }, d1: { phone: '09000000002', email: null } },
    canSeeContacts: true,
    ...overrides,
  };
}

const section = (sections: ReportSection[], heading: string) => sections.find((s) => s.heading === heading)!;
const allText = (value: unknown) => JSON.stringify(value);
const facts = (block: ReportBlock) => (block.type === 'facts' ? block.rows : []);

test('a full complaint report has the planned sections in order, with header details', () => {
  const report = buildComplaintReport(input());

  assert.equal(report.kind, 'complaint');
  assert.equal(report.title, 'Complaint Case Report');
  assert.equal(report.reference, 'Ref. #A1B2 · filed 1 October 2026');
  assert.equal(report.status, 'Under Review');
  assert.equal(report.open, true);
  assert.deepEqual(report.sections.map((s) => s.heading), [
    'Parties',
    'Linked ride',
    'Complaint',
    'Case handling',
    'Status history',
    'Assignment history',
    'Resolution',
    'Evidence',
  ]);
});

test('a bare complaint (no ride, no respondent, no steps, no evidence) still prints, with "none" lines instead of gaps', () => {
  const report = buildComplaintReport(
    input({ complaint: complaint({ againstUserId: null, againstUserName: null, rideRequestId: null }), ride: null, contacts: {} }),
  );

  assert.equal(section(report.sections, 'Linked ride').emptyText, 'No ride is linked to this complaint.');
  assert.equal(section(report.sections, 'Status history').emptyText, 'No status changes recorded.');
  assert.equal(section(report.sections, 'Assignment history').emptyText, 'Not claimed or assigned yet.');
  assert.equal(section(report.sections, 'Resolution').emptyText, 'Not resolved yet.');
  assert.equal(section(report.sections, 'Evidence').emptyText, 'No evidence was attached.');
  assert.ok(facts(section(report.sections, 'Parties').blocks[0]).some(([label, value]) => label === 'Respondent' && value === 'None named'));
  assert.ok(facts(section(report.sections, 'Parties').blocks[0]).some(([label, value]) => label === 'Current owner' && value === 'Unassigned'));
});

test('phone numbers and emails are printed for a Supervisor and never for PSO Staff, even when the data is present', () => {
  const withContacts = allText(buildComplaintReport(input({ canSeeContacts: true })));
  assert.match(withContacts, /09000000001/);
  assert.match(withContacts, /p1@example\.test/);
  assert.match(withContacts, /09000000002/);

  const staff = allText(buildComplaintReport(input({ canSeeContacts: false })));
  assert.doesNotMatch(staff, /0900000000/);
  assert.doesNotMatch(staff, /@example\.test/);
});

test('every step that happened is listed with who did it and when, in Manila time', () => {
  const report = buildComplaintReport(
    input({
      complaint: complaint({
        triagedAt: '2026-10-02T01:41:00.000Z',
        triagedByName: 'Sample Staff',
        dhReviewedAt: '2026-10-03T06:15:00.000Z',
        dhReviewedByName: 'Sample Supervisor',
        dhDirective: 'Contact both parties.',
        mediationScheduledAt: '2026-10-03T07:00:00.000Z',
        mediationScheduledByName: 'Sample Supervisor',
        mediationMeetingAt: '2026-10-08T01:00:00.000Z',
        mediationLocation: 'PSO Office',
        status: 'resolved',
        resolvedAt: '2026-10-09T03:00:00.000Z',
        resolvedByName: 'Sample Supervisor',
        resolutionNotes: 'Parties agreed on a refund.',
      }),
    }),
  );

  const handling = section(report.sections, 'Case handling');
  const table = handling.blocks[0];
  assert.equal(table.type, 'table');
  assert.deepEqual(table.type === 'table' ? table.rows.map((r) => r[0]) : [], ['Filed', 'Triaged', 'Department Head directive', 'Mediation scheduled', 'Resolved']);
  assert.match(allText(handling), /2 October 2026, 9:41 AM/);
  assert.match(allText(handling), /8 October 2026, 9:00 AM at PSO Office/);
  assert.equal(report.open, false);
  assert.match(allText(section(report.sections, 'Resolution')), /Parties agreed on a refund\./);
});

test('a very long message is kept whole, and the peso sign and Filipino letters are not changed', () => {
  const long = 'Hindi ako binayaran ng ₱150 ni Peña sa Barangay Dadiangas West. '.repeat(300);
  const report = buildComplaintReport(input({ complaint: complaint({ message: long }) }));

  const paragraph = section(report.sections, 'Complaint').blocks.find((b) => b.type === 'paragraph');
  assert.equal(paragraph && paragraph.type === 'paragraph' ? paragraph.text : '', long);
});

test('the report is open until the complaint is resolved or dismissed', () => {
  for (const status of ['open', 'under_review', 'escalated', 'mediation_scheduled'] as const) {
    assert.equal(buildComplaintReport(input({ complaint: complaint({ status }) })).open, true, status);
  }
  for (const status of ['resolved', 'dismissed'] as const) {
    assert.equal(buildComplaintReport(input({ complaint: complaint({ status }) })).open, false, status);
  }
});

test('evidence lists every file, shows the images that loaded and says so for the ones that did not', () => {
  const report = buildComplaintReport(
    input({
      evidence: [
        { name: 'photo-1.jpg', imageDataUrl: 'data:image/jpeg;base64,AAAA' },
        { name: 'photo-2.jpg', imageFailed: true },
        { name: 'receipt.pdf' },
      ],
    }),
  );

  const evidence = section(report.sections, 'Evidence');
  const table = evidence.blocks[0];
  assert.deepEqual(table.type === 'table' ? table.rows : [], [
    ['photo-1.jpg', 'Yes'],
    ['photo-2.jpg', 'Could not be loaded'],
    ['receipt.pdf', 'No (not an image)'],
  ]);
  assert.deepEqual(evidence.blocks.filter((b) => b.type === 'image').length, 1);
});

test('assignment and status history rows carry names, notes and times', () => {
  const report = buildComplaintReport(
    input({
      assignments: [{ id: 'h1', kind: 'assigned', fromName: null, toName: 'Sample Staff', byName: 'Sample Supervisor', note: 'Please take this.', createdAt: '2026-10-02T01:12:00.000Z' }],
      statusHistory: [{ id: 's1', oldStatus: 'open', newStatus: 'under_review', changedByName: 'Sample Staff', changedAt: '2026-10-02T01:41:00.000Z' }],
    }),
  );

  assert.match(allText(section(report.sections, 'Assignment history')), /Please take this\./);
  assert.match(allText(section(report.sections, 'Assignment history')), /Sample Supervisor/);
  assert.match(allText(section(report.sections, 'Status history')), /Under Review/);
  assert.match(allText(section(report.sections, 'Status history')), /Sample Staff/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSosReport, type SosReportInput } from '../src/lib/reports/sosReport.ts';
import type { EmergencyAlertRow } from '../src/types/emergency.ts';
import type { ReportSection } from '../src/lib/reports/types.ts';

function alert(overrides: Partial<EmergencyAlertRow> = {}): EmergencyAlertRow {
  return {
    id: '7d2e0000-0000-0000-0000-00000000007d2e',
    triggeredById: 'p1',
    triggeredByName: 'Sample Passenger',
    triggeredRole: 'passenger',
    counterpartId: 'd1',
    counterpartName: 'Sample Driver',
    tricyclePlateNo: 'GSC-0000',
    rideRequestId: 'ride-1',
    lat: 6.1128,
    lng: 125.1717,
    status: 'closed',
    reviewedByName: 'Sample Supervisor',
    reviewedAt: '2026-10-05T00:05:00.000Z',
    closedByName: 'Sample Admin',
    closedAt: '2026-10-05T00:20:00.000Z',
    notes: 'Called both parties. Everyone is safe.',
    createdAt: '2026-10-04T12:41:00.000Z',
    ...overrides,
  };
}

const RIDE = {
  id: 'ride-0000-0000-0000-000000004b8a10',
  status: 'ongoing' as const,
  requestedAt: '2026-10-04T12:20:00.000Z',
  completedAt: null,
  cancelledAt: null,
  pickupLabel: 'Plaza',
  destLabel: 'Bula',
  fare: 25,
  passengerName: 'Sample Passenger',
  driverName: 'Sample Driver',
  plateNo: 'GSC-0000',
};

function input(overrides: Partial<SosReportInput> = {}): SosReportInput {
  return {
    alert: alert(),
    ride: RIDE,
    contacts: { p1: { phone: '09000000001', email: null }, d1: { phone: '09000000002', email: 'd1@example.test' } },
    canSeeContacts: true,
    chat: null,
    ...overrides,
  };
}

const section = (sections: ReportSection[], heading: string) => sections.find((s) => s.heading === heading)!;
const allText = (value: unknown) => JSON.stringify(value);

test('a closed alert report has the planned sections, the coordinates and a map QR code', () => {
  const report = buildSosReport(input());

  assert.equal(report.kind, 'sos_alert');
  assert.equal(report.title, 'SOS Alert Incident Report');
  assert.equal(report.reference, 'Alert #7D2E · 4 October 2026, 8:41 PM');
  assert.equal(report.status, 'Closed');
  assert.equal(report.open, false);
  assert.deepEqual(report.sections.map((s) => s.heading), ['People', 'Location', 'Ride summary', 'Review record']);

  const location = allText(section(report.sections, 'Location'));
  assert.match(location, /6\.11280, 125\.17170/);
  assert.match(location, /"type":"qr","text":"https:\/\/www\.google\.com\/maps\?q=6\.1128,125\.1717"/);
});

test('the review record shows who reviewed and who closed the alert, with the note', () => {
  const text = allText(section(buildSosReport(input()).sections, 'Review record'));
  assert.match(text, /Sample Supervisor · 5 October 2026, 8:05 AM/);
  assert.match(text, /Called both parties\. Everyone is safe\./);
  assert.match(text, /Sample Admin · 5 October 2026, 8:20 AM/);
});

test('an alert nobody has reviewed yet says so, stays open, and has no closing line', () => {
  const report = buildSosReport(input({ alert: alert({ status: 'logged', reviewedByName: null, reviewedAt: null, closedByName: null, closedAt: null, notes: null }) }));

  assert.equal(report.open, true);
  assert.equal(section(report.sections, 'Review record').emptyText, 'Not reviewed yet.');
  assert.doesNotMatch(allText(report.sections), /Closed by/);
});

test('a reviewed but not closed alert shows the review and no closing line', () => {
  const report = buildSosReport(input({ alert: alert({ status: 'reviewed', closedByName: null, closedAt: null }) }));
  assert.equal(report.open, true);
  assert.match(allText(section(report.sections, 'Review record')), /Reviewed by/);
  assert.doesNotMatch(allText(section(report.sections, 'Review record')), /Closed by/);
});

test('contact details are printed only when allowed', () => {
  assert.match(allText(buildSosReport(input({ canSeeContacts: true })).sections), /09000000001/);
  assert.match(allText(buildSosReport(input({ canSeeContacts: true })).sections), /d1@example\.test/);

  const hidden = allText(buildSosReport(input({ canSeeContacts: false })).sections);
  assert.doesNotMatch(hidden, /0900000000/);
  assert.doesNotMatch(hidden, /@example\.test/);
});

test('an alert with no linked ride still prints, and the plate comes from the alert', () => {
  const report = buildSosReport(input({ ride: null, alert: alert({ rideRequestId: null }) }));
  assert.equal(section(report.sections, 'Ride summary').emptyText, 'No ride is linked to this alert.');
  assert.match(allText(section(report.sections, 'People')), /GSC-0000/);
});

test('the chat thread is left out unless it was asked for', () => {
  assert.ok(!buildSosReport(input({ chat: null })).sections.some((s) => s.heading === 'Chat thread'));
});

test('an included chat thread lists time, sender and text, and shows photos as [Photo]', () => {
  const report = buildSosReport(
    input({
      chat: [
        { id: 'm1', rideRequestId: 'ride-1', senderId: 'p1', kind: 'text', body: 'Please stop here', imagePath: null, containsMaskedPhone: false, createdAt: '2026-10-04T12:30:00.000Z', readAt: null, senderName: 'Sample Passenger', senderRole: 'passenger' },
        { id: 'm2', rideRequestId: 'ride-1', senderId: 'd1', kind: 'image', body: null, imagePath: 'x.jpg', containsMaskedPhone: false, createdAt: '2026-10-04T12:31:00.000Z', readAt: null, senderName: null, senderRole: null },
      ],
    }),
  );

  const chat = section(report.sections, 'Chat thread');
  const text = allText(chat);
  assert.match(text, /Please stop here/);
  assert.match(text, /Sample Passenger \(Passenger\)/);
  assert.match(text, /\[Photo\]/);
  assert.match(text, /4 October 2026, 8:30 PM/);
});

test('an included chat thread with no messages says so', () => {
  const report = buildSosReport(input({ chat: [] }));
  assert.match(section(report.sections, 'Chat thread').emptyText ?? '', /no messages/);
});

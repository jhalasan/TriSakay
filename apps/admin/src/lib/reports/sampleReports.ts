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

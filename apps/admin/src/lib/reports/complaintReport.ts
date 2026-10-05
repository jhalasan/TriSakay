import type { AdminRideMessage, CaseContact, CaseRide } from '@trisakay/services';
import type { ComplaintAssignmentRow, ComplaintStatusHistoryRow } from '../../services/complaints.ts';
import type { ComplaintRow } from '../../types/complaint.ts';
import { formatCurrency, getReferenceCode, titleCaseLabel } from '../format.ts';
import { chatSection } from './chatSection.ts';
import { formatReportDate, formatReportDateTime } from './format.ts';
import type { ReportBlock, ReportModel, ReportSection } from './types.ts';

export interface ComplaintEvidenceItem {
  /** File name as stored. */
  name: string;
  /** The picture, when it is an image that could be loaded. */
  imageDataUrl?: string | null;
  /** True for an image file that could not be loaded; the report then says so instead of dropping it. */
  imageFailed?: boolean;
}

export interface ComplaintReportInput {
  complaint: ComplaintRow;
  ride: CaseRide | null;
  assignments: ComplaintAssignmentRow[];
  statusHistory: ComplaintStatusHistoryRow[];
  evidence: ComplaintEvidenceItem[];
  /** Phone and email by user id. Printed only when `canSeeContacts` is true, whatever this holds. */
  contacts: Record<string, CaseContact>;
  /** Supervisor and Admin only. PSO Staff never get phone numbers or emails on paper. */
  canSeeContacts: boolean;
  /** The ride's chat thread, or null/undefined when it was not asked for. */
  chat?: AdminRideMessage[] | null;
}

const dash = '—';

/** "09171234567 · name@example.com", or nothing when neither is known. */
export function contactLine(contact: CaseContact | undefined): string | null {
  const parts = [contact?.phone, contact?.email].filter((part): part is string => !!part);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function rideFacts(ride: CaseRide): [string, string][] {
  return [
    ['Ride reference', `#${getReferenceCode(ride.id) ?? dash} · ${formatReportDateTime(ride.requestedAt)}`],
    ['Passenger', ride.passengerName ?? dash],
    ['Pickup', ride.pickupLabel ?? dash],
    ['Drop-off', ride.destLabel ?? dash],
    ['Fare', ride.fare != null ? formatCurrency(ride.fare) : dash],
    ['Ride status', titleCaseLabel(ride.status)],
    ['Driver and plate', `${ride.driverName ?? dash} · ${ride.plateNo ?? dash}`],
  ];
}

function partiesSection(input: ComplaintReportInput): ReportSection {
  const { complaint, contacts, canSeeContacts } = input;
  const owner = complaint.assignedToName
    ? complaint.assignmentAcceptedAt
      ? `${complaint.assignedToName} — accepted ${formatReportDateTime(complaint.assignmentAcceptedAt)}`
      : `${complaint.assignedToName} — assigned, not yet accepted`
    : 'Unassigned';

  const rows: [string, string][] = [['Complainant', complaint.submittedByName]];
  if (canSeeContacts) {
    const line = contactLine(contacts[complaint.submittedById]);
    if (line) rows.push(['Complainant contact', line]);
  }
  rows.push(['Respondent', complaint.againstUserName ?? 'None named']);
  if (canSeeContacts && complaint.againstUserId) {
    const line = contactLine(contacts[complaint.againstUserId]);
    if (line) rows.push(['Respondent contact', line]);
  }
  rows.push(['Current owner', owner]);

  return { heading: 'Parties', blocks: [{ type: 'facts', rows }] };
}

function handlingSection(complaint: ComplaintRow): ReportSection {
  const steps: string[][] = [['Filed', complaint.submittedByName, formatReportDateTime(complaint.createdAt)]];
  if (complaint.triagedAt) steps.push(['Triaged', complaint.triagedByName ?? dash, formatReportDateTime(complaint.triagedAt)]);
  if (complaint.dhReviewedAt) steps.push(['Department Head directive', complaint.dhReviewedByName ?? dash, formatReportDateTime(complaint.dhReviewedAt)]);
  if (complaint.mediationScheduledAt) steps.push(['Mediation scheduled', complaint.mediationScheduledByName ?? dash, formatReportDateTime(complaint.mediationScheduledAt)]);
  if (complaint.resolvedAt) steps.push([titleCaseLabel(complaint.status), complaint.resolvedByName ?? dash, formatReportDateTime(complaint.resolvedAt)]);

  const blocks: ReportBlock[] = [
    { type: 'table', columns: ['Step', 'By', 'Date and time'], widths: [150, '*', 150], rows: steps },
    { type: 'facts', rows: [['Business days since filed', String(complaint.businessDaysElapsed)]] },
  ];
  if (complaint.dhDirective) blocks.push({ type: 'facts', rows: [['Department Head directive', complaint.dhDirective]] });
  if (complaint.mediationMeetingAt) {
    const where = complaint.mediationLocation ? ` at ${complaint.mediationLocation}` : '';
    blocks.push({ type: 'facts', rows: [['Mediation meeting', `${formatReportDateTime(complaint.mediationMeetingAt)}${where}`]] });
  }
  return { heading: 'Case handling', blocks };
}

function evidenceSection(evidence: ComplaintEvidenceItem[]): ReportSection {
  if (evidence.length === 0) return { heading: 'Evidence', blocks: [], emptyText: 'No evidence was attached.' };

  const blocks: ReportBlock[] = [
    {
      type: 'table',
      columns: ['File', 'Shown below'],
      widths: ['*', 110],
      rows: evidence.map((item) => [item.name, item.imageDataUrl ? 'Yes' : item.imageFailed ? 'Could not be loaded' : 'No (not an image)']),
    },
  ];
  for (const item of evidence) {
    if (item.imageDataUrl) blocks.push({ type: 'image', dataUrl: item.imageDataUrl, caption: item.name });
  }
  return { heading: 'Evidence', blocks };
}

/** A complaint and everything the office did with it, as a ReportModel. Pure: no network, no PDF. */
export function buildComplaintReport(input: ComplaintReportInput): ReportModel {
  const { complaint, ride, assignments, statusHistory } = input;
  const closed = complaint.status === 'resolved' || complaint.status === 'dismissed';

  const sections: ReportSection[] = [
    partiesSection(input),
    ride
      ? { heading: 'Linked ride', blocks: [{ type: 'facts', rows: rideFacts(ride) }] }
      : { heading: 'Linked ride', blocks: [], emptyText: 'No ride is linked to this complaint.' },
    {
      heading: 'Complaint',
      blocks: [
        { type: 'facts', rows: [['Category', titleCaseLabel(complaint.category)], ['Subject', complaint.subject]] },
        { type: 'paragraph', text: complaint.message },
      ],
    },
    handlingSection(complaint),
    statusHistory.length > 0
      ? {
          heading: 'Status history',
          blocks: [
            {
              type: 'table',
              columns: ['From', 'To', 'By', 'Date and time'],
              widths: [90, 90, '*', 130],
              rows: statusHistory.map((row) => [titleCaseLabel(row.oldStatus), titleCaseLabel(row.newStatus), row.changedByName ?? dash, formatReportDateTime(row.changedAt)]),
            },
          ],
        }
      : { heading: 'Status history', blocks: [], emptyText: 'No status changes recorded.' },
    assignments.length > 0
      ? {
          heading: 'Assignment history',
          blocks: [
            {
              type: 'table',
              columns: ['Action', 'By', 'To', 'Note', 'Date and time'],
              widths: [52, '*', '*', '*', 100],
              rows: assignments.map((row) => [titleCaseLabel(row.kind), row.byName ?? dash, row.toName ?? dash, row.note ?? dash, formatReportDateTime(row.createdAt)]),
            },
          ],
        }
      : { heading: 'Assignment history', blocks: [], emptyText: 'Not claimed or assigned yet.' },
    complaint.resolutionNotes
      ? { heading: 'Resolution', blocks: [{ type: 'facts', rows: [['Outcome', titleCaseLabel(complaint.status)]] }, { type: 'paragraph', text: complaint.resolutionNotes }] }
      : { heading: 'Resolution', blocks: [], emptyText: closed ? 'Closed without resolution notes.' : 'Not resolved yet.' },
    evidenceSection(input.evidence),
  ];
  if (input.chat) sections.push(chatSection(input.chat));

  return {
    kind: 'complaint',
    title: 'Complaint Case Report',
    reference: `Ref. #${getReferenceCode(complaint.id, 4) ?? dash} · filed ${formatReportDate(complaint.createdAt)}`,
    status: titleCaseLabel(complaint.status),
    open: !closed,
    sections,
  };
}

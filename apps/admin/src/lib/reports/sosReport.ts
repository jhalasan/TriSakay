import type { AdminRideMessage, CaseContact, CaseRide } from '@trisakay/services';
import type { EmergencyAlertRow } from '../../types/emergency.ts';
import { getReferenceCode, titleCaseLabel } from '../format.ts';
import { contactLine, rideFacts } from './complaintReport.ts';
import { chatSection } from './chatSection.ts';
import { formatReportDateTime } from './format.ts';
import type { ReportModel, ReportSection } from './types.ts';

export interface SosReportInput {
  alert: EmergencyAlertRow;
  ride: CaseRide | null;
  contacts: Record<string, CaseContact>;
  /** Supervisor and Admin only. */
  canSeeContacts: boolean;
  /** The ride's chat thread, or null when it was not asked for. Loading it goes through the logged, reason-gated call. */
  chat: AdminRideMessage[] | null;
}

const dash = '—';
const ROLE_LABEL = { passenger: 'Passenger', driver: 'Driver' } as const;

/** An SOS alert, who handled it and what was found, as a ReportModel. Pure: no network, no PDF. */
export function buildSosReport(input: SosReportInput): ReportModel {
  const { alert, ride, contacts, canSeeContacts, chat } = input;
  const closed = alert.status === 'closed';

  const people: [string, string][] = [['Triggered by', `${alert.triggeredByName} (${ROLE_LABEL[alert.triggeredRole]})`]];
  if (canSeeContacts) {
    const line = contactLine(contacts[alert.triggeredById]);
    if (line) people.push(['Triggered by contact', line]);
  }
  people.push(['Counterpart', alert.counterpartName ?? dash]);
  if (canSeeContacts && alert.counterpartId) {
    const line = contactLine(contacts[alert.counterpartId]);
    if (line) people.push(['Counterpart contact', line]);
  }
  people.push(['Tricycle', alert.tricyclePlateNo ?? ride?.plateNo ?? dash]);

  const mapLink = `https://www.google.com/maps?q=${alert.lat},${alert.lng}`;

  const review: [string, string][] =
    alert.status === 'logged'
      ? []
      : [
          ['Reviewed by', `${alert.reviewedByName ?? dash}${alert.reviewedAt ? ` · ${formatReportDateTime(alert.reviewedAt)}` : ''}`],
          ['Review note', alert.notes ?? dash],
        ];
  if (closed) review.push(['Closed by', `${alert.closedByName ?? dash}${alert.closedAt ? ` · ${formatReportDateTime(alert.closedAt)}` : ''}`]);

  const sections: ReportSection[] = [
    { heading: 'People', blocks: [{ type: 'facts', rows: people }] },
    {
      heading: 'Location',
      blocks: [
        { type: 'facts', rows: [['Coordinates', `${alert.lat.toFixed(5)}, ${alert.lng.toFixed(5)}`]] },
        { type: 'qr', text: mapLink, caption: 'Scan to open the location on a map' },
      ],
    },
    ride
      ? { heading: 'Ride summary', blocks: [{ type: 'facts', rows: rideFacts(ride) }] }
      : { heading: 'Ride summary', blocks: [], emptyText: 'No ride is linked to this alert.' },
    review.length > 0
      ? { heading: 'Review record', blocks: [{ type: 'facts', rows: review }] }
      : { heading: 'Review record', blocks: [], emptyText: 'Not reviewed yet.' },
  ];
  if (chat) sections.push(chatSection(chat));

  return {
    kind: 'sos_alert',
    title: 'SOS Alert Incident Report',
    reference: `Alert #${getReferenceCode(alert.id, 4) ?? dash} · ${formatReportDateTime(alert.createdAt)}`,
    status: titleCaseLabel(alert.status),
    open: !closed,
    sections,
  };
}

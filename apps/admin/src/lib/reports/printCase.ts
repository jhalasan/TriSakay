import type { AdminRideMessage, CaseContact, CasePrintKind, CasePrintReceipt, CaseRide } from '@trisakay/services';
import { getCaseContacts, getCaseRide, recordCasePrint } from '../../services/caseReports.ts';
import { viewRideMessages } from '../../services/rideChat.ts';
import type { ComplaintAssignmentRow, ComplaintAttachmentRow, ComplaintStatusHistoryRow } from '../../services/complaints.ts';
import type { ComplaintRow } from '../../types/complaint.ts';
import type { EmergencyAlertRow } from '../../types/emergency.ts';
import type { AdminRole } from '../../types/role.ts';
import { isSupervisor, ROLE_LABELS } from '../rbac.ts';
import { buildComplaintReport } from './complaintReport.ts';
import { browserImageLoader, loadEvidenceItems } from './evidenceImages.ts';
import { downloadReportPdf } from './renderPdf.ts';
import { buildSosReport } from './sosReport.ts';
import type { ReportMeta, ReportModel } from './types.ts';

export interface PrintDeps {
  recordPrint: (input: { kind: CasePrintKind; caseId: string; includeChat?: boolean; reason?: string }) => Promise<{ data: CasePrintReceipt | null; error: string | null }>;
  getRide: (rideRequestId: string) => Promise<{ data: CaseRide | null; error: string | null }>;
  getContacts: (userIds: string[]) => Promise<{ data: Record<string, CaseContact>; error: string | null }>;
  loadEvidence: (attachments: { storagePath: string }[]) => ReturnType<typeof loadEvidenceItems>;
  viewChat: (rideRequestId: string, reason: string) => Promise<{ data: AdminRideMessage[]; error: string | null }>;
  download: (model: ReportModel, meta: ReportMeta, filename: string) => Promise<void>;
}

const defaultDeps: PrintDeps = {
  recordPrint: recordCasePrint,
  getRide: getCaseRide,
  getContacts: getCaseContacts,
  loadEvidence: (attachments) => loadEvidenceItems(attachments, browserImageLoader),
  viewChat: viewRideMessages,
  download: downloadReportPdf,
};

export interface PrintResult {
  error: string | null;
  docNo?: string;
}

function metaFrom(receipt: CasePrintReceipt): ReportMeta {
  return {
    docNo: receipt.docNo,
    printedAt: receipt.printedAt,
    printedByName: receipt.printedByName,
    printedByRole: ROLE_LABELS[receipt.printedByRole as AdminRole] ?? receipt.printedByRole,
  };
}

const NO_RIDE = Promise.resolve({ data: null, error: null });
const NO_CONTACTS = Promise.resolve({ data: {} as Record<string, CaseContact>, error: null });

export interface PrintComplaintArgs {
  complaint: ComplaintRow;
  assignments: ComplaintAssignmentRow[];
  statusHistory: ComplaintStatusHistoryRow[];
  attachments: ComplaintAttachmentRow[];
  viewerRole: AdminRole;
  includeChat?: boolean;
  chatReason?: string;
}

/**
 * Prints one complaint. The order matters: the print is recorded first (the database decides whether this person
 * may print it and hands back the document number); if that is refused nothing else runs. Contact details are
 * only fetched for a Supervisor or Admin, and the chat thread only for one of them who gave a reason.
 */
export async function printComplaintReport(args: PrintComplaintArgs, deps: PrintDeps = defaultDeps): Promise<PrintResult> {
  const { complaint, viewerRole } = args;
  const canSeeContacts = isSupervisor(viewerRole);
  const includeChat = !!args.includeChat && canSeeContacts && !!complaint.rideRequestId;

  const recorded = await deps.recordPrint({ kind: 'complaint', caseId: complaint.id, includeChat, reason: args.chatReason });
  if (recorded.error || !recorded.data) return { error: recorded.error ?? 'Could not record this print.' };

  const [ride, contacts, evidence, chat] = await Promise.all([
    complaint.rideRequestId ? deps.getRide(complaint.rideRequestId) : NO_RIDE,
    canSeeContacts ? deps.getContacts([complaint.submittedById, complaint.againstUserId].filter((id): id is string => !!id)) : NO_CONTACTS,
    deps.loadEvidence(args.attachments),
    includeChat && complaint.rideRequestId ? deps.viewChat(complaint.rideRequestId, args.chatReason ?? '') : Promise.resolve(null),
  ]);

  const failure = ride.error ?? contacts.error ?? chat?.error ?? null;
  if (failure) return { error: failure };

  const model = buildComplaintReport({
    complaint,
    ride: ride.data,
    assignments: args.assignments,
    statusHistory: args.statusHistory,
    evidence,
    contacts: contacts.data,
    canSeeContacts,
    chat: chat ? chat.data : null,
  });
  await deps.download(model, metaFrom(recorded.data), `${recorded.data.docNo}.pdf`);
  return { error: null, docNo: recorded.data.docNo };
}

export interface PrintSosArgs {
  alert: EmergencyAlertRow;
  viewerRole: AdminRole;
  includeChat?: boolean;
  chatReason?: string;
}

/** Prints one SOS alert. Same order and rules as printComplaintReport; the database allows only Supervisor and Admin. */
export async function printSosReport(args: PrintSosArgs, deps: PrintDeps = defaultDeps): Promise<PrintResult> {
  const { alert, viewerRole } = args;
  const canSeeContacts = isSupervisor(viewerRole);
  const includeChat = !!args.includeChat && canSeeContacts && !!alert.rideRequestId;

  const recorded = await deps.recordPrint({ kind: 'sos_alert', caseId: alert.id, includeChat, reason: args.chatReason });
  if (recorded.error || !recorded.data) return { error: recorded.error ?? 'Could not record this print.' };

  const [ride, contacts, chat] = await Promise.all([
    alert.rideRequestId ? deps.getRide(alert.rideRequestId) : NO_RIDE,
    canSeeContacts ? deps.getContacts([alert.triggeredById, alert.counterpartId].filter((id): id is string => !!id)) : NO_CONTACTS,
    includeChat && alert.rideRequestId ? deps.viewChat(alert.rideRequestId, args.chatReason ?? '') : Promise.resolve(null),
  ]);

  const failure = ride.error ?? contacts.error ?? chat?.error ?? null;
  if (failure) return { error: failure };

  const model = buildSosReport({ alert, ride: ride.data, contacts: contacts.data, canSeeContacts, chat: chat ? chat.data : null });
  await deps.download(model, metaFrom(recorded.data), `${recorded.data.docNo}.pdf`);
  return { error: null, docNo: recorded.data.docNo };
}

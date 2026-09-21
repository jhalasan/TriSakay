import {
  listComplaintAttachmentsForAdmin,
  listComplaintsForAdmin,
  listComplaintStatusHistoryForAdmin,
  recordComplaintResolutionForAdmin,
  recordDhDirectiveForAdmin,
  scheduleComplaintMediationForAdmin,
  setComplaintStatusForAdmin,
} from '@trisakay/services';
import type { ComplaintAttachmentRow, ComplaintStatusHistoryRow } from '@trisakay/services';
import { businessDaysSince } from '../lib/format.ts';
import type { ComplaintRow, ComplaintStatus } from '../types/complaint';
import type { ServiceResult } from './drivers';

export type { ComplaintAttachmentRow, ComplaintStatusHistoryRow };

export async function listComplaints(): Promise<ServiceResult<ComplaintRow[]>> {
  const { data, error } = await listComplaintsForAdmin();
  if (error) return { data: [], error };

  const rows: ComplaintRow[] = data.map((c) => ({
    id: c.id,
    subject: c.subject,
    message: c.message,
    submittedByName: c.submittedByName,
    againstUserName: c.againstUserName,
    rideRequestId: c.rideRequestId,
    category: c.category,
    status: c.status,
    dhDirective: c.dhDirective,
    mediationMeetingAt: c.mediationMeetingAt,
    mediationLocation: c.mediationLocation,
    resolutionNotes: c.resolutionNotes,
    businessDaysElapsed: businessDaysSince(c.createdAt),
    createdAt: c.createdAt,
  }));

  return { data: rows, error: null };
}

/** FR-4.7 evidence — visible to any PSO the same way the complaint itself is. */
export async function listComplaintAttachments(complaintId: string): Promise<ServiceResult<ComplaintAttachmentRow[]>> {
  const { data, error } = await listComplaintAttachmentsForAdmin(complaintId);
  return { data, error };
}

/** UAT A16 — read-only status-change timeline, written only by a DB trigger (trg_log_complaint_status_change). */
export async function listComplaintStatusHistory(complaintId: string): Promise<ServiceResult<ComplaintStatusHistoryRow[]>> {
  const { data, error } = await listComplaintStatusHistoryForAdmin(complaintId);
  return { data, error };
}

/** PSO Staff triage step (FR-4.3) — not S+ gated. */
export async function setComplaintStatus(id: string, status: ComplaintStatus): Promise<ServiceResult<null>> {
  const { error } = await setComplaintStatusForAdmin(id, status);
  return { data: null, error };
}

/** Department Head directive step (FR-4.3a) — distinct audit record from triage and from the eventual mediation outcome. */
export async function recordDhDirective(id: string, directive: string): Promise<ServiceResult<null>> {
  const { error } = await recordDhDirectiveForAdmin(id, directive);
  return { data: null, error };
}

/** FR-4.5 — Supervisor+ only (enforced by the schedule_complaint_mediation RPC, not RLS). */
export async function scheduleComplaintMediation(
  id: string,
  meetingAt: string,
  location: string,
): Promise<ServiceResult<null>> {
  const { error } = await scheduleComplaintMediationForAdmin(id, meetingAt, location || null);
  return { data: null, error };
}

/** FR-4.6 — Supervisor+ only (enforced by the record_complaint_resolution RPC, not RLS). */
export async function recordComplaintResolution(
  id: string,
  status: 'resolved' | 'dismissed',
  notes: string,
): Promise<ServiceResult<null>> {
  const { error } = await recordComplaintResolutionForAdmin(id, status, notes || null);
  return { data: null, error };
}

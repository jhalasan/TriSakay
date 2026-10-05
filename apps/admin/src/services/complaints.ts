import {
  acceptComplaintForAdmin,
  assignComplaintForAdmin,
  claimComplaintForAdmin,
  declineComplaintForAdmin,
  listComplaintAssignmentsForAdmin,
  listPsoStaffForAdmin,
  releaseComplaintForAdmin,
  listComplaintAttachmentsForAdmin,
  listComplaintsForAdmin,
  listComplaintStatusHistoryForAdmin,
  recordComplaintResolutionForAdmin,
  recordDhDirectiveForAdmin,
  scheduleComplaintMediationForAdmin,
  setComplaintStatusForAdmin,
} from '@trisakay/services';
import type { ComplaintAssignmentRow, ComplaintAttachmentRow, ComplaintStatusHistoryRow, PsoStaffRow } from '@trisakay/services';
import { businessDaysSince } from '../lib/format.ts';
import type { ComplaintRow, ComplaintStatus } from '../types/complaint';
import type { ServiceResult } from './drivers';

export type { ComplaintAssignmentRow, ComplaintAttachmentRow, ComplaintStatusHistoryRow, PsoStaffRow };

export async function listComplaints(): Promise<ServiceResult<ComplaintRow[]>> {
  const { data, error } = await listComplaintsForAdmin();
  if (error) return { data: [], error };

  const rows: ComplaintRow[] = data.map((c) => ({
    id: c.id,
    subject: c.subject,
    message: c.message,
    submittedById: c.submittedById,
    submittedByName: c.submittedByName,
    againstUserId: c.againstUserId,
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
    triagedByName: c.triagedByName,
    triagedAt: c.triagedAt,
    dhReviewedByName: c.dhReviewedByName,
    dhReviewedAt: c.dhReviewedAt,
    mediationScheduledByName: c.mediationScheduledByName,
    mediationScheduledAt: c.mediationScheduledAt,
    resolvedByName: c.resolvedByName,
    resolvedAt: c.resolvedAt,
    assignedToId: c.assignedToId,
    assignedToName: c.assignedToName,
    assignedAt: c.assignedAt,
    assignmentAcceptedAt: c.assignmentAcceptedAt,
    businessDaysUnowned: businessDaysSince(c.assignedToId && c.assignedAt ? c.assignedAt : c.createdAt),
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

/** Complaint ownership — claim, assign (S+), accept, decline, release; see supabase/migrations/20261001000004. */
export async function claimComplaint(id: string): Promise<ServiceResult<null>> {
  const { error } = await claimComplaintForAdmin(id);
  return { data: null, error };
}

export async function assignComplaint(id: string, toUserId: string, note: string): Promise<ServiceResult<null>> {
  const { error } = await assignComplaintForAdmin(id, toUserId, note);
  return { data: null, error };
}

export async function acceptComplaint(id: string): Promise<ServiceResult<null>> {
  const { error } = await acceptComplaintForAdmin(id);
  return { data: null, error };
}

export async function declineComplaint(id: string, note: string): Promise<ServiceResult<null>> {
  const { error } = await declineComplaintForAdmin(id, note);
  return { data: null, error };
}

export async function releaseComplaint(id: string, note: string): Promise<ServiceResult<null>> {
  const { error } = await releaseComplaintForAdmin(id, note);
  return { data: null, error };
}

export async function listPsoStaff(): Promise<ServiceResult<PsoStaffRow[]>> {
  const { data, error } = await listPsoStaffForAdmin();
  return { data, error };
}

export async function listComplaintAssignments(complaintId: string): Promise<ServiceResult<ComplaintAssignmentRow[]>> {
  const { data, error } = await listComplaintAssignmentsForAdmin(complaintId);
  return { data, error };
}

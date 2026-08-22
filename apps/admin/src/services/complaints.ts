import {
  listComplaintsForAdmin,
  recordComplaintResolutionForAdmin,
  recordDhDirectiveForAdmin,
  scheduleComplaintMediationForAdmin,
  setComplaintStatusForAdmin,
} from '@trisakay/services';
import { businessDaysSince } from '../lib/format.ts';
import type { ComplaintRow, ComplaintStatus } from '../types/complaint';
import type { ServiceResult } from './drivers';

export async function listComplaints(): Promise<ServiceResult<ComplaintRow[]>> {
  const { data, error } = await listComplaintsForAdmin();
  if (error) return { data: [], error };

  const rows: ComplaintRow[] = data.map((c) => ({
    id: c.id,
    subject: c.subject,
    submittedByName: c.submittedByName,
    againstUserName: c.againstUserName,
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

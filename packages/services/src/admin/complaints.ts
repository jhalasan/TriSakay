import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types.ts';

export type AdminComplaintCategory = Database['public']['Enums']['complaint_category'];
export type AdminComplaintStatus = Database['public']['Enums']['complaint_status'];

export interface AdminComplaintRow {
  id: string;
  subject: string;
  message: string;
  submittedById: string;
  submittedByName: string;
  againstUserId: string | null;
  againstUserName: string | null;
  rideRequestId: string | null;
  category: AdminComplaintCategory;
  status: AdminComplaintStatus;
  dhDirective: string | null;
  mediationMeetingAt: string | null;
  mediationLocation: string | null;
  resolutionNotes: string | null;
  createdAt: string;
  /** Who acted at each step, and when — null until that step happens. */
  triagedByName: string | null;
  triagedAt: string | null;
  dhReviewedByName: string | null;
  dhReviewedAt: string | null;
  mediationScheduledByName: string | null;
  mediationScheduledAt: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  /** Current owner; null = Unassigned. assignmentAcceptedAt null with an owner = awaiting acceptance. */
  assignedToId: string | null;
  assignedToName: string | null;
  assignedAt: string | null;
  assignmentAcceptedAt: string | null;
}

export interface ListComplaintsForAdminResult {
  data: AdminComplaintRow[];
  error: string | null;
}

/**
 * FR-4.3/4.3a — every complaint, newest first. Name resolution follows the
 * same "no multi-hop embed, one follow-up users lookup" convention as
 * admin/dashboard.ts's resolveUserNames(). `businessDaysElapsed` isn't
 * selected here — the DB's own `business_days_since()` (used by
 * v_overdue_complaints) only covers open/under_review rows, and calling it
 * per-row over PostgREST would mean one RPC call per complaint; the caller
 * computes the equivalent business-day count client-side from `createdAt`
 * instead (see apps/admin/src/lib/format.ts's businessDaysSince()).
 */
export async function listComplaintsForAdmin(): Promise<ListComplaintsForAdminResult> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('complaints')
    .select(
      'id, submitted_by, against_user_id, ride_request_id, category, subject, message, status, dh_directive, mediation_meeting_at, mediation_location, resolution_notes, created_at, triaged_by, triaged_at, dh_reviewed_by, dh_reviewed_at, mediation_scheduled_by, mediation_scheduled_at, resolved_by, resolved_at, assigned_to, assigned_at, assignment_accepted_at',
    )
    .order('created_at', { ascending: false });

  if (error) return { data: [], error: error.message };
  if (!data || data.length === 0) return { data: [], error: null };

  const ids = [...new Set(data.flatMap((c) => [c.submitted_by, c.against_user_id, c.triaged_by, c.dh_reviewed_by, c.mediation_scheduled_by, c.resolved_by, c.assigned_to].filter((id): id is string => !!id)))];
  const { data: users, error: usersError } = await client.from('users').select('id, full_name').in('id', ids);
  if (usersError) return { data: [], error: usersError.message };

  const nameById = new Map((users ?? []).map((u) => [u.id, u.full_name]));

  const rows: AdminComplaintRow[] = data.map((c) => ({
    id: c.id,
    subject: c.subject,
    message: c.message,
    submittedById: c.submitted_by,
    submittedByName: nameById.get(c.submitted_by) ?? '—',
    againstUserId: c.against_user_id,
    againstUserName: c.against_user_id ? (nameById.get(c.against_user_id) ?? null) : null,
    rideRequestId: c.ride_request_id,
    category: c.category,
    status: c.status,
    dhDirective: c.dh_directive,
    mediationMeetingAt: c.mediation_meeting_at,
    mediationLocation: c.mediation_location,
    resolutionNotes: c.resolution_notes,
    createdAt: c.created_at,
    triagedByName: c.triaged_by ? (nameById.get(c.triaged_by) ?? null) : null,
    triagedAt: c.triaged_at,
    dhReviewedByName: c.dh_reviewed_by ? (nameById.get(c.dh_reviewed_by) ?? null) : null,
    dhReviewedAt: c.dh_reviewed_at,
    mediationScheduledByName: c.mediation_scheduled_by ? (nameById.get(c.mediation_scheduled_by) ?? null) : null,
    mediationScheduledAt: c.mediation_scheduled_at,
    resolvedByName: c.resolved_by ? (nameById.get(c.resolved_by) ?? null) : null,
    resolvedAt: c.resolved_at,
    assignedToId: c.assigned_to,
    assignedToName: c.assigned_to ? (nameById.get(c.assigned_to) ?? null) : null,
    assignedAt: c.assigned_at,
    assignmentAcceptedAt: c.assignment_accepted_at,
  }));

  return { data: rows, error: null };
}

export interface ComplaintAttachmentRow {
  id: string;
  storagePath: string;
}

export interface ListComplaintAttachmentsResult {
  data: ComplaintAttachmentRow[];
  error: string | null;
}

/** FR-4.7 evidence — complaint_attachments read; RLS (`complaint_attachments_read`) already lets any is_pso() account read every complaint's evidence, same scope as complaints_read. */
export async function listComplaintAttachmentsForAdmin(complaintId: string): Promise<ListComplaintAttachmentsResult> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('complaint_attachments')
    .select('id, storage_path')
    .eq('complaint_id', complaintId)
    .order('created_at', { ascending: true });

  if (error) return { data: [], error: error.message };

  const rows = (data ?? []).map((row) => ({ id: row.id, storagePath: row.storage_path }));
  return { data: rows, error: null };
}

export interface ComplaintStatusHistoryRow {
  id: string;
  oldStatus: AdminComplaintStatus;
  newStatus: AdminComplaintStatus;
  changedByName: string | null;
  changedAt: string;
}

export interface ListComplaintStatusHistoryResult {
  data: ComplaintStatusHistoryRow[];
  error: string | null;
}

/** UAT A16 — complaint_status_history is written only by trg_log_complaint_status_change (public.complaints), not by any client write path; this is a read-only timeline. */
export async function listComplaintStatusHistoryForAdmin(complaintId: string): Promise<ListComplaintStatusHistoryResult> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('complaint_status_history')
    .select('id, old_status, new_status, changed_by, changed_at')
    .eq('complaint_id', complaintId)
    .order('changed_at', { ascending: true });

  if (error) return { data: [], error: error.message };
  if (!data || data.length === 0) return { data: [], error: null };

  const changerIds = [...new Set(data.map((row) => row.changed_by).filter((id): id is string => !!id))];
  let nameById = new Map<string, string>();
  if (changerIds.length > 0) {
    const { data: users, error: usersError } = await client.from('users').select('id, full_name').in('id', changerIds);
    if (usersError) return { data: [], error: usersError.message };
    nameById = new Map((users ?? []).map((u) => [u.id, u.full_name!]));
  }

  const rows = data.map((row) => ({
    id: row.id,
    oldStatus: row.old_status,
    newStatus: row.new_status,
    changedByName: row.changed_by ? (nameById.get(row.changed_by) ?? null) : null,
    changedAt: row.changed_at,
  }));

  return { data: rows, error: null };
}

export interface AdminComplaintWriteResult {
  error: string | null;
}

/** PSO Staff triage step (FR-4.3) — not S+ gated; `complaints_triage_staff` RLS allows any is_pso() role. */
export async function setComplaintStatusForAdmin(id: string, status: AdminComplaintStatus): Promise<AdminComplaintWriteResult> {
  const client = getSupabaseClient();
  const { data: sessionData } = await client.auth.getSession();
  const staffId = sessionData.session?.user.id;
  if (!staffId) return { error: 'Not signed in' };

  const { error } = await client
    .from('complaints')
    .update({ status, triaged_by: staffId, triaged_at: new Date().toISOString() })
    .eq('id', id);

  return { error: error?.message ?? null };
}

/** Department Head directive step (FR-4.3a) — distinct audit record from triage and from the eventual mediation outcome. */
export async function recordDhDirectiveForAdmin(id: string, directive: string): Promise<AdminComplaintWriteResult> {
  const client = getSupabaseClient();
  const { data: sessionData } = await client.auth.getSession();
  const reviewerId = sessionData.session?.user.id;
  if (!reviewerId) return { error: 'Not signed in' };

  const { error } = await client
    .from('complaints')
    .update({ dh_directive: directive, dh_reviewed_by: reviewerId, dh_reviewed_at: new Date().toISOString() })
    .eq('id', id);

  return { error: error?.message ?? null };
}

/**
 * FR-4.5 — PSO Supervisor/Admin schedules an MTFRB mediation meeting.
 * Goes through the schedule_complaint_mediation RPC rather than a direct
 * update: complaints_triage_staff RLS (is_pso()) would let any PSO Staff
 * write these columns directly, but FR-4.5 restricts this step to
 * Supervisor+ — same reasoning as perform_verification_decision.
 */
export async function scheduleComplaintMediationForAdmin(
  id: string,
  meetingAt: string,
  location: string | null,
): Promise<AdminComplaintWriteResult> {
  const client = getSupabaseClient();
  const { error } = await client.rpc('schedule_complaint_mediation', {
    p_complaint_id: id,
    p_meeting_at: meetingAt,
    p_location: location ?? undefined,
  });

  return { error: error?.message ?? null };
}

/** FR-4.6 — PSO Supervisor/Admin records the mediation outcome/settlement details. Supervisor+ only, same reasoning as scheduleComplaintMediationForAdmin above. */
export async function recordComplaintResolutionForAdmin(
  id: string,
  status: Extract<AdminComplaintStatus, 'resolved' | 'dismissed'>,
  notes: string | null,
): Promise<AdminComplaintWriteResult> {
  const client = getSupabaseClient();
  const { error } = await client.rpc('record_complaint_resolution', {
    p_complaint_id: id,
    p_status: status,
    p_notes: notes ?? undefined,
  });

  return { error: error?.message ?? null };
}

/** Complaint ownership (docs/superpowers/specs/2026-10-01-complaint-ownership-design.md) — every change goes through an RPC, never a direct update. */
export async function claimComplaintForAdmin(id: string): Promise<AdminComplaintWriteResult> {
  const { error } = await getSupabaseClient().rpc('claim_complaint', { p_complaint_id: id });
  return { error: error?.message ?? null };
}

/** Supervisor+ only (enforced by the RPC). The new owner must accept before staff-level actions are allowed. */
export async function assignComplaintForAdmin(id: string, toUserId: string, note: string): Promise<AdminComplaintWriteResult> {
  const { error } = await getSupabaseClient().rpc('assign_complaint', { p_complaint_id: id, p_to_user: toUserId, p_note: note });
  return { error: error?.message ?? null };
}

export async function acceptComplaintForAdmin(id: string): Promise<AdminComplaintWriteResult> {
  const { error } = await getSupabaseClient().rpc('accept_complaint', { p_complaint_id: id });
  return { error: error?.message ?? null };
}

export async function declineComplaintForAdmin(id: string, note: string): Promise<AdminComplaintWriteResult> {
  const { error } = await getSupabaseClient().rpc('decline_complaint', { p_complaint_id: id, p_note: note });
  return { error: error?.message ?? null };
}

export async function releaseComplaintForAdmin(id: string, note: string): Promise<AdminComplaintWriteResult> {
  const { error } = await getSupabaseClient().rpc('release_complaint', { p_complaint_id: id, p_note: note });
  return { error: error?.message ?? null };
}

export interface PsoStaffRow {
  id: string;
  fullName: string;
  role: Database['public']['Enums']['user_role'];
}

/** Active PSO accounts, for the assign picker. */
export async function listPsoStaffForAdmin(): Promise<{ data: PsoStaffRow[]; error: string | null }> {
  const { data, error } = await getSupabaseClient().rpc('list_pso_staff');
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []).map((u) => ({ id: u.id, fullName: u.full_name, role: u.role })), error: null };
}

export interface ComplaintAssignmentRow {
  id: string;
  kind: 'claimed' | 'assigned' | 'accepted' | 'declined' | 'released';
  fromName: string | null;
  toName: string | null;
  byName: string | null;
  note: string | null;
  createdAt: string;
}

/** Append-only handoff history for one complaint, oldest first. */
export async function listComplaintAssignmentsForAdmin(
  complaintId: string,
): Promise<{ data: ComplaintAssignmentRow[]; error: string | null }> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('complaint_assignments')
    .select('id, kind, from_user, to_user, by_user, note, created_at')
    .eq('complaint_id', complaintId)
    .order('created_at', { ascending: true });

  if (error) return { data: [], error: error.message };
  if (!data || data.length === 0) return { data: [], error: null };

  const ids = [...new Set(data.flatMap((r) => [r.from_user, r.to_user, r.by_user].filter((id): id is string => !!id)))];
  let nameById = new Map<string, string>();
  if (ids.length > 0) {
    const { data: users, error: usersError } = await client.from('users').select('id, full_name').in('id', ids);
    if (usersError) return { data: [], error: usersError.message };
    nameById = new Map((users ?? []).map((u) => [u.id, u.full_name!]));
  }

  const name = (id: string | null) => (id ? (nameById.get(id) ?? null) : null);
  return {
    data: data.map((r) => ({
      id: r.id,
      kind: r.kind as ComplaintAssignmentRow['kind'],
      fromName: name(r.from_user),
      toName: name(r.to_user),
      byName: name(r.by_user),
      note: r.note,
      createdAt: r.created_at,
    })),
    error: null,
  };
}

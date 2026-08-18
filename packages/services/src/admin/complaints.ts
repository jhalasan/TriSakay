import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types.ts';

export type AdminComplaintCategory = Database['public']['Enums']['complaint_category'];
export type AdminComplaintStatus = Database['public']['Enums']['complaint_status'];

export interface AdminComplaintRow {
  id: string;
  subject: string;
  submittedByName: string;
  againstUserName: string | null;
  category: AdminComplaintCategory;
  status: AdminComplaintStatus;
  dhDirective: string | null;
  createdAt: string;
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
    .select('id, submitted_by, against_user_id, category, subject, status, dh_directive, created_at')
    .order('created_at', { ascending: false });

  if (error) return { data: [], error: error.message };
  if (!data || data.length === 0) return { data: [], error: null };

  const ids = [...new Set(data.flatMap((c) => [c.submitted_by, c.against_user_id].filter((id): id is string => !!id)))];
  const { data: users, error: usersError } = await client.from('users').select('id, full_name').in('id', ids);
  if (usersError) return { data: [], error: usersError.message };

  const nameById = new Map((users ?? []).map((u) => [u.id, u.full_name]));

  const rows: AdminComplaintRow[] = data.map((c) => ({
    id: c.id,
    subject: c.subject,
    submittedByName: nameById.get(c.submitted_by) ?? '—',
    againstUserName: c.against_user_id ? (nameById.get(c.against_user_id) ?? null) : null,
    category: c.category,
    status: c.status,
    dhDirective: c.dh_directive,
    createdAt: c.created_at,
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

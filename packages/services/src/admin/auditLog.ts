import { getSupabaseClient } from '../supabase/client.ts';
import type { AccountActionType } from './accounts.ts';

export interface AccountActionRow {
  id: string;
  actionType: AccountActionType;
  targetUserId: string;
  targetUserName: string | null;
  performedBy: string;
  performedByName: string | null;
  reason: string;
  complaintId: string | null;
  createdAt: string;
}

export interface ListAccountActionsResult {
  data: AccountActionRow[];
  error: string | null;
}

/**
 * Reads account_actions (docs/SCHEMA.MD §3.2) — the insert-only audit log
 * every Flag/Suspend/Reactivate/Deactivate/Unflag already writes to, across
 * Driver/Passenger/PSO User management, but that nothing in the admin UI
 * reads back until now. RLS (`actions_read_pso`) already lets any signed-in
 * PSO read every row, so no migration is needed for this. Two ids per row
 * (target_user_id, performed_by) — same one-follow-up-query name resolution
 * as listOverdueComplaints() in dashboard.ts, not a multi-hop PostgREST embed.
 */
export async function listAccountActions(): Promise<ListAccountActionsResult> {
  const client = getSupabaseClient();
  const { data, error } = await client.from('account_actions').select('*').order('created_at', { ascending: false });

  if (error) return { data: [], error: error.message };

  const ids = [...new Set((data ?? []).flatMap((row) => [row.target_user_id, row.performed_by]))];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: userRows } = await client.from('users').select('id, full_name').in('id', ids);
    for (const row of userRows ?? []) names.set(row.id, row.full_name!);
  }

  const rows = (data ?? []).map((row) => ({
    id: row.id,
    actionType: row.action_type as AccountActionType,
    targetUserId: row.target_user_id,
    targetUserName: names.get(row.target_user_id) ?? null,
    performedBy: row.performed_by,
    performedByName: names.get(row.performed_by) ?? null,
    reason: row.reason,
    complaintId: row.complaint_id,
    createdAt: row.created_at,
  }));

  return { data: rows, error: null };
}

export type ReviewDecisionType = 'driver_verification' | 'discount';
export type ReviewDecisionStatus = 'approved' | 'rejected';

export interface ReviewDecisionRow {
  id: string;
  type: ReviewDecisionType;
  subjectName: string | null;
  status: ReviewDecisionStatus;
  detail: string | null;
  reviewedBy: string;
  reviewedByName: string | null;
  reviewedAt: string;
}

export interface ListReviewDecisionsResult {
  data: ReviewDecisionRow[];
  error: string | null;
}

/**
 * Driver-verification and fare-discount decisions, merged into one feed —
 * the reviewed_by/reviewed_at stamps perform_verification_decision() and
 * the discounts_review_supervisor RLS policy already write on every
 * Approve/Reject, but that nothing in the admin UI reads back until now
 * (called out as a known gap when listAccountActions() above was added).
 * driver_profiles is the source for verification, not tricycles — F4's
 * perform_verification_decision() stamps verified_by/verified_at
 * identically on both in the same transaction, so reading tricycles too
 * would just duplicate every row. Only decided cases are included (a
 * pending/unsubmitted row has verified_by/reviewed_by null and is filtered
 * out by the `not.is.null` queries below, not client-side).
 */
export async function listReviewDecisions(): Promise<ListReviewDecisionsResult> {
  const client = getSupabaseClient();

  const [{ data: driverRows, error: driverError }, { data: discountRows, error: discountError }] = await Promise.all([
    client
      .from('driver_profiles')
      .select('user_id, verification_status, verified_by, verified_at')
      .not('verified_by', 'is', null)
      .order('verified_at', { ascending: false }),
    client
      .from('passenger_discounts')
      .select('id, passenger_id, category, status, reviewed_by, reviewed_at')
      .not('reviewed_by', 'is', null)
      .order('reviewed_at', { ascending: false }),
  ]);

  if (driverError) return { data: [], error: driverError.message };
  if (discountError) return { data: [], error: discountError.message };

  const ids = [
    ...new Set([
      ...(driverRows ?? []).flatMap((r) => [r.user_id, r.verified_by as string]),
      ...(discountRows ?? []).flatMap((r) => [r.passenger_id, r.reviewed_by as string]),
    ]),
  ];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: userRows } = await client.from('users').select('id, full_name').in('id', ids);
    for (const row of userRows ?? []) names.set(row.id, row.full_name!);
  }

  const driverDecisions: ReviewDecisionRow[] = (driverRows ?? [])
    .filter((r) => r.verification_status === 'approved' || r.verification_status === 'rejected')
    .map((r) => ({
      id: `driver:${r.user_id}`,
      type: 'driver_verification' as const,
      subjectName: names.get(r.user_id) ?? null,
      status: r.verification_status as ReviewDecisionStatus,
      detail: null,
      reviewedBy: r.verified_by as string,
      reviewedByName: names.get(r.verified_by as string) ?? null,
      reviewedAt: r.verified_at as string,
    }));

  const discountDecisions: ReviewDecisionRow[] = (discountRows ?? [])
    .filter((r) => r.status === 'approved' || r.status === 'rejected')
    .map((r) => ({
      id: `discount:${r.id}`,
      type: 'discount' as const,
      subjectName: names.get(r.passenger_id) ?? null,
      status: r.status as ReviewDecisionStatus,
      detail: r.category,
      reviewedBy: r.reviewed_by as string,
      reviewedByName: names.get(r.reviewed_by as string) ?? null,
      reviewedAt: r.reviewed_at as string,
    }));

  const rows = [...driverDecisions, ...discountDecisions].sort((a, b) => (a.reviewedAt < b.reviewedAt ? 1 : -1));

  return { data: rows, error: null };
}

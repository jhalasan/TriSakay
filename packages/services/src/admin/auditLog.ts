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
  /**
   * P1-22 (2026-09-15 launch audit): true when the row cap below was hit,
   * meaning older rows within the requested window exist but weren't
   * returned. account_actions is append-only and has no natural bound
   * (unlike the users/driver_profiles/tricycles lists elsewhere in this
   * app, which scale with headcount, not activity), so an explicit,
   * visible cap replaces what used to be PostgREST's silent default
   * max-rows truncation.
   */
  truncated: boolean;
}

const ACCOUNT_ACTIONS_ROW_CAP = 2000;

/**
 * Reads account_actions (docs/SCHEMA.MD §3.2) — the insert-only audit log
 * every Flag/Suspend/Reactivate/Deactivate/Unflag already writes to, across
 * Driver/Passenger/PSO User management. RLS (`actions_read_pso`) already
 * lets any signed-in PSO read every row, so no migration is needed for that.
 * Two ids per row (target_user_id, performed_by) — same one-follow-up-query
 * name resolution as listOverdueComplaints() in dashboard.ts, not a
 * multi-hop PostgREST embed.
 *
 * `sinceIso` scopes the query server-side to the caller's date-range filter
 * (AuditLog.tsx's default is "last 7 days") — previously this fetched the
 * ENTIRE table on every load and filtered client-side, which is exactly the
 * "grows forever, no natural cap" case P1-22 flagged. Pass `null` for "all
 * time"; the explicit `.limit()` below still applies in that case, so a
 * genuinely huge history degrades to "most recent N, visibly flagged" rather
 * than a silent, unexplained gap.
 */
export async function listAccountActions(sinceIso: string | null = null): Promise<ListAccountActionsResult> {
  const client = getSupabaseClient();
  let query = client.from('account_actions').select('*').order('created_at', { ascending: false }).limit(ACCOUNT_ACTIONS_ROW_CAP);
  if (sinceIso) query = query.gte('created_at', sinceIso);
  const { data, error } = await query;

  if (error) return { data: [], error: error.message, truncated: false };

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

  return { data: rows, error: null, truncated: (data ?? []).length >= ACCOUNT_ACTIONS_ROW_CAP };
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

  // P1-22 (2026-09-15 launch audit): explicit caps, replacing PostgREST's
  // silent default max-rows truncation with a known, documented one. These
  // two are naturally bounded by headcount (one verification decision per
  // driver) or close to it (a passenger can resubmit a discount
  // application, but rarely more than a couple of times), unlike
  // account_actions above — so a generous cap here is a safety net, not the
  // primary fix.
  const [{ data: driverRows, error: driverError }, { data: discountRows, error: discountError }] = await Promise.all([
    client
      .from('driver_profiles')
      .select('user_id, verification_status, verified_by, verified_at')
      .not('verified_by', 'is', null)
      .order('verified_at', { ascending: false })
      .limit(2000),
    client
      .from('passenger_discounts')
      .select('id, passenger_id, category, status, reviewed_by, reviewed_at')
      .not('reviewed_by', 'is', null)
      .limit(2000)
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

export type LoginEventType = 'login' | 'logout';

export interface LoginEventRow {
  id: string;
  userId: string;
  userName: string | null;
  eventType: LoginEventType;
  createdAt: string;
}

export interface ListLoginEventsResult {
  data: LoginEventRow[];
  error: string | null;
  truncated: boolean;
}

const LOGIN_EVENTS_ROW_CAP = 2000;

/**
 * UAT A1: reads login_events (supabase/migrations/20260921000003), the new
 * self-reported sign-in/out audit trail. Same shape as listAccountActions()
 * above — server-side date-range scoping, an explicit row cap with a
 * `truncated` flag, one follow-up users lookup for names.
 */
export async function listLoginEvents(sinceIso: string | null = null): Promise<ListLoginEventsResult> {
  const client = getSupabaseClient();
  let query = client.from('login_events').select('*').order('created_at', { ascending: false }).limit(LOGIN_EVENTS_ROW_CAP);
  if (sinceIso) query = query.gte('created_at', sinceIso);
  const { data, error } = await query;

  if (error) return { data: [], error: error.message, truncated: false };

  const userIds = [...new Set((data ?? []).map((row) => row.user_id))];
  const names = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: userRows } = await client.from('users').select('id, full_name').in('id', userIds);
    for (const row of userRows ?? []) names.set(row.id, row.full_name!);
  }

  const rows: LoginEventRow[] = (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    userName: names.get(row.user_id) ?? null,
    eventType: row.event_type as LoginEventType,
    createdAt: row.created_at,
  }));

  return { data: rows, error: null, truncated: (data ?? []).length >= LOGIN_EVENTS_ROW_CAP };
}

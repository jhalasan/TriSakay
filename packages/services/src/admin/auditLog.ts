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
    for (const row of userRows ?? []) names.set(row.id, row.full_name);
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

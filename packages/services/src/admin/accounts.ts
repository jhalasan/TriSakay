import { getSupabaseClient } from '../supabase/client.ts';

export type AccountActionType = 'flag' | 'unflag' | 'suspend' | 'reactivate' | 'deactivate';

export interface PerformAccountActionResult {
  error: string | null;
}

/**
 * Calls perform_account_action() — the only write path for users.status.
 * That RPC exists because users.status has no PSO-writable RLS policy
 * (only is_admin() can UPDATE public.users directly); the RPC checks
 * authorization itself (is_pso() for flag/unflag, is_supervisor() for
 * suspend/reactivate/deactivate, mirroring the account_actions RLS policy)
 * and atomically inserts the audit row alongside the status change.
 */
export async function performAccountAction(
  targetUserId: string,
  actionType: AccountActionType,
  reason: string,
  complaintId?: string
): Promise<PerformAccountActionResult> {
  const client = getSupabaseClient();
  const { error } = await client.rpc('perform_account_action', {
    p_target_user_id: targetUserId,
    p_action_type: actionType,
    p_reason: reason,
    p_complaint_id: complaintId,
  });

  if (error) return { error: "Couldn't complete that action. Please try again." };
  return { error: null };
}

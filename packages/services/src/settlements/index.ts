import { getSupabaseClient } from '../supabase/client.ts';

async function getSignedInUserId(): Promise<string | null> {
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session?.user.id ?? null;
}

export interface NotifyPsoForSettlementResult {
  error: string | null;
}

/**
 * Logs a settlement notice as the signed-in driver (`driver_id = auth.uid()`,
 * enforced by the `settlements_driver_insert` RLS policy). `notify_pso_on_settlement()`
 * fans this out to every PSO Staff+ account automatically — no money moves
 * through the app; this is a record-keeping action only, matching the
 * driver-facing copy on the button that triggers it.
 */
export async function notifyPsoForSettlement(amount: number): Promise<NotifyPsoForSettlementResult> {
  const userId = await getSignedInUserId();
  if (!userId) return { error: 'Not signed in' };

  const { error } = await getSupabaseClient()
    .from('settlements')
    .insert({ driver_id: userId, amount });

  return { error: error?.message ?? null };
}

export interface MySettlementRow {
  id: string;
  amount: number;
  notifiedAt: string;
}

export interface ListMySettlementsResult {
  data: MySettlementRow[];
  error: string | null;
}

/** The signed-in driver's own settlement notices, newest first. */
export async function listMySettlements(): Promise<ListMySettlementsResult> {
  const userId = await getSignedInUserId();
  if (!userId) return { data: [], error: 'Not signed in' };

  const { data, error } = await getSupabaseClient()
    .from('settlements')
    .select('id, amount, notified_at')
    .eq('driver_id', userId)
    .order('notified_at', { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []).map((row) => ({ id: row.id, amount: row.amount, notifiedAt: row.notified_at })), error: null };
}

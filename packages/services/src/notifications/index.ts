import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types.ts';

export type NotificationRow = Database['public']['Tables']['notifications']['Row'];

async function getSignedInUserId(): Promise<string | null> {
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session?.user.id ?? null;
}

export interface MarkAllNotificationsReadResult {
  error: string | null;
}

/** Marks every unread notification belonging to the signed-in user read (RLS: `notif_own`, `user_id = auth.uid()`). */
export async function markAllNotificationsRead(): Promise<MarkAllNotificationsReadResult> {
  const userId = await getSignedInUserId();
  if (!userId) return { error: 'Not signed in' };

  const { error } = await getSupabaseClient()
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  return { error: error?.message ?? null };
}

/**
 * Live list of the signed-in user's own notifications, same refetch-on-any-
 * change shape as subscribeToPendingRideRequests in booking/index.ts — a
 * single row's read/unread flip and a brand-new row both just trigger a
 * full reconcile query rather than trying to patch the list incrementally.
 */
export function subscribeToNotifications(
  userId: string,
  onData: (rows: NotificationRow[]) => void,
  onError?: (message: string) => void,
): () => void {
  const client = getSupabaseClient();
  let cancelled = false;

  async function refetch() {
    const { data, error } = await client
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (cancelled) return;
    if (error) {
      onError?.(error.message);
      return;
    }
    onData(data ?? []);
  }

  const channel = client
    .channel(`notifications_${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      () => {
        void refetch();
      },
    )
    .subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        void refetch();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        if (!cancelled) onError?.('Lost connection while listening for notifications. Please check your connection.');
      }
    });

  return () => {
    cancelled = true;
    client.removeChannel(channel);
  };
}

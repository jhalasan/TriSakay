import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types.ts';

export type TransactionRow = Database['public']['Tables']['transactions']['Row'];
export type TransactionStatusUpdate = Pick<TransactionRow, 'id' | 'status'>;

export interface CreateGcashCheckoutResult {
  checkoutUrl: string | null;
  error: string | null;
}

/**
 * Invokes the create-gcash-checkout Edge Function, which upserts a pending
 * `transactions` row and creates (or reuses) a PayMongo Checkout Session.
 * Never writes to `transactions` directly from the client — there is no
 * client-facing insert policy for GCash rows by design (docs/SCHEMA.MD §7.6).
 */
export async function createGcashCheckout(rideRequestId: string): Promise<CreateGcashCheckoutResult> {
  const { data, error } = await getSupabaseClient().functions.invoke('create-gcash-checkout', {
    body: { rideRequestId },
  });

  if (error) return { checkoutUrl: null, error: error.message };

  const result = data as { checkoutUrl: string | null; error: string | null };
  return { checkoutUrl: result.checkoutUrl ?? null, error: result.error };
}

/**
 * Realtime subscription on a single transaction row, same shape as
 * subscribeToRideRequestStatus in booking/index.ts: a postgres_changes
 * subscription only forwards future events, so a status flip landing before
 * the channel finishes joining would otherwise be missed — the post-
 * SUBSCRIBED reconcile query closes that gap.
 *
 * This is the only thing that ever advances the passenger's payment UI —
 * PayMongo's own checkout-page redirect is never trusted (FR-9.2).
 */
export function subscribeToTransactionStatus(
  rideRequestId: string,
  onChange: (row: TransactionStatusUpdate) => void,
  onError?: (message: string) => void,
): () => void {
  const client = getSupabaseClient();
  const channel = client
    .channel(`transaction_status_${rideRequestId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'transactions', filter: `ride_request_id=eq.${rideRequestId}` },
      (payload: { new: TransactionStatusUpdate }) => onChange(payload.new),
    )
    .subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        client
          .from('transactions')
          .select('id, status')
          .eq('ride_request_id', rideRequestId)
          .maybeSingle()
          .then(({ data }: { data: TransactionStatusUpdate | null }) => {
            if (data) onChange(data);
          });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onError?.('Lost connection while waiting for payment confirmation. Please check your connection.');
      }
    });

  return () => {
    client.removeChannel(channel);
  };
}

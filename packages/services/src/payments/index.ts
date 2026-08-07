import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types.ts';

export type TransactionRow = Database['public']['Tables']['transactions']['Row'];
export type TransactionStatusUpdate = Pick<TransactionRow, 'id' | 'status'>;

export interface CreateGcashCheckoutResult {
  checkoutUrl: string | null;
  error: string | null;
}

/**
 * The Supabase JS v2 client turns any non-2xx Edge Function response into a
 * generic FunctionsHttpError whose `.message` is just "Edge Function
 * returned a non-2xx status code" — it does not parse the response body.
 * create-gcash-checkout returns its actual user-facing message in the JSON
 * body (`{ checkoutUrl: null, error: "..." }`) on non-2xx responses, so we
 * have to reach into `error.context` (the raw Response) ourselves to get it.
 */
async function extractFunctionErrorMessage(error: { message: string; context?: unknown }): Promise<string> {
  const context = error.context as { json?: () => Promise<unknown> } | undefined;
  if (context && typeof context.json === 'function') {
    try {
      const body = await context.json();
      if (body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string') {
        return (body as { error: string }).error;
      }
    } catch {
      // fall through to the generic message below
    }
  }
  return error.message;
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

  if (error) return { checkoutUrl: null, error: await extractFunctionErrorMessage(error) };

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

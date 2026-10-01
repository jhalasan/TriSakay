import { getSupabaseClient } from '../supabase/client.ts';
import { uniqueChannelName } from '../supabase/channelName.ts';
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
export async function extractFunctionErrorMessage(error: { message: string; context?: unknown }): Promise<string> {
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

export interface ConfirmCashPaymentResult {
  error: string | null;
}

/**
 * Marks a cash ride's transaction 'paid', driver-confirmed. The pending row
 * itself is provisioned server-side by a trigger the moment the ride is
 * assigned (`trg_provision_cash_transaction`, docs/SCHEMA.MD §7.6) — this
 * only ever UPDATEs, matching the `txn_driver_confirm_cash` RLS policy,
 * which grants the assigned driver update-only access to their own cash row.
 * A missing row (the provisioning trigger didn't fire, or this isn't a cash
 * ride) is reported as a plain error rather than silently succeeding.
 */
export async function confirmCashPayment(rideRequestId: string, driverId: string): Promise<ConfirmCashPaymentResult> {
  const { data, error } = await getSupabaseClient()
    .from('transactions')
    .update({ status: 'paid', cash_confirmed_by: driverId, cash_confirmed_at: new Date().toISOString() })
    .eq('ride_request_id', rideRequestId)
    .eq('method', 'cash')
    .select('id')
    .maybeSingle();

  if (error) return { error: "Couldn't confirm cash payment. Please try again." };
  if (!data) return { error: 'No cash payment found for this ride yet. Please try again in a moment.' };
  return { error: null };
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
    .channel(uniqueChannelName(`transaction_status_${rideRequestId}`))
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

/** Why a driver switches a GCash ride to cash. Must match the list in the switch_payment_to_cash RPC. */
export const SWITCH_TO_CASH_REASON_CODES = ['no_signal', 'payment_failed', 'passenger_request', 'other'] as const;
export type SwitchToCashReasonCode = (typeof SWITCH_TO_CASH_REASON_CODES)[number];

export interface RequestGcashPaymentResult {
  requestedAt: string | null;
  error: string | null;
}

/**
 * The driver of an ongoing GCash ride asks the passenger to pay now. The
 * passenger's ride screen sees `payment_requested_at` and opens the payment
 * screen. Idempotent server-side: a second tap returns the first timestamp.
 */
export async function requestGcashPayment(rideRequestId: string): Promise<RequestGcashPaymentResult> {
  const { data, error } = await getSupabaseClient().rpc('request_gcash_payment', { p_ride_request_id: rideRequestId });
  if (error) return { requestedAt: null, error: error.message };
  return { requestedAt: (data as string | null) ?? null, error: null };
}

/**
 * The driver converts an ongoing GCash ride to cash when GCash cannot work.
 * Refused by the server if the ride is already paid. The reason is recorded on the transaction.
 */
export async function switchPaymentToCash(rideRequestId: string, reasonCode: SwitchToCashReasonCode): Promise<{ error: string | null }> {
  const { error } = await getSupabaseClient().rpc('switch_payment_to_cash', {
    p_ride_request_id: rideRequestId,
    p_reason_code: reasonCode,
  });
  return { error: error ? error.message : null };
}

export interface GetTransactionStatusResult {
  status: Database['public']['Enums']['payment_status'] | null;
  error: string | null;
}

/** One-off read of a ride's transaction status (null when no transaction exists yet). */
export async function getTransactionStatus(rideRequestId: string): Promise<GetTransactionStatusResult> {
  const { data, error } = await getSupabaseClient()
    .from('transactions')
    .select('status')
    .eq('ride_request_id', rideRequestId)
    .maybeSingle();
  if (error) return { status: null, error: error.message };
  return { status: data?.status ?? null, error: null };
}

export interface VerifyGcashPaymentResult {
  status: 'paid' | 'pending' | 'failed' | null;
  error: string | null;
}

/**
 * Asks the server to check the checkout session with PayMongo directly and
 * mark the transaction paid if it was. A second path next to the webhook, so
 * a slow or missed webhook cannot leave a paid ride looking unpaid. The
 * client never marks anything paid itself — only the server, from PayMongo's answer.
 */
export async function verifyGcashPayment(rideRequestId: string): Promise<VerifyGcashPaymentResult> {
  const { data, error } = await getSupabaseClient().functions.invoke('create-gcash-checkout', {
    body: { rideRequestId, action: 'verify' },
  });
  if (error) return { status: null, error: await extractFunctionErrorMessage(error) };
  const status = (data as { status?: string } | null)?.status;
  return { status: status === 'paid' || status === 'pending' || status === 'failed' ? status : null, error: null };
}

/** Rides completed before this moment are ignored by the unpaid-ride booking block. Keep equal to the cutoff in the pay2 migration. */
export const UNPAID_RIDE_CUTOFF_ISO = '2026-09-30T00:00:00+08:00';

export interface UnpaidCompletedRide {
  rideRequestId: string;
  fare: number | null;
  method: 'cash' | 'gcash';
}

export interface GetUnpaidCompletedRideResult {
  data: UnpaidCompletedRide | null;
  error: string | null;
}

/** The passenger's newest completed ride whose transaction is not paid (the one they must settle before booking again). */
export async function getUnpaidCompletedRide(passengerId: string): Promise<GetUnpaidCompletedRideResult> {
  const { data, error } = await getSupabaseClient()
    .from('ride_requests')
    .select('id, final_fare, estimated_fare, preferred_method, completed_at, transactions(status)')
    .eq('passenger_id', passengerId)
    .eq('status', 'completed')
    .gte('completed_at', UNPAID_RIDE_CUTOFF_ISO)
    .order('completed_at', { ascending: false })
    .limit(5);

  if (error) return { data: null, error: error.message };

  type Row = {
    id: string;
    final_fare: number | null;
    estimated_fare: number | null;
    preferred_method: 'cash' | 'gcash';
    transactions: { status: string } | { status: string }[] | null;
  };
  const unpaid = ((data ?? []) as unknown as Row[]).find((row) => {
    const tx = Array.isArray(row.transactions) ? row.transactions[0] : row.transactions;
    return tx?.status !== 'paid';
  });
  if (!unpaid) return { data: null, error: null };
  return { data: { rideRequestId: unpaid.id, fare: unpaid.final_fare ?? unpaid.estimated_fare, method: unpaid.preferred_method }, error: null };
}

/**
 * Fires `onChange` on any change to a transaction the caller may read. No
 * filter on purpose: transactions RLS already limits a driver to their own
 * rides' rows. This is what lets the driver's card flip to "paid" the moment
 * the webhook lands, since the webhook writes transactions, not ride_requests.
 */
export function subscribeToTripTransactions(onChange: () => void, onError?: (message: string) => void): () => void {
  const client = getSupabaseClient();
  const channel = client
    .channel(uniqueChannelName('trip_transactions'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => onChange())
    .subscribe((status: string) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onError?.('Lost connection while watching payments. Please check your connection.');
      }
    });

  return () => {
    client.removeChannel(channel);
  };
}

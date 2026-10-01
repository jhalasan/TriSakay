import { getSupabaseClient } from '../supabase/client.ts';
import { extractFunctionErrorMessage } from '../payments/index.ts';

export interface EmailReceiptResult {
  error: string | null;
}

/**
 * "Email me this receipt": asks the send-receipt Edge Function to email the signed-in passenger the receipt for one
 * of their completed rides. The recipient and the content come from the server, never from this call.
 */
export async function emailTripReceipt(rideRequestId: string): Promise<EmailReceiptResult> {
  const { error } = await getSupabaseClient().functions.invoke('send-receipt', { body: { rideRequestId } });
  if (error) return { error: await extractFunctionErrorMessage(error) };
  return { error: null };
}

export interface EmailReceiptsConsentResult {
  data: boolean;
  error: string | null;
}

/** Whether the signed-in passenger agreed to have receipts emailed automatically when a ride completes. Off until they turn it on. */
export async function getEmailReceiptsConsent(): Promise<EmailReceiptsConsentResult> {
  const client = getSupabaseClient();
  const { data: sessionData } = await client.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { data: false, error: 'Not signed in' };

  const { data, error } = await client.from('users').select('email_receipts').eq('id', userId).maybeSingle();
  if (error) return { data: false, error: error.message };
  return { data: data?.email_receipts ?? false, error: null };
}

export async function setEmailReceiptsConsent(enabled: boolean): Promise<EmailReceiptResult> {
  const client = getSupabaseClient();
  const { data: sessionData } = await client.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { error: 'Not signed in' };

  const { error } = await client.from('users').update({ email_receipts: enabled }).eq('id', userId);
  return { error: error?.message ?? null };
}

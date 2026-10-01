import { getSupabaseClient } from '../supabase/client.ts';
import { uniqueChannelName } from '../supabase/channelName.ts';
import type { Database } from '../supabase/database.types.ts';
import { extractFunctionErrorMessage } from '../payments/index.ts';

export type RideCallStatus = 'ringing' | 'answered' | 'declined' | 'cancelled' | 'missed' | 'ended';

export interface RideCall {
  id: string;
  rideRequestId: string;
  callerId: string;
  calleeId: string;
  status: RideCallStatus;
  /** True when this user placed the call. */
  isCaller: boolean;
  /** Seconds since the call was created, measured on the server when this row was fetched. */
  ageSeconds: number;
  /** Seconds since it was answered (server-measured), or null while it is not answered. */
  answeredAgeSeconds: number | null;
  /** The other person's first name and photo. Never a phone number or full name. */
  peerFirstName: string | null;
  peerAvatarUrl: string | null;
}

type CallRow = Database['public']['Functions']['get_ride_call']['Returns'][number];

function mapCall(row: CallRow): RideCall {
  return {
    id: row.id,
    rideRequestId: row.ride_request_id,
    callerId: row.caller_id,
    calleeId: row.callee_id,
    status: row.status as RideCallStatus,
    isCaller: row.is_caller,
    ageSeconds: row.age_seconds,
    answeredAgeSeconds: row.answered_age_seconds,
    peerFirstName: row.peer_first_name,
    peerAvatarUrl: row.peer_avatar_url,
  };
}

export interface CallWriteResult {
  error: string | null;
}

/** Places a call to the other person on this ride. The server derives who that is and checks the ride is active. */
export async function startRideCall(rideRequestId: string): Promise<{ data: string | null; error: string | null }> {
  const { data, error } = await getSupabaseClient().rpc('start_ride_call', { p_ride_request_id: rideRequestId });
  if (error) return { data: null, error: error.message };
  return { data: data ?? null, error: null };
}

export async function answerRideCall(callId: string): Promise<CallWriteResult> {
  const { error } = await getSupabaseClient().rpc('answer_ride_call', { p_call_id: callId });
  return { error: error?.message ?? null };
}

export async function declineRideCall(callId: string): Promise<CallWriteResult> {
  const { error } = await getSupabaseClient().rpc('decline_ride_call', { p_call_id: callId });
  return { error: error?.message ?? null };
}

/** Hang up. For a ringing call only the caller can use this (it cancels); the callee declines instead. */
export async function endRideCall(callId: string): Promise<CallWriteResult> {
  const { error } = await getSupabaseClient().rpc('end_ride_call', { p_call_id: callId });
  return { error: error?.message ?? null };
}

export async function getRideCall(callId: string): Promise<{ data: RideCall | null; error: string | null }> {
  const { data, error } = await getSupabaseClient().rpc('get_ride_call', { p_call_id: callId });
  if (error) return { data: null, error: error.message };
  const row = (data ?? [])[0];
  return { data: row ? mapCall(row) : null, error: null };
}

/** Calls this user is part of that are still ringing or connected. */
export async function listMyActiveCalls(): Promise<{ data: RideCall[]; error: string | null }> {
  const { data, error } = await getSupabaseClient().rpc('list_my_active_calls');
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []).map(mapCall), error: null };
}

export interface CallToken {
  appId: string;
  channel: string;
  uid: number;
  token: string;
}

/** Short-lived Agora credentials for one call. The server re-checks the call and the ride before issuing them. */
export async function getCallToken(callId: string): Promise<{ data: CallToken | null; error: string | null }> {
  const { data, error } = await getSupabaseClient().functions.invoke('call-token', { body: { callId } });
  if (error) return { data: null, error: await extractFunctionErrorMessage(error) };

  const result = data as (Partial<CallToken> & { error?: string }) | null;
  if (!result?.token || !result.appId || !result.channel || typeof result.uid !== 'number') {
    return { data: null, error: result?.error ?? 'Could not get a call token' };
  }
  return { data: { appId: result.appId, channel: result.channel, uid: result.uid, token: result.token }, error: null };
}

/** Safety net under realtime: a missed event during a reconnect matters for something that rings for 30 seconds. */
const POLL_MS = 5000;

/**
 * Live feed of this user's active calls (ringing or connected), for the "someone is calling you" listener.
 * Refetches on SUBSCRIBED and on any change to a call where the user is caller or callee, same shape as
 * subscribeToTransferInvites.
 */
export function subscribeToMyCalls(
  userId: string,
  onData: (rows: RideCall[]) => void,
  onError?: (message: string) => void,
): () => void {
  const client = getSupabaseClient();
  let cancelled = false;

  async function refetch() {
    const { data, error } = await listMyActiveCalls();
    if (cancelled) return;
    if (error) {
      onError?.(error);
      return;
    }
    onData(data);
  }

  const channel = client
    .channel(uniqueChannelName(`my_calls_${userId}`))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ride_calls', filter: `callee_id=eq.${userId}` }, () => void refetch())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ride_calls', filter: `caller_id=eq.${userId}` }, () => void refetch())
    .subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        void refetch();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        if (!cancelled) onError?.('Lost connection while listening for calls. Please check your connection.');
      }
    });

  const poll = setInterval(() => void refetch(), POLL_MS);

  return () => {
    cancelled = true;
    clearInterval(poll);
    client.removeChannel(channel);
  };
}

/** Follows one call (any status, including after it ends) so the call screen can show every state. */
export function subscribeToCall(
  callId: string,
  onData: (call: RideCall | null) => void,
  onError?: (message: string) => void,
): () => void {
  const client = getSupabaseClient();
  let cancelled = false;

  async function refetch() {
    const { data, error } = await getRideCall(callId);
    if (cancelled) return;
    if (error) {
      onError?.(error);
      return;
    }
    onData(data);
  }

  const channel = client
    .channel(uniqueChannelName(`ride_call_${callId}`))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ride_calls', filter: `id=eq.${callId}` }, () => void refetch())
    .subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        void refetch();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        if (!cancelled) onError?.('Lost connection during the call. Please check your connection.');
      }
    });

  const poll = setInterval(() => void refetch(), POLL_MS);

  return () => {
    cancelled = true;
    clearInterval(poll);
    client.removeChannel(channel);
  };
}

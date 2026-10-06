import { getSupabaseClient } from '../supabase/client.ts';
import { uniqueChannelName } from '../supabase/channelName.ts';
import type { Database } from '../supabase/database.types.ts';

export type RideTransferRow = Database['public']['Tables']['ride_transfers']['Row'];

export interface TransferInvite {
  inviteId: string;
  toDriverId: string;
  expiresAt: string;
}

export interface InviteTransferResult {
  data: TransferInvite[] | null;
  error: string | null;
}

/**
 * D1 (UAT audit): the FROM driver's "Transfer" action. handoffLat/Lng are
 * only meaningful for an after-pickup transfer (the RPC ignores them for a
 * before-pickup one, using the ride's own pickup point instead) — omit them
 * for a before-pickup transfer, or to let the RPC fall back to the driver's
 * own last-known position for an after-pickup one.
 */
export async function inviteTransfer(
  rideRequestId: string,
  reason: string,
  toDriverIds: string[],
  handoff?: { lat: number; lng: number },
): Promise<InviteTransferResult> {
  const { data, error } = await getSupabaseClient().rpc('invite_transfer', {
    p_ride_request_id: rideRequestId,
    p_reason: reason,
    p_to_driver_ids: toDriverIds,
    p_handoff_lat: handoff?.lat,
    p_handoff_lng: handoff?.lng,
  });

  if (error) return { data: null, error: error.message };

  return {
    data: (data ?? []).map((row) => ({ inviteId: row.invite_id, toDriverId: row.to_driver_id, expiresAt: row.expires_at })),
    error: null,
  };
}

export interface RespondTransferResult {
  error: string | null;
  accepted: boolean;
  tripId: string | null;
}

/** D1: the invited (TO) driver's accept/decline of one invite. */
export async function respondTransfer(inviteId: string, accept: boolean): Promise<RespondTransferResult> {
  const { data, error } = await getSupabaseClient().rpc('respond_transfer', { p_invite_id: inviteId, p_accept: accept });

  if (error) return { error: error.message, accepted: false, tripId: null };

  const row = Array.isArray(data) ? data[0] : null;
  return { error: null, accepted: row?.accepted ?? false, tripId: row?.trip_id ?? null };
}

export interface TransferInviteDetails {
  pickupPlace: string | null;
  destinationPlace: string | null;
  seats: number;
  rideKm: number | null;
  /** The fare the passenger was quoted. It stays the same after the transfer. */
  fare: number | null;
  /** True when the passenger is already on board, so the meeting point is where the first driver is. */
  handoffAfterPickup: boolean;
  /** Straight line distance from the invited driver to the meeting point, null when their location is unknown. */
  handoffKm: number | null;
}

export interface GetTransferInviteDetailsResult {
  /** Null when the invite is gone or has expired. */
  data: TransferInviteDetails | null;
  error: string | null;
}

/** The invited (TO) driver's view of what they are being asked to take, read before they accept. */
export async function getTransferInviteDetails(inviteId: string): Promise<GetTransferInviteDetailsResult> {
  const { data, error } = await getSupabaseClient().rpc('get_transfer_invite_details', { p_invite_id: inviteId });

  if (error) return { data: null, error: error.message };

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return { data: null, error: null };

  return {
    data: {
      pickupPlace: row.pickup_place,
      destinationPlace: row.destination_place,
      seats: row.seats,
      rideKm: row.ride_km,
      fare: row.fare,
      handoffAfterPickup: row.handoff_after_pickup,
      handoffKm: row.handoff_km,
    },
    error: null,
  };
}

export interface ReleaseToPoolResult {
  error: string | null;
}

/** D1 (L5): the FROM driver's fallback when no invited driver accepts. Always a strike — see the migration's own header. */
export async function releaseToPool(rideRequestId: string, reason: string): Promise<ReleaseToPoolResult> {
  const { error } = await getSupabaseClient().rpc('release_to_pool', { p_ride_request_id: rideRequestId, p_reason: reason });

  return { error: error?.message ?? null };
}

export interface CompleteHandoffResult {
  error: string | null;
}

/** D1 (L6): the TO driver confirms they've physically taken the passenger — clears the FROM driver's stranding guard immediately instead of waiting out the 5-minute timeout. */
export async function completeHandoff(rideRequestId: string): Promise<CompleteHandoffResult> {
  const { error } = await getSupabaseClient().rpc('complete_handoff', { p_ride_request_id: rideRequestId });

  return { error: error?.message ?? null };
}

export interface TransferCandidate {
  driverId: string;
  driverName: string | null;
  avatarUrl: string | null;
  plateNo: string | null;
  distanceKm: number;
  freeSeats: number;
}

export interface ListTransferCandidatesResult {
  data: TransferCandidate[];
  error: string | null;
}

/** D1: nearby online, adequately-seated drivers for the FROM driver's invite picker, sorted by distance. */
export async function listTransferCandidates(rideRequestId: string): Promise<ListTransferCandidatesResult> {
  const { data, error } = await getSupabaseClient().rpc('list_transfer_candidates', { p_ride_request_id: rideRequestId });

  if (error) return { data: [], error: error.message };

  return {
    data: (data ?? []).map((row) => ({
      driverId: row.driver_id,
      driverName: row.driver_name,
      avatarUrl: row.avatar_url,
      plateNo: row.plate_no,
      distanceKm: row.distance_km,
      freeSeats: row.free_seats,
    })),
    error: null,
  };
}

/**
 * D1: live incoming-invite feed for a driver — refetches (rather than
 * patching from the payload) on any change to ride_transfers rows where this
 * driver is the invitee, same reconcile-on-SUBSCRIBED shape as
 * subscribeToPendingRideRequests. An invite is short-lived (30s), so a
 * missed realtime event during a reconnect matters more than usual here.
 */
export function subscribeToTransferInvites(
  driverId: string,
  onData: (rows: RideTransferRow[]) => void,
  onError?: (message: string) => void,
): () => void {
  const client = getSupabaseClient();
  let cancelled = false;

  async function refetch() {
    const { data, error } = await client
      .from('ride_transfers')
      .select('*')
      .eq('to_driver_id', driverId)
      .eq('status', 'invited')
      .order('created_at', { ascending: false });

    if (cancelled) return;
    if (error) {
      onError?.(error.message);
      return;
    }
    onData(data ?? []);
  }

  const channel = client
    .channel(uniqueChannelName(`transfer_invites_${driverId}`))
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'ride_transfers', filter: `to_driver_id=eq.${driverId}` },
      () => {
        void refetch();
      },
    )
    .subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        void refetch();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        if (!cancelled) onError?.('Lost connection while listening for transfer invites. Please check your connection.');
      }
    });

  return () => {
    cancelled = true;
    client.removeChannel(channel);
  };
}

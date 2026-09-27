import { create } from 'zustand';
import { respondTransfer, subscribeToTransferInvites, type RideTransferRow } from '@trisakay/services';

interface TransferInvitesState {
  invites: RideTransferRow[];
  error: string | null;
  subscribe: (driverId: string) => void;
  unsubscribe: () => void;
  /** Resolves to the new tripId on acceptance, or null on decline/failure. */
  respond: (inviteId: string, accept: boolean) => Promise<string | null>;
}

let stopRealtime: (() => void) | null = null;

/**
 * D1 (UAT audit): live incoming transfer-invite feed for a driver, same
 * lifecycle shape as useRequestsStore — a driver only ever appears as an
 * invite target while `is_available` (invite_transfer itself enforces this
 * server-side), so this is wired to the same isAvailable-gated sync as
 * pending requests in _layout.tsx.
 */
export const useTransferInvitesStore = create<TransferInvitesState>()((set, get) => ({
  invites: [],
  error: null,

  subscribe: (driverId) => {
    stopRealtime?.();
    stopRealtime = subscribeToTransferInvites(
      driverId,
      (rows) => set({ invites: rows, error: null }),
      (message) => set({ error: message }),
    );
  },

  unsubscribe: () => {
    stopRealtime?.();
    stopRealtime = null;
    set({ invites: [], error: null });
  },

  respond: async (inviteId, accept) => {
    const invite = get().invites.find((i) => i.id === inviteId);
    if (!invite) return null;

    // Optimistic — a 30s-lived invite shouldn't sit in the list while the
    // round trip completes, and the realtime subscription will reconcile
    // this away from the server side regardless.
    set((state) => ({ invites: state.invites.filter((i) => i.id !== inviteId) }));

    const { error, accepted, tripId } = await respondTransfer(inviteId, accept);
    if (error) {
      set({ error });
      return null;
    }

    return accepted ? tripId : null;
  },
}));

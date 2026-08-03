import { create } from 'zustand';
import { acceptRideRequest, subscribeToPendingRideRequests } from '@trisakay/services/src/booking/index.ts';
import type { RideRequestRow } from '@trisakay/services/src/booking/index.ts';
import type { PendingRequest } from '../types/request.ts';

interface RequestsState {
  pending: PendingRequest[];
  error: string | null;
  subscribe: () => void;
  unsubscribe: () => void;
  accept: (id: string, driverId: string) => Promise<PendingRequest | undefined>;
  decline: (id: string) => void;
}

function toPendingRequest(row: RideRequestRow): PendingRequest {
  return {
    id: row.id,
    seats: row.seats_requested,
    paymentMethod: row.preferred_method,
    pickupLabel: row.pickup_label,
    dropoffLabel: row.dest_label,
    fare: row.estimated_fare,
    createdAt: row.requested_at,
  };
}

let stopRealtime: (() => void) | null = null;
let dismissedIds = new Set<string>();

export const useRequestsStore = create<RequestsState>()((set, get) => ({
  pending: [],
  error: null,

  subscribe: () => {
    stopRealtime?.();
    dismissedIds = new Set();

    stopRealtime = subscribeToPendingRideRequests(
      (rows) => {
        set({ pending: rows.filter((row) => !dismissedIds.has(row.id)).map(toPendingRequest) });
      },
      (message) => set({ error: message }),
    );
  },

  unsubscribe: () => {
    stopRealtime?.();
    stopRealtime = null;
    dismissedIds = new Set();
    set({ pending: [], error: null });
  },

  accept: async (id, driverId) => {
    const request = get().pending.find((item) => item.id === id);
    if (!request) return undefined;

    const { error } = await acceptRideRequest(driverId, id);
    if (error) {
      set({ error });
      return undefined;
    }

    set((state) => ({ pending: state.pending.filter((item) => item.id !== id), error: null }));
    return request;
  },

  decline: (id) => {
    dismissedIds.add(id);
    set((state) => ({ pending: state.pending.filter((item) => item.id !== id) }));
  },
}));

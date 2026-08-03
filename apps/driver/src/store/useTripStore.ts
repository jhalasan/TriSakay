import { create } from 'zustand';
import { completeTrip, cancelTrip } from '@trisakay/services/src/booking/index.ts';
import type { PendingRequest } from '../types/request.ts';
import type { ActiveTrip } from '../types/trip.ts';

interface TripState {
  current: ActiveTrip | null;
  error: string | null;
  startTrip: (request: PendingRequest, tripId: string) => void;
  confirmCash: () => void;
  complete: () => Promise<ActiveTrip | null>;
  cancel: (reason: string) => Promise<ActiveTrip | null>;
}

export const useTripStore = create<TripState>()((set, get) => ({
  current: null,
  error: null,

  startTrip: (request, tripId) =>
    set({
      current: {
        id: request.id,
        tripId,
        passengerName: null,
        seats: request.seats,
        paymentMethod: request.paymentMethod,
        fare: request.fare,
        cashConfirmed: false,
        startedAt: new Date().toISOString(),
      },
      error: null,
    }),

  confirmCash: () =>
    set((state) => (state.current ? { current: { ...state.current, cashConfirmed: true } } : state)),

  complete: async () => {
    const trip = get().current;
    if (!trip) return null;

    const { error } = await completeTrip(trip.tripId, trip.id);
    if (error) {
      set({ error });
      return null;
    }

    set({ current: null, error: null });
    return trip;
  },

  cancel: async (reason) => {
    const trip = get().current;
    if (!trip) return null;

    const { error } = await cancelTrip(trip.tripId, trip.id, reason);
    if (error) {
      set({ error });
      return null;
    }

    set({ current: null, error: null });
    return trip;
  },
}));

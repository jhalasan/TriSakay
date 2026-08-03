import { create } from 'zustand';
import type { PendingRequest } from '../types/request';
import type { ActiveTrip } from '../types/trip';

interface TripState {
  current: ActiveTrip | null;
  startTrip: (request: PendingRequest) => void;
  confirmCash: () => void;
  complete: () => ActiveTrip | null;
  cancel: () => ActiveTrip | null;
}

export const useTripStore = create<TripState>()((set, get) => ({
  current: null,

  startTrip: (request) =>
    set({
      current: {
        id: request.id,
        passengerName: null,
        seats: request.seats,
        paymentMethod: request.paymentMethod,
        fare: request.fare,
        cashConfirmed: false,
        startedAt: new Date().toISOString(),
      },
    }),

  confirmCash: () =>
    set((state) => (state.current ? { current: { ...state.current, cashConfirmed: true } } : state)),

  complete: () => {
    const trip = get().current;
    set({ current: null });
    return trip;
  },

  cancel: () => {
    const trip = get().current;
    set({ current: null });
    return trip;
  },
}));

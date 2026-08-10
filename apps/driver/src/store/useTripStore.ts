import { create } from 'zustand';
import { completeTrip, cancelTrip } from '@trisakay/services/src/booking/index.ts';
import { confirmCashPayment } from '@trisakay/services/src/payments/index.ts';
import type { PendingRequest } from '../types/request.ts';
import type { ActiveTrip } from '../types/trip.ts';

interface TripState {
  current: ActiveTrip | null;
  error: string | null;
  startTrip: (request: PendingRequest, tripId: string) => void;
  /** Populated by a follow-up fetch after startTrip — see getTripPassengerInfo in dashboard.tsx's handleAccept. */
  setPassengerInfo: (name: string | null, avatarUrl: string | null) => void;
  confirmCash: (driverId: string) => Promise<boolean>;
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
        passengerAvatarUrl: null,
        seats: request.seats,
        paymentMethod: request.paymentMethod,
        fare: request.fare,
        cashConfirmed: false,
        startedAt: new Date().toISOString(),
      },
      error: null,
    }),

  setPassengerInfo: (name, avatarUrl) =>
    set((state) =>
      state.current ? { current: { ...state.current, passengerName: name, passengerAvatarUrl: avatarUrl } } : state
    ),

  confirmCash: async (driverId) => {
    const trip = get().current;
    if (!trip || trip.cashConfirmed) return false;

    const { error } = await confirmCashPayment(trip.id, driverId);
    if (error) {
      set({ error });
      return false;
    }

    set((state) =>
      state.current ? { current: { ...state.current, cashConfirmed: true }, error: null } : state
    );
    return true;
  },

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

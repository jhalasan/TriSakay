import { create } from 'zustand';
import { completeTrip, cancelTrip, getActiveTripForDriver } from '@trisakay/services/src/booking/index.ts';
import { confirmCashPayment } from '@trisakay/services/src/payments/index.ts';
import { REQUEST_TIMEOUT_MS, withTimeout } from '../utils/withTimeout.ts';
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
  /**
   * Rehydrates `current` from the backend on app boot — without this, an app
   * restart mid-trip (OS kill, force-quit) leaves `current` null forever,
   * even though the backend still has the trip `active`: the driver could
   * never reach Complete/Cancel from the UI again. No-ops (leaves `current`
   * untouched) on failure/timeout, same reasoning as useDriverStore's
   * checkAvailability/checkRating.
   */
  hydrate: () => Promise<void>;
  /** Clears trip state on logout/session change — without this, a new driver signing in on the same device could inherit the previous driver's in-progress trip. */
  reset: () => void;
}

export const useTripStore = create<TripState>()((set, get) => {
  let hydrateEpoch = 0;

  return {
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

    hydrate: async () => {
      const epoch = ++hydrateEpoch;
      try {
        const { data, error } = await withTimeout(
          getActiveTripForDriver(),
          REQUEST_TIMEOUT_MS,
          'Active trip check timed out'
        );
        if (epoch !== hydrateEpoch || error || !data) return;
        set({
          current: {
            id: data.rideRequestId,
            tripId: data.tripId,
            passengerName: data.passengerName,
            passengerAvatarUrl: data.passengerAvatarUrl,
            seats: data.seats,
            paymentMethod: data.paymentMethod,
            fare: data.fare,
            cashConfirmed: data.cashConfirmed,
            startedAt: data.startedAt,
          },
          error: null,
        });
      } catch {
        // Leave `current` untouched on failure/timeout — same reasoning as
        // useDriverStore's checkAvailability/checkRating.
      }
    },

    reset: () => {
      hydrateEpoch += 1; // discard any in-flight hydrate() from the previous session
      set({ current: null, error: null });
    },
  };
});

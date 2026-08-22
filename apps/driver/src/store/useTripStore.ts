import { create } from 'zustand';
import {
  cancelRideLeg,
  completeRideLeg,
  endTrip as endTripRpc,
  getActiveTripForDriver,
} from '@trisakay/services/src/booking/index.ts';
import { confirmCashPayment } from '@trisakay/services/src/payments/index.ts';
import { REQUEST_TIMEOUT_MS, withTimeout } from '../utils/withTimeout.ts';
import type { PendingRequest } from '../types/request.ts';
import type { ActivePassenger, ActiveTrip } from '../types/trip.ts';

function passengerFromRequest(request: PendingRequest): ActivePassenger {
  return {
    id: request.id,
    passengerId: null,
    passengerName: null,
    passengerAvatarUrl: null,
    seats: request.seats,
    paymentMethod: request.paymentMethod,
    fare: request.fare,
    cashConfirmed: false,
  };
}

interface TripState {
  current: ActiveTrip | null;
  error: string | null;
  /** Starts a new trip session from the first accepted request. */
  startTrip: (request: PendingRequest, tripId: string) => void;
  /**
   * FR-2.5c mid-trip pickup — appends a newly-accepted request onto the
   * CURRENT trip session. acceptRideRequest() already attaches it to the
   * existing trip server-side; this just mirrors that client-side. No-op if
   * there's no active trip — use startTrip() for the first passenger.
   */
  addPassenger: (request: PendingRequest) => void;
  /** Populated by a follow-up fetch after startTrip/addPassenger — see getTripPassengerInfo in useAcceptRideRequest.ts. Matched by rideRequestId since multiple passengers can be in flight at once. */
  setPassengerInfo: (rideRequestId: string, passengerId: string | null, name: string | null, avatarUrl: string | null) => void;
  confirmCash: (rideRequestId: string, driverId: string) => Promise<boolean>;
  /** FR-2.5c — completes ONE passenger's leg; the trip and any other passenger aboard stay untouched. */
  completePassenger: (rideRequestId: string) => Promise<ActivePassenger | null>;
  /** FR-2.5c — cancels ONE passenger's leg; the trip and any other passenger aboard stay untouched. */
  cancelPassenger: (rideRequestId: string, reason: string) => Promise<ActivePassenger | null>;
  /**
   * The driver's explicit "done for now" action. Only succeeds once the
   * passenger list is empty — mirrored client-side so the button can be
   * disabled correctly, but the DB itself is the real enforcement (end_trip
   * RPC refuses regardless of what the client thinks the list looks like).
   */
  endTrip: () => Promise<boolean>;
  /**
   * Rehydrates `current` from the backend on app boot — without this, an app
   * restart mid-trip (OS kill, force-quit) leaves `current` null forever,
   * even though the backend still has the trip `active`. No-ops (leaves
   * `current` untouched) on failure/timeout, same reasoning as
   * useDriverStore's checkAvailability/checkRating.
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
          tripId,
          startedAt: new Date().toISOString(),
          passengers: [passengerFromRequest(request)],
        },
        error: null,
      }),

    addPassenger: (request) =>
      set((state) =>
        state.current
          ? { current: { ...state.current, passengers: [...state.current.passengers, passengerFromRequest(request)] } }
          : state
      ),

    setPassengerInfo: (rideRequestId, passengerId, name, avatarUrl) =>
      set((state) =>
        state.current
          ? {
              current: {
                ...state.current,
                passengers: state.current.passengers.map((p) =>
                  p.id === rideRequestId ? { ...p, passengerId, passengerName: name, passengerAvatarUrl: avatarUrl } : p
                ),
              },
            }
          : state
      ),

    confirmCash: async (rideRequestId, driverId) => {
      const passenger = get().current?.passengers.find((p) => p.id === rideRequestId);
      if (!passenger || passenger.cashConfirmed) return false;

      const { error } = await confirmCashPayment(rideRequestId, driverId);
      if (error) {
        set({ error });
        return false;
      }

      set((state) =>
        state.current
          ? {
              current: {
                ...state.current,
                passengers: state.current.passengers.map((p) => (p.id === rideRequestId ? { ...p, cashConfirmed: true } : p)),
              },
              error: null,
            }
          : state
      );
      return true;
    },

    completePassenger: async (rideRequestId) => {
      const trip = get().current;
      const passenger = trip?.passengers.find((p) => p.id === rideRequestId);
      if (!trip || !passenger) return null;

      const { error } = await completeRideLeg(trip.tripId, rideRequestId);
      if (error) {
        set({ error });
        return null;
      }

      set((state) =>
        state.current
          ? { current: { ...state.current, passengers: state.current.passengers.filter((p) => p.id !== rideRequestId) }, error: null }
          : state
      );
      return passenger;
    },

    cancelPassenger: async (rideRequestId, reason) => {
      const trip = get().current;
      const passenger = trip?.passengers.find((p) => p.id === rideRequestId);
      if (!trip || !passenger) return null;

      const { error } = await cancelRideLeg(trip.tripId, rideRequestId, reason);
      if (error) {
        set({ error });
        return null;
      }

      set((state) =>
        state.current
          ? { current: { ...state.current, passengers: state.current.passengers.filter((p) => p.id !== rideRequestId) }, error: null }
          : state
      );
      return passenger;
    },

    endTrip: async () => {
      const trip = get().current;
      if (!trip) return false;
      if (trip.passengers.length > 0) {
        set({ error: 'Complete or cancel every passenger before ending the trip.' });
        return false;
      }

      const { error } = await endTripRpc(trip.tripId);
      if (error) {
        set({ error });
        return false;
      }

      set({ current: null, error: null });
      return true;
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
            tripId: data.tripId,
            startedAt: data.startedAt,
            passengers: data.passengers.map((p) => ({
              id: p.rideRequestId,
              passengerId: p.passengerId,
              passengerName: p.passengerName,
              passengerAvatarUrl: p.passengerAvatarUrl,
              seats: p.seats,
              paymentMethod: p.paymentMethod,
              fare: p.fare,
              cashConfirmed: p.cashConfirmed,
            })),
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

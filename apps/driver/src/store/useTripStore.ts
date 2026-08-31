import { create } from 'zustand';
import {
  cancelRideLeg,
  completeRideLeg,
  startRideLeg,
  endTrip as endTripRpc,
  getActiveTripForDriver,
} from '@trisakay/services/src/booking/index.ts';
import { confirmCashPayment } from '@trisakay/services/src/payments/index.ts';
import { getTranslations } from '../utils/getTranslations.ts';
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
    status: 'assigned',
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
  /** Marks one passenger's leg picked up (assigned -> ongoing); Complete is unreachable before this succeeds. */
  startPassenger: (rideRequestId: string) => Promise<boolean>;
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
      const fallbackMessage = getTranslations().driver.errors.cashConfirmFailed;

      try {
        const { error } = await withTimeout(confirmCashPayment(rideRequestId, driverId), REQUEST_TIMEOUT_MS, fallbackMessage);
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
      } catch {
        set({ error: fallbackMessage });
        return false;
      }
    },

    startPassenger: async (rideRequestId) => {
      const trip = get().current;
      const passenger = trip?.passengers.find((p) => p.id === rideRequestId);
      if (!trip || !passenger || passenger.status !== 'assigned') return false;
      const fallbackMessage = getTranslations().driver.errors.startPassengerFailed;

      try {
        const { error } = await withTimeout(startRideLeg(trip.tripId, rideRequestId), REQUEST_TIMEOUT_MS, fallbackMessage);
        if (error) {
          set({ error });
          return false;
        }

        set((state) =>
          state.current
            ? {
                current: {
                  ...state.current,
                  passengers: state.current.passengers.map((p) => (p.id === rideRequestId ? { ...p, status: 'ongoing' } : p)),
                },
                error: null,
              }
            : state
        );
        return true;
      } catch {
        set({ error: fallbackMessage });
        return false;
      }
    },

    completePassenger: async (rideRequestId) => {
      const trip = get().current;
      const passenger = trip?.passengers.find((p) => p.id === rideRequestId);
      if (!trip || !passenger) return null;
      const fallbackMessage = getTranslations().driver.errors.completePassengerFailed;

      try {
        const { error } = await withTimeout(completeRideLeg(trip.tripId, rideRequestId), REQUEST_TIMEOUT_MS, fallbackMessage);
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
      } catch {
        set({ error: fallbackMessage });
        return null;
      }
    },

    cancelPassenger: async (rideRequestId, reason) => {
      const trip = get().current;
      const passenger = trip?.passengers.find((p) => p.id === rideRequestId);
      if (!trip || !passenger) return null;
      const fallbackMessage = getTranslations().driver.errors.cancelPassengerFailed;

      try {
        const { error } = await withTimeout(cancelRideLeg(trip.tripId, rideRequestId, reason), REQUEST_TIMEOUT_MS, fallbackMessage);
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
      } catch {
        set({ error: fallbackMessage });
        return null;
      }
    },

    endTrip: async () => {
      const trip = get().current;
      if (!trip) return false;
      if (trip.passengers.length > 0) {
        set({ error: getTranslations().driver.errors.endTripBlocked });
        return false;
      }
      const fallbackMessage = getTranslations().driver.errors.endTripFailed;

      try {
        const { error } = await withTimeout(endTripRpc(trip.tripId), REQUEST_TIMEOUT_MS, fallbackMessage);
        if (error) {
          set({ error });
          return false;
        }

        set({ current: null, error: null });
        return true;
      } catch {
        set({ error: fallbackMessage });
        return false;
      }
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
              // get_active_trip_passengers' own WHERE clause only ever returns
              // rows with status in ('assigned', 'ongoing') — see migration
              // 20260830120000's get_active_trip_passengers (D), so this is a
              // safe narrowing even though ActiveTripPassenger['status'] is
              // typed as the full ride_status enum.
              status: p.status as 'assigned' | 'ongoing',
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

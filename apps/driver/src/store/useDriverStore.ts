import { create } from 'zustand';
import { getDriverAvailability, updateDriverAvailability } from '@trisakay/services';
import { REQUEST_TIMEOUT_MS, withTimeout } from '../utils/withTimeout.ts';

interface DriverState {
  isAvailable: boolean;
  todayEarnings: number;
  todayTrips: number;
  rating: number | null;
  ratingCount: number;
  acceptRate: number | null;
  error: string | null;
  /**
   * Resolves true only once the write actually succeeded. Callers going
   * online must resolve `coords` themselves first (expo-location has no
   * place in a store — see useLocationPermission for why platform calls
   * stay in screens/hooks, not stores, in this app).
   */
  setAvailable: (value: boolean, coords?: { lat: number; lng: number }) => Promise<boolean>;
  /**
   * Re-syncs `isAvailable` from `driver_profiles.is_available` — unlike
   * setAvailable, never writes. Called on app boot/login so a restart
   * while online doesn't leave the UI silently showing "Offline" while
   * the backend still considers the driver available and matchable.
   */
  checkAvailability: () => Promise<void>;
  recordCompletedTrip: (fare: number) => void;
  clearError: () => void;
}

export const useDriverStore = create<DriverState>()((set) => {
  let checkEpoch = 0;

  return {
    isAvailable: false,
    todayEarnings: 0,
    todayTrips: 0,
    rating: null,
    ratingCount: 0,
    acceptRate: null,
    error: null,

    setAvailable: async (value, coords) => {
      set({ error: null });

      const { error } = await updateDriverAvailability(value, coords);
      if (error) {
        set({ error });
        return false;
      }

      set({ isAvailable: value });
      return true;
    },

    checkAvailability: async () => {
      const epoch = ++checkEpoch;
      try {
        const { isAvailable, error } = await withTimeout(
          getDriverAvailability(),
          REQUEST_TIMEOUT_MS,
          'Availability check timed out'
        );
        if (epoch !== checkEpoch || error) return;
        set({ isAvailable });
      } catch {
        // Leave isAvailable untouched on failure/timeout — defaulting to
        // false here would wrongly flip an online driver's UI offline on
        // a transient network blip instead of just leaving it stale until
        // the next check.
      }
    },

    recordCompletedTrip: (fare) =>
      set((state) => ({
        todayEarnings: state.todayEarnings + fare,
        todayTrips: state.todayTrips + 1,
      })),

    clearError: () => set({ error: null }),
  };
});

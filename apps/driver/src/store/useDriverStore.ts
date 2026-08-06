import { create } from 'zustand';
import { updateDriverAvailability } from '@trisakay/services';

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
  recordCompletedTrip: (fare: number) => void;
  clearError: () => void;
}

export const useDriverStore = create<DriverState>()((set) => ({
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

  recordCompletedTrip: (fare) =>
    set((state) => ({
      todayEarnings: state.todayEarnings + fare,
      todayTrips: state.todayTrips + 1,
    })),

  clearError: () => set({ error: null }),
}));

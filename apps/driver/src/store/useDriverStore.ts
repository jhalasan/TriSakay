import { create } from 'zustand';

interface DriverState {
  isAvailable: boolean;
  todayEarnings: number;
  todayTrips: number;
  rating: number | null;
  ratingCount: number;
  acceptRate: number | null;
  setAvailable: (value: boolean) => void;
  recordCompletedTrip: (fare: number) => void;
}

export const useDriverStore = create<DriverState>()((set) => ({
  isAvailable: false,
  todayEarnings: 0,
  todayTrips: 0,
  rating: null,
  ratingCount: 0,
  acceptRate: null,

  setAvailable: (value) => set({ isAvailable: value }),

  recordCompletedTrip: (fare) =>
    set((state) => ({
      todayEarnings: state.todayEarnings + fare,
      todayTrips: state.todayTrips + 1,
    })),
}));

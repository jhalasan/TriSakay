import { create } from 'zustand';
import { seedRideHistory } from '../mocks/rideHistory';
import type { RideHistoryItem } from '../types/ride';

interface HistoryState {
  rides: RideHistoryItem[];
  addRide: (ride: RideHistoryItem) => void;
}

export const useHistoryStore = create<HistoryState>()((set) => ({
  rides: seedRideHistory,
  addRide: (ride) => set((state) => ({ rides: [ride, ...state.rides] })),
}));

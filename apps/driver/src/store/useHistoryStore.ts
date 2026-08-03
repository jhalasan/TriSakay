import { create } from 'zustand';
import type { TripHistoryItem } from '../types/history.ts';

interface HistoryState {
  trips: TripHistoryItem[];
  addTrip: (trip: TripHistoryItem) => void;
}

export const useHistoryStore = create<HistoryState>()((set) => ({
  trips: [],
  addTrip: (trip) => set((state) => ({ trips: [trip, ...state.trips] })),
}));

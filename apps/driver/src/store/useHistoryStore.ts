import { create } from 'zustand';
import { listDriverTripHistory } from '@trisakay/services';
import type { TripHistoryItem } from '../types/history';

interface HistoryState {
  trips: TripHistoryItem[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  reset: () => void;
}

export const useHistoryStore = create<HistoryState>()((set) => ({
  trips: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });

    const { data, error } = await listDriverTripHistory();
    if (error) {
      set({ loading: false, error });
      return;
    }

    set({
      loading: false,
      trips: data.map((item) => ({
        id: item.rideRequestId,
        passengerName: item.passengerName,
        date: item.date,
        fare: item.fare,
        status: item.status === 'completed' ? 'done' : 'cancelled',
      })),
    });
  },

  reset: () => set({ trips: [], loading: false, error: null }),
}));

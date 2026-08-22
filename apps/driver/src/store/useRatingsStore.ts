import { create } from 'zustand';
import { listMyRatingsAsDriver } from '@trisakay/services';
import type { DriverRatingItem } from '../types/ratings';

interface RatingsState {
  ratings: DriverRatingItem[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  reset: () => void;
}

export const useRatingsStore = create<RatingsState>()((set) => ({
  ratings: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });

    const { data, error } = await listMyRatingsAsDriver();
    if (error) {
      set({ loading: false, error });
      return;
    }

    set({
      loading: false,
      ratings: data.map((item) => ({
        id: item.id,
        stars: item.stars,
        comment: item.comment,
        createdAt: item.createdAt,
      })),
    });
  },

  reset: () => set({ ratings: [], loading: false, error: null }),
}));

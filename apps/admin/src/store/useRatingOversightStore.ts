import { create } from 'zustand';
import { listFlaggedLowRatings } from '../services/ratings';
import type { FlaggedLowRatingRow } from '../services/ratings';

interface RatingOversightState {
  drivers: FlaggedLowRatingRow[];
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
}

export const useRatingOversightStore = create<RatingOversightState>()((set) => ({
  drivers: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    const { data, error } = await listFlaggedLowRatings();
    set({ drivers: data, loading: false, error });
  },
}));

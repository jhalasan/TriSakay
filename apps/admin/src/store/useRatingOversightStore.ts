import { create } from 'zustand';
import { getFleetRatingAverage, listFlaggedLowRatings } from '../services/ratings';
import type { FlaggedLowRatingRow } from '../services/ratings';

interface RatingOversightState {
  drivers: FlaggedLowRatingRow[];
  fleetAverage: number | null;
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
}

export const useRatingOversightStore = create<RatingOversightState>()((set) => ({
  drivers: [],
  fleetAverage: null,
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    const [driversRes, fleetRes] = await Promise.all([listFlaggedLowRatings(), getFleetRatingAverage()]);
    set({ drivers: driversRes.data, fleetAverage: fleetRes.data, loading: false, error: driversRes.error ?? fleetRes.error });
  },
}));

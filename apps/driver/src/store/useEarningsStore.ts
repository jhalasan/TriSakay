import { create } from 'zustand';
import { getDriverEarnings, getDriverPeakHourHistogram } from '@trisakay/services';
import type { DailyEarning, PeakHourBucket } from '../types/earnings';

interface EarningsState {
  totalTracked: number;
  dailyBreakdown: DailyEarning[];
  loading: boolean;
  error: string | null;
  peakHours: PeakHourBucket[];
  peakHoursError: string | null;
  load: () => Promise<void>;
  reset: () => void;
}

/** 30-day lookback for the peak-hours chart — enough sample size without dragging in the driver's entire ride history. */
function thirtyDaysAgoIso(): string {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
}

export const useEarningsStore = create<EarningsState>()((set) => ({
  totalTracked: 0,
  dailyBreakdown: [],
  loading: false,
  error: null,
  peakHours: [],
  peakHoursError: null,

  load: async () => {
    set({ loading: true, error: null, peakHoursError: null });

    const [earnings, peakHours] = await Promise.all([getDriverEarnings(), getDriverPeakHourHistogram(thirtyDaysAgoIso())]);

    if (earnings.error || earnings.totalTracked === null || earnings.breakdown === null) {
      set({ loading: false, error: earnings.error ?? 'Could not load earnings.', peakHours: peakHours.data, peakHoursError: peakHours.error });
      return;
    }

    set({
      loading: false,
      totalTracked: earnings.totalTracked,
      dailyBreakdown: earnings.breakdown,
      peakHours: peakHours.data,
      peakHoursError: peakHours.error,
    });
  },

  reset: () =>
    set({
      totalTracked: 0,
      dailyBreakdown: [],
      loading: false,
      error: null,
      peakHours: [],
      peakHoursError: null,
    }),
}));

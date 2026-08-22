import { create } from 'zustand';
import { getDriverEarnings } from '@trisakay/services';
import type { DailyEarning, SettlementLogEntry } from '../types/earnings';

interface EarningsState {
  totalTracked: number;
  dailyBreakdown: DailyEarning[];
  loading: boolean;
  error: string | null;
  settlementLog: SettlementLogEntry[];
  load: () => Promise<void>;
  notifyPsoForSettlement: () => void;
  reset: () => void;
}

let nextEntryId = 1;

export const useEarningsStore = create<EarningsState>()((set, get) => ({
  totalTracked: 0,
  dailyBreakdown: [],
  loading: false,
  error: null,
  settlementLog: [],

  load: async () => {
    set({ loading: true, error: null });

    const { totalTracked, breakdown, error } = await getDriverEarnings();
    if (error || totalTracked === null || breakdown === null) {
      set({ loading: false, error: error ?? 'Could not load earnings.' });
      return;
    }

    set({ loading: false, totalTracked, dailyBreakdown: breakdown });
  },

  notifyPsoForSettlement: () => {
    const entry: SettlementLogEntry = {
      id: `settle-${nextEntryId++}`,
      amount: get().totalTracked,
      loggedAt: new Date().toISOString(),
    };
    set((state) => ({ settlementLog: [entry, ...state.settlementLog] }));
  },

  reset: () => set({ totalTracked: 0, dailyBreakdown: [], loading: false, error: null, settlementLog: [] }),
}));

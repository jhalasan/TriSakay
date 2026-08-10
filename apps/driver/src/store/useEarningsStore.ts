import { create } from 'zustand';
import { getDriverEarnings } from '@trisakay/services';
import type { SettlementLogEntry } from '../types/earnings';

interface EarningsState {
  totalTracked: number;
  loading: boolean;
  error: string | null;
  settlementLog: SettlementLogEntry[];
  load: () => Promise<void>;
  notifyPsoForSettlement: () => void;
}

let nextEntryId = 1;

export const useEarningsStore = create<EarningsState>()((set, get) => ({
  totalTracked: 0,
  loading: false,
  error: null,
  settlementLog: [],

  load: async () => {
    set({ loading: true, error: null });

    const { totalTracked, error } = await getDriverEarnings();
    if (error || totalTracked === null) {
      set({ loading: false, error: error ?? 'Could not load earnings.' });
      return;
    }

    set({ loading: false, totalTracked });
  },

  notifyPsoForSettlement: () => {
    const entry: SettlementLogEntry = {
      id: `settle-${nextEntryId++}`,
      amount: get().totalTracked,
      loggedAt: new Date().toISOString(),
    };
    set((state) => ({ settlementLog: [entry, ...state.settlementLog] }));
  },
}));

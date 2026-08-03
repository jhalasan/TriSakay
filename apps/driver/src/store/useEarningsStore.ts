import { create } from 'zustand';
import type { SettlementLogEntry } from '../types/earnings';

interface EarningsState {
  totalTracked: number;
  settlementLog: SettlementLogEntry[];
  creditTrip: (fare: number) => void;
  notifyPsoForSettlement: () => void;
}

let nextEntryId = 1;

export const useEarningsStore = create<EarningsState>()((set, get) => ({
  totalTracked: 0,
  settlementLog: [],

  creditTrip: (fare) => set((state) => ({ totalTracked: state.totalTracked + fare })),

  notifyPsoForSettlement: () => {
    const entry: SettlementLogEntry = {
      id: `settle-${nextEntryId++}`,
      amount: get().totalTracked,
      loggedAt: new Date().toISOString(),
    };
    set((state) => ({ settlementLog: [entry, ...state.settlementLog] }));
  },
}));

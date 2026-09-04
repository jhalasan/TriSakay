import { create } from 'zustand';
import { getDriverEarnings, listMySettlements, notifyPsoForSettlement as notifyPsoForSettlementService } from '@trisakay/services';
import type { DailyEarning, SettlementLogEntry } from '../types/earnings';

interface EarningsState {
  totalTracked: number;
  dailyBreakdown: DailyEarning[];
  loading: boolean;
  error: string | null;
  settlementLog: SettlementLogEntry[];
  settlementsError: string | null;
  notifying: boolean;
  load: () => Promise<void>;
  notifyPsoForSettlement: () => Promise<void>;
  reset: () => void;
}

function toSettlementLogEntry(row: { id: string; amount: number; notifiedAt: string }): SettlementLogEntry {
  return { id: row.id, amount: row.amount, loggedAt: row.notifiedAt };
}

export const useEarningsStore = create<EarningsState>()((set, get) => ({
  totalTracked: 0,
  dailyBreakdown: [],
  loading: false,
  error: null,
  settlementLog: [],
  settlementsError: null,
  notifying: false,

  load: async () => {
    set({ loading: true, error: null, settlementsError: null });

    const [earnings, settlements] = await Promise.all([getDriverEarnings(), listMySettlements()]);

    if (earnings.error || earnings.totalTracked === null || earnings.breakdown === null) {
      set({ loading: false, error: earnings.error ?? 'Could not load earnings.' });
      return;
    }

    set({
      loading: false,
      totalTracked: earnings.totalTracked,
      dailyBreakdown: earnings.breakdown,
      settlementLog: settlements.data.map(toSettlementLogEntry),
      settlementsError: settlements.error,
    });
  },

  notifyPsoForSettlement: async () => {
    if (get().notifying) return;
    set({ notifying: true, settlementsError: null });

    const { error } = await notifyPsoForSettlementService(get().totalTracked);
    if (error) {
      set({ notifying: false, settlementsError: error });
      return;
    }

    const { data, error: reloadError } = await listMySettlements();
    set({ notifying: false, settlementLog: data.map(toSettlementLogEntry), settlementsError: reloadError });
  },

  reset: () =>
    set({
      totalTracked: 0,
      dailyBreakdown: [],
      loading: false,
      error: null,
      settlementLog: [],
      settlementsError: null,
      notifying: false,
    }),
}));

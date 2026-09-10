import { create } from 'zustand';
import { blockPassenger, listPassengers, unblockPassenger } from '../services/passengers';
import { runBulkAction, type BulkActionSummary } from '../lib/bulkActions';
import type { PassengerRow } from '../types/passenger';

/** 'discount_approved' isn't an account status — it's the strip's fourth cell (README §05), filtering on PassengerRow.discount instead. */
export type PassengerStatusFilter = PassengerRow['accountStatus'] | 'all' | 'discount_approved';

interface PassengersState {
  passengers: PassengerRow[];
  loading: boolean;
  error: string | null;
  search: string;
  statusFilter: PassengerStatusFilter;
  page: number;
  fetch: () => Promise<void>;
  setSearch: (value: string) => void;
  setStatusFilter: (value: PassengersState['statusFilter']) => void;
  setPage: (page: number) => void;
  block: (passengerId: string, reason: string) => Promise<boolean>;
  unblock: (passengerId: string, reason: string) => Promise<boolean>;
  bulkBlock: (passengerIds: string[], reason: string) => Promise<BulkActionSummary>;
  bulkUnblock: (passengerIds: string[], reason: string) => Promise<BulkActionSummary>;
}

export const usePassengersStore = create<PassengersState>()((set, get) => ({
  passengers: [],
  loading: false,
  error: null,
  search: '',
  statusFilter: 'all',
  page: 1,

  fetch: async () => {
    set({ loading: true, error: null });
    const { data, error } = await listPassengers();
    set({ passengers: data, loading: false, error });
  },

  setSearch: (value) => set({ search: value, page: 1 }),
  setStatusFilter: (value) => set({ statusFilter: value, page: 1 }),
  setPage: (page) => set({ page }),

  block: async (passengerId, reason) => {
    const { error } = await blockPassenger(passengerId, reason);
    if (error) {
      set({ error });
      return false;
    }
    await get().fetch();
    return true;
  },

  unblock: async (passengerId, reason) => {
    const { error } = await unblockPassenger(passengerId, reason);
    if (error) {
      set({ error });
      return false;
    }
    await get().fetch();
    return true;
  },

  bulkBlock: async (passengerIds, reason) => {
    const summary = await runBulkAction(passengerIds, blockPassenger, reason);
    if (summary.failed > 0) set({ error: `${summary.failed} of ${passengerIds.length} passenger(s) could not be blocked.` });
    await get().fetch();
    return summary;
  },

  bulkUnblock: async (passengerIds, reason) => {
    const summary = await runBulkAction(passengerIds, unblockPassenger, reason);
    if (summary.failed > 0) set({ error: `${summary.failed} of ${passengerIds.length} passenger(s) could not be unblocked.` });
    await get().fetch();
    return summary;
  },
}));

import { create } from 'zustand';
import { blockPassenger, listPassengers, unblockPassenger } from '../services/passengers';
import type { PassengerRow } from '../types/passenger';

interface PassengersState {
  passengers: PassengerRow[];
  loading: boolean;
  error: string | null;
  search: string;
  statusFilter: PassengerRow['accountStatus'] | 'all';
  page: number;
  fetch: () => Promise<void>;
  setSearch: (value: string) => void;
  setStatusFilter: (value: PassengersState['statusFilter']) => void;
  setPage: (page: number) => void;
  block: (passengerId: string) => Promise<void>;
  unblock: (passengerId: string) => Promise<void>;
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

  block: async (passengerId) => {
    const { error } = await blockPassenger(passengerId);
    if (error) return set({ error });
    await get().fetch();
  },

  unblock: async (passengerId) => {
    const { error } = await unblockPassenger(passengerId);
    if (error) return set({ error });
    await get().fetch();
  },
}));

import { create } from 'zustand';
import { flagDriver, listDrivers, reactivateDriver, suspendDriver } from '../services/drivers';
import type { DriverRow } from '../types/driver';

interface DriversState {
  drivers: DriverRow[];
  loading: boolean;
  error: string | null;
  search: string;
  statusFilter: DriverRow['accountStatus'] | 'all';
  page: number;
  fetch: () => Promise<void>;
  setSearch: (value: string) => void;
  setStatusFilter: (value: DriversState['statusFilter']) => void;
  setPage: (page: number) => void;
  flag: (driverId: string) => Promise<void>;
  suspend: (driverId: string) => Promise<void>;
  reactivate: (driverId: string) => Promise<void>;
}

export const useDriversStore = create<DriversState>()((set, get) => ({
  drivers: [],
  loading: false,
  error: null,
  search: '',
  statusFilter: 'all',
  page: 1,

  fetch: async () => {
    set({ loading: true, error: null });
    const { data, error } = await listDrivers();
    set({ drivers: data, loading: false, error });
  },

  setSearch: (value) => set({ search: value, page: 1 }),
  setStatusFilter: (value) => set({ statusFilter: value, page: 1 }),
  setPage: (page) => set({ page }),

  flag: async (driverId) => {
    const { error } = await flagDriver(driverId);
    if (error) return set({ error });
    await get().fetch();
  },

  suspend: async (driverId) => {
    const { error } = await suspendDriver(driverId);
    if (error) return set({ error });
    await get().fetch();
  },

  reactivate: async (driverId) => {
    const { error } = await reactivateDriver(driverId);
    if (error) return set({ error });
    await get().fetch();
  },
}));

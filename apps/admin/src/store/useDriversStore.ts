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
  flag: (driverId: string, reason: string) => Promise<boolean>;
  suspend: (driverId: string, reason: string) => Promise<boolean>;
  reactivate: (driverId: string, reason: string) => Promise<boolean>;
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

  flag: async (driverId, reason) => {
    const { error } = await flagDriver(driverId, reason);
    if (error) {
      set({ error });
      return false;
    }
    await get().fetch();
    return true;
  },

  suspend: async (driverId, reason) => {
    const { error } = await suspendDriver(driverId, reason);
    if (error) {
      set({ error });
      return false;
    }
    await get().fetch();
    return true;
  },

  reactivate: async (driverId, reason) => {
    const { error } = await reactivateDriver(driverId, reason);
    if (error) {
      set({ error });
      return false;
    }
    await get().fetch();
    return true;
  },
}));

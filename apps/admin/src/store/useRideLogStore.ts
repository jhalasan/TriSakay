import { create } from 'zustand';
import { listRideLog } from '../services/rides';
import type { ReportDateRange } from '../services/reports';
import type { RideLogRow, RideLogStatus } from '../types/ride';

export type RideLogStatusFilter = RideLogStatus | 'all';

interface RideLogState {
  rides: RideLogRow[];
  loading: boolean;
  error: string | null;
  search: string;
  statusFilter: RideLogStatusFilter;
  dateRange: ReportDateRange;
  page: number;
  fetch: () => Promise<void>;
  setSearch: (value: string) => void;
  setStatusFilter: (value: RideLogStatusFilter) => void;
  setDateRange: (value: ReportDateRange) => void;
  setPage: (page: number) => void;
}

export const useRideLogStore = create<RideLogState>()((set, get) => ({
  rides: [],
  loading: false,
  error: null,
  search: '',
  statusFilter: 'all',
  dateRange: '30d',
  page: 1,

  fetch: async () => {
    set({ loading: true, error: null });
    const { data, error } = await listRideLog(get().dateRange);
    set({ rides: data, loading: false, error });
  },

  setSearch: (value) => set({ search: value, page: 1 }),
  setStatusFilter: (value) => set({ statusFilter: value, page: 1 }),
  setDateRange: (value) => {
    set({ dateRange: value, page: 1 });
    get().fetch();
  },
  setPage: (page) => set({ page }),
}));

import { create } from 'zustand';
import {
  listComplaints,
  recordComplaintResolution,
  recordDhDirective,
  scheduleComplaintMediation,
  setComplaintStatus,
} from '../services/complaints';
import type { ComplaintRow, ComplaintStatus } from '../types/complaint';

interface ComplaintsState {
  complaints: ComplaintRow[];
  loading: boolean;
  error: string | null;
  search: string;
  statusFilter: ComplaintStatus | 'all';
  page: number;
  fetch: () => Promise<void>;
  setSearch: (value: string) => void;
  setStatusFilter: (value: ComplaintsState['statusFilter']) => void;
  setPage: (page: number) => void;
  updateStatus: (id: string, status: ComplaintStatus) => Promise<void>;
  setDhDirective: (id: string, directive: string) => Promise<void>;
  scheduleMediation: (id: string, meetingAt: string, location: string) => Promise<void>;
  recordResolution: (id: string, status: 'resolved' | 'dismissed', notes: string) => Promise<void>;
}

export const useComplaintsStore = create<ComplaintsState>()((set, get) => ({
  complaints: [],
  loading: false,
  error: null,
  search: '',
  statusFilter: 'all',
  page: 1,

  fetch: async () => {
    set({ loading: true, error: null });
    const { data, error } = await listComplaints();
    set({ complaints: data, loading: false, error });
  },

  setSearch: (value) => set({ search: value, page: 1 }),
  setStatusFilter: (value) => set({ statusFilter: value, page: 1 }),
  setPage: (page) => set({ page }),

  updateStatus: async (id, status) => {
    const { error } = await setComplaintStatus(id, status);
    if (error) return set({ error });
    await get().fetch();
  },

  setDhDirective: async (id, directive) => {
    const { error } = await recordDhDirective(id, directive);
    if (error) return set({ error });
    await get().fetch();
  },

  scheduleMediation: async (id, meetingAt, location) => {
    const { error } = await scheduleComplaintMediation(id, meetingAt, location);
    if (error) return set({ error });
    await get().fetch();
  },

  recordResolution: async (id, status, notes) => {
    const { error } = await recordComplaintResolution(id, status, notes);
    if (error) return set({ error });
    await get().fetch();
  },
}));

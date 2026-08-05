import { create } from 'zustand';
import {
  approveVerification,
  listVerificationCases,
  rejectVerification,
  updateVerificationCase,
} from '../services/verification';
import type { VerificationCase } from '../types/verification';

interface VerificationState {
  cases: VerificationCase[];
  selectedDriverId: string | null;
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  select: (driverId: string) => void;
  updateFields: (
    driverId: string,
    patch: Partial<Pick<VerificationCase, 'mtopNo' | 'mtopExpiryDate' | 'cluster' | 'notes'>>
  ) => Promise<void>;
  approve: (driverId: string) => Promise<void>;
  reject: (driverId: string) => Promise<void>;
}

export const useVerificationStore = create<VerificationState>()((set, get) => ({
  cases: [],
  selectedDriverId: null,
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    const { data, error } = await listVerificationCases();
    set({
      cases: data,
      selectedDriverId: get().selectedDriverId ?? data[0]?.driverId ?? null,
      loading: false,
      error,
    });
  },

  select: (driverId) => set({ selectedDriverId: driverId }),

  updateFields: async (driverId, patch) => {
    // Optimistic — this is a low-stakes transcription field, not an S+ decision.
    set((state) => ({
      cases: state.cases.map((c) => (c.driverId === driverId ? { ...c, ...patch } : c)),
    }));
    const { error } = await updateVerificationCase(driverId, patch);
    if (error) set({ error });
  },

  approve: async (driverId) => {
    const { error } = await approveVerification(driverId);
    if (error) return set({ error });
    await get().fetch();
  },

  reject: async (driverId) => {
    const { error } = await rejectVerification(driverId);
    if (error) return set({ error });
    await get().fetch();
  },
}));

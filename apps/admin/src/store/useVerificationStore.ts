import { create } from 'zustand';
import {
  approveVerification,
  listVerificationCases,
  rejectVerification,
  updateVerificationCase,
} from '../services/verification';
import type { VerificationCase } from '../types/verification';

// P2 (2026-09-15 launch audit): updateFields() used to fire one UPDATE per
// keystroke — a 16-char MTOP number was 16 unordered round-trips, and a
// slow one landing last could persist a stale prefix into the franchise
// record. The optimistic local update below still applies instantly; only
// the backend write is debounced, keyed per driver so typing in one case's
// fields doesn't delay another's.
const DEBOUNCE_MS = 600;
const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>();

interface VerificationState {
  cases: VerificationCase[];
  selectedDriverId: string | null;
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  select: (driverId: string | null) => void;
  updateFields: (
    driverId: string,
    patch: Partial<Pick<VerificationCase, 'mtopNo' | 'mtopExpiryDate' | 'cluster' | 'notes'>>
  ) => Promise<void>;
  approve: (driverId: string, notes?: string) => Promise<boolean>;
  reject: (driverId: string, notes: string) => Promise<boolean>;
}

export const useVerificationStore = create<VerificationState>()((set, get) => {
  async function flushPendingWrite(driverId: string) {
    const existingTimer = pendingWrites.get(driverId);
    if (!existingTimer) return;
    clearTimeout(existingTimer);
    pendingWrites.delete(driverId);
    const current = get().cases.find((c) => c.driverId === driverId);
    if (current) {
      const { error } = await updateVerificationCase(driverId, {
        mtopNo: current.mtopNo,
        mtopExpiryDate: current.mtopExpiryDate,
        cluster: current.cluster,
        notes: current.notes,
      });
      if (error) set({ error });
    }
  }

  return {
    cases: [],
    selectedDriverId: null,
    loading: false,
    error: null,

    fetch: async () => {
      set({ loading: true, error: null });
      const { data, error } = await listVerificationCases();
      set({
        cases: data,
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

      const existingTimer = pendingWrites.get(driverId);
      if (existingTimer) clearTimeout(existingTimer);

      pendingWrites.set(
        driverId,
        setTimeout(() => {
          void flushPendingWrite(driverId);
        }, DEBOUNCE_MS)
      );
    },

    approve: async (driverId, notes) => {
      await flushPendingWrite(driverId);
      const { error } = await approveVerification(driverId, notes);
      if (error) {
        set({ error });
        return false;
      }
      await get().fetch();
      return true;
    },

    reject: async (driverId, notes) => {
      await flushPendingWrite(driverId);
      const { error } = await rejectVerification(driverId, notes);
      if (error) {
        set({ error });
        return false;
      }
      await get().fetch();
      return true;
    },
  };
});

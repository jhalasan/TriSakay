import { create } from 'zustand';
import { approveDiscount, listPendingDiscounts, rejectDiscount, updateDiscountCase } from '../services/discounts';
import type { DiscountRow } from '../types/discount';

// P2 (2026-09-15 launch audit): updateFields() used to fire one UPDATE per
// keystroke — see the identical fix and rationale in useVerificationStore.ts.
// The optimistic local update still applies instantly; only the backend
// write is debounced, keyed per discount case.
const DEBOUNCE_MS = 600;
const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>();

interface DiscountsState {
  items: DiscountRow[];
  selectedId: string | null;
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  select: (id: string | null) => void;
  updateFields: (id: string, patch: Partial<Pick<DiscountRow, 'idNumber' | 'dateOfBirth' | 'issuingOffice'>>) => Promise<void>;
  approve: (id: string, remarks?: string) => Promise<boolean>;
  reject: (id: string, remarks: string) => Promise<boolean>;
}

export const useDiscountsStore = create<DiscountsState>()((set, get) => {
  async function flushPendingWrite(id: string) {
    const existingTimer = pendingWrites.get(id);
    if (!existingTimer) return;
    clearTimeout(existingTimer);
    pendingWrites.delete(id);
    const current = get().items.find((d) => d.id === id);
    if (current) {
      const { error } = await updateDiscountCase(id, {
        idNumber: current.idNumber,
        dateOfBirth: current.dateOfBirth,
        issuingOffice: current.issuingOffice,
      });
      if (error) set({ error });
    }
  }

  return {
    items: [],
    selectedId: null,
    loading: false,
    error: null,

    fetch: async () => {
      set({ loading: true, error: null });
      const { data, error } = await listPendingDiscounts();
      set({
        items: data,
        loading: false,
        error,
      });
    },

    select: (id) => set({ selectedId: id }),

    updateFields: async (id, patch) => {
      // Optimistic — this is a low-stakes transcription field, not an S+ decision.
      set((state) => ({
        items: state.items.map((d) => (d.id === id ? { ...d, ...patch } : d)),
      }));

      const existingTimer = pendingWrites.get(id);
      if (existingTimer) clearTimeout(existingTimer);

      pendingWrites.set(
        id,
        setTimeout(() => {
          void flushPendingWrite(id);
        }, DEBOUNCE_MS)
      );
    },

    approve: async (id, remarks) => {
      await flushPendingWrite(id);
      const { error } = await approveDiscount(id, remarks);
      if (error) {
        set({ error });
        return false;
      }
      await get().fetch();
      return true;
    },

    reject: async (id, remarks) => {
      await flushPendingWrite(id);
      const { error } = await rejectDiscount(id, remarks);
      if (error) {
        set({ error });
        return false;
      }
      await get().fetch();
      return true;
    },
  };
});

import { create } from 'zustand';
import { approveDiscount, listPendingDiscounts, rejectDiscount, updateDiscountCase } from '../services/discounts';
import type { DiscountRow } from '../types/discount';

interface DiscountsState {
  items: DiscountRow[];
  selectedId: string | null;
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  select: (id: string) => void;
  updateFields: (id: string, patch: Partial<Pick<DiscountRow, 'idNumber' | 'dateOfBirth' | 'issuingOffice'>>) => Promise<void>;
  approve: (id: string, remarks?: string) => Promise<boolean>;
  reject: (id: string, remarks: string) => Promise<boolean>;
}

export const useDiscountsStore = create<DiscountsState>()((set, get) => ({
  items: [],
  selectedId: null,
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    const { data, error } = await listPendingDiscounts();
    set({
      items: data,
      selectedId: get().selectedId ?? data[0]?.id ?? null,
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
    const { error } = await updateDiscountCase(id, patch);
    if (error) set({ error });
  },

  approve: async (id, remarks) => {
    const { error } = await approveDiscount(id, remarks);
    if (error) {
      set({ error });
      return false;
    }
    await get().fetch();
    return true;
  },

  reject: async (id, remarks) => {
    const { error } = await rejectDiscount(id, remarks);
    if (error) {
      set({ error });
      return false;
    }
    await get().fetch();
    return true;
  },
}));

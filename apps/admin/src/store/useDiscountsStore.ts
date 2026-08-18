import { create } from 'zustand';
import { approveDiscount, listPendingDiscounts, rejectDiscount } from '../services/discounts';
import type { DiscountRow } from '../types/discount';

interface DiscountsState {
  items: DiscountRow[];
  selectedId: string | null;
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  select: (id: string) => void;
  approve: (id: string, remarks?: string) => Promise<void>;
  reject: (id: string, remarks: string) => Promise<void>;
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

  approve: async (id, remarks) => {
    const { error } = await approveDiscount(id, remarks);
    if (error) return set({ error });
    await get().fetch();
  },

  reject: async (id, remarks) => {
    const { error } = await rejectDiscount(id, remarks);
    if (error) return set({ error });
    await get().fetch();
  },
}));

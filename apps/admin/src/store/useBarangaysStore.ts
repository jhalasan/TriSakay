import { create } from 'zustand';
import { createBarangay, deleteBarangay, listBarangays, updateBarangay } from '../services/barangays';
import type { BarangayInput, BarangayRow } from '../services/barangays';

interface BarangaysState {
  barangays: BarangayRow[];
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  create: (input: BarangayInput) => Promise<boolean>;
  update: (id: string, input: BarangayInput) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
}

export const useBarangaysStore = create<BarangaysState>()((set, get) => ({
  barangays: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    const { data, error } = await listBarangays();
    set({ barangays: data, loading: false, error });
  },

  create: async (input) => {
    const { error } = await createBarangay(input);
    if (error) {
      set({ error });
      return false;
    }
    await get().fetch();
    return true;
  },

  update: async (id, input) => {
    const { error } = await updateBarangay(id, input);
    if (error) {
      set({ error });
      return false;
    }
    await get().fetch();
    return true;
  },

  remove: async (id) => {
    const { error } = await deleteBarangay(id);
    if (error) {
      set({ error });
      return false;
    }
    await get().fetch();
    return true;
  },
}));

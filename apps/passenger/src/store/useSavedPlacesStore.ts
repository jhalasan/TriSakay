import { create } from 'zustand';
import { deleteSavedPlace, listSavedPlaces, type SavedPlaceRow } from '@trisakay/services';

interface SavedPlacesState {
  items: SavedPlaceRow[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  remove: (id: string) => Promise<{ error: string | null }>;
}

export const useSavedPlacesStore = create<SavedPlacesState>()((set, get) => ({
  items: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    const { data, error } = await listSavedPlaces();
    if (error) {
      set({ loading: false, error });
      return;
    }
    set({ loading: false, items: data });
  },

  remove: async (id) => {
    const { error } = await deleteSavedPlace(id);
    if (!error) {
      set({ items: get().items.filter((item) => item.id !== id) });
    }
    return { error };
  },
}));

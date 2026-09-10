import { create } from 'zustand';
import { deleteSavedPlace, listSavedPlaces, type SavedPlaceRow } from '@trisakay/services';

interface SavedPlacesState {
  items: SavedPlaceRow[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  remove: (id: string) => Promise<{ error: string | null }>;
}

export const useSavedPlacesStore = create<SavedPlacesState>()((set, get) => {
  // Guards against an out-of-order resolution when a focus-triggered load()
  // overlaps a pull-to-refresh triggered one — same pattern as the driver
  // app's useDriverStore checkRating/checkAcceptRate.
  let loadEpoch = 0;

  return {
    items: [],
    loading: false,
    error: null,

    load: async () => {
      const epoch = ++loadEpoch;
      set({ loading: true, error: null });
      const { data, error } = await listSavedPlaces();
      if (epoch !== loadEpoch) return;
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
  };
});

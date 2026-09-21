import { create } from 'zustand';
import { closeAlert, listEmergencyAlerts, markAlertReviewed } from '../services/emergency';
import type { EmergencyAlertRow } from '../types/emergency';

interface EmergencyAlertsState {
  alerts: EmergencyAlertRow[];
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  markReviewed: (id: string, notes?: string) => Promise<boolean>;
  close: (id: string) => Promise<boolean>;
}

export const useEmergencyAlertsStore = create<EmergencyAlertsState>()((set, get) => ({
  alerts: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    const { data, error } = await listEmergencyAlerts();
    set({ alerts: data, loading: false, error });
  },

  markReviewed: async (id, notes) => {
    const { error } = await markAlertReviewed(id, notes);
    if (error) {
      set({ error });
      return false;
    }
    await get().fetch();
    return true;
  },

  close: async (id) => {
    const { error } = await closeAlert(id);
    if (error) {
      set({ error });
      return false;
    }
    await get().fetch();
    return true;
  },
}));

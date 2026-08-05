import { create } from 'zustand';
import {
  getFareConfig,
  getFeatureToggles,
  getSystemSettings,
  updateFareConfig,
  updateFeatureToggles,
} from '../services/settings';
import type { FareConfig, FeatureToggles, SystemSettings } from '../types/settings';

interface SettingsState {
  fareConfig: FareConfig | null;
  systemSettings: SystemSettings | null;
  featureToggles: FeatureToggles | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  savedAt: string | null;
  fetch: () => Promise<void>;
  saveFareConfig: (patch: Partial<FareConfig>) => Promise<void>;
  toggleFeature: (key: keyof FeatureToggles) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  fareConfig: null,
  systemSettings: null,
  featureToggles: null,
  loading: false,
  saving: false,
  error: null,
  savedAt: null,

  fetch: async () => {
    set({ loading: true, error: null });
    const [fare, system, toggles] = await Promise.all([
      getFareConfig(),
      getSystemSettings(),
      getFeatureToggles(),
    ]);
    set({
      fareConfig: fare.data,
      systemSettings: system.data,
      featureToggles: toggles.data,
      loading: false,
      error: fare.error ?? system.error ?? toggles.error,
    });
  },

  saveFareConfig: async (patch) => {
    set({ saving: true, error: null });
    const { error } = await updateFareConfig(patch);
    if (error) return set({ saving: false, error });
    set((state) => ({
      fareConfig: state.fareConfig ? { ...state.fareConfig, ...patch } : state.fareConfig,
      saving: false,
      savedAt: new Date().toISOString(),
    }));
  },

  toggleFeature: async (key) => {
    const current = get().featureToggles;
    if (!current) return;
    const patch = { [key]: !current[key] } as Partial<FeatureToggles>;
    set({ featureToggles: { ...current, ...patch } });
    const { error } = await updateFeatureToggles(patch);
    if (error) set({ error });
  },
}));

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { settingsStorage } from './settingsStorage.ts';

export type SettingsLanguage = 'en' | 'fil';

interface SettingsState {
  pushNotificationsEnabled: boolean;
  language: SettingsLanguage;
  togglePushNotifications: () => void;
  setLanguage: (language: SettingsLanguage) => void;
}

// P1-20 (2026-09-15 launch audit): locationTrackingEnabled, smsReceipts and
// emailReceipts were removed — each was a Settings toggle read by nothing
// (location tracking is not gated by any flag anywhere in the app; nothing
// sends an SMS or email receipt). Shipping a Privacy/notifications control
// that silently does nothing is worse than not offering it. If real
// per-channel notification preferences or a genuine location-tracking
// opt-out are built later, add them back wired to something real.
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      pushNotificationsEnabled: true,
      language: 'en',
      togglePushNotifications: () =>
        set((state) => ({ pushNotificationsEnabled: !state.pushNotificationsEnabled })),
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'trisakay-passenger-settings',
      storage: createJSONStorage(() => settingsStorage),
    },
  ),
);

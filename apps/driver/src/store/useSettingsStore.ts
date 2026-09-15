import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { settingsStorage } from './settingsStorage.ts';

export type SettingsLanguage = 'en' | 'fil';

interface SettingsState {
  pushNotificationsEnabled: boolean;
  locationTrackingEnabled: boolean;
  language: SettingsLanguage;
  togglePushNotifications: () => void;
  toggleLocationTracking: () => void;
  setLanguage: (language: SettingsLanguage) => void;
}

// P1-20 (2026-09-15 launch audit): smsReceipts/emailReceipts removed —
// each was a Settings toggle read by nothing (no SMS or email receipt is
// ever sent anywhere in the app). locationTrackingEnabled stays: it's real,
// read by useDriverLocationSync.
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      pushNotificationsEnabled: true,
      locationTrackingEnabled: true,
      language: 'en',
      togglePushNotifications: () => set((state) => ({ pushNotificationsEnabled: !state.pushNotificationsEnabled })),
      toggleLocationTracking: () => set((state) => ({ locationTrackingEnabled: !state.locationTrackingEnabled })),
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'trisakay-driver-settings',
      storage: createJSONStorage(() => settingsStorage),
    },
  ),
);

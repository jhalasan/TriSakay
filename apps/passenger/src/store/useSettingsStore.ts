import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { settingsStorage } from './settingsStorage.ts';

export type SettingsLanguage = 'en' | 'fil';

interface SettingsState {
  pushNotificationsEnabled: boolean;
  locationTrackingEnabled: boolean;
  language: SettingsLanguage;
  smsReceipts: boolean;
  emailReceipts: boolean;
  togglePushNotifications: () => void;
  toggleLocationTracking: () => void;
  setLanguage: (language: SettingsLanguage) => void;
  toggleSmsReceipts: () => void;
  toggleEmailReceipts: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      pushNotificationsEnabled: true,
      locationTrackingEnabled: true,
      language: 'en',
      smsReceipts: false,
      emailReceipts: true,
      togglePushNotifications: () =>
        set((state) => ({ pushNotificationsEnabled: !state.pushNotificationsEnabled })),
      toggleLocationTracking: () =>
        set((state) => ({ locationTrackingEnabled: !state.locationTrackingEnabled })),
      setLanguage: (language) => set({ language }),
      toggleSmsReceipts: () => set((state) => ({ smsReceipts: !state.smsReceipts })),
      toggleEmailReceipts: () => set((state) => ({ emailReceipts: !state.emailReceipts })),
    }),
    {
      name: 'trisakay-passenger-settings',
      storage: createJSONStorage(() => settingsStorage),
    },
  ),
);

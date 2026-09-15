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

// P1-20 (2026-09-15 launch audit) flagged smsReceipts/emailReceipts as dead
// — neither was read by anything (no SMS or email receipt is ever sent
// anywhere in the app). Re-added on request (2026-09-15) as prototype-only
// controls. locationTrackingEnabled is unaffected either way: it's real,
// read by useDriverLocationSync.
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      pushNotificationsEnabled: true,
      locationTrackingEnabled: true,
      language: 'en',
      smsReceipts: false,
      emailReceipts: true,
      togglePushNotifications: () => set((state) => ({ pushNotificationsEnabled: !state.pushNotificationsEnabled })),
      toggleLocationTracking: () => set((state) => ({ locationTrackingEnabled: !state.locationTrackingEnabled })),
      setLanguage: (language) => set({ language }),
      toggleSmsReceipts: () => set((state) => ({ smsReceipts: !state.smsReceipts })),
      toggleEmailReceipts: () => set((state) => ({ emailReceipts: !state.emailReceipts })),
    }),
    {
      name: 'trisakay-driver-settings',
      storage: createJSONStorage(() => settingsStorage),
    },
  ),
);

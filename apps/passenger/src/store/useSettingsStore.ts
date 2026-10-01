import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { settingsStorage } from './settingsStorage.ts';

export type SettingsLanguage = 'en' | 'fil';

interface SettingsState {
  pushNotificationsEnabled: boolean;
  locationTrackingEnabled: boolean;
  language: SettingsLanguage;
  smsReceipts: boolean;
  togglePushNotifications: () => void;
  toggleLocationTracking: () => void;
  setLanguage: (language: SettingsLanguage) => void;
  toggleSmsReceipts: () => void;
}

// Email receipts are no longer a local setting: the switch reads and writes users.email_receipts
// (see app/(tabs)/settings.tsx). The notes below predate that.
// P1-20 (2026-09-15 launch audit) flagged locationTrackingEnabled, smsReceipts
// and emailReceipts as dead — each was a toggle read by nothing (location
// tracking is not gated by any flag anywhere in the app; nothing sends an SMS
// or email receipt). Re-added on request (2026-09-15) as prototype-only
// controls: they persist locally like any other setting here.
// 2026-09-21 (UAT P20): locationTrackingEnabled is no longer dead — it now
// gates the silent GPS auto-detect on the Request a Tricycle screen
// (app/booking/request.tsx). smsReceipts/emailReceipts remain prototype-only.
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      pushNotificationsEnabled: true,
      locationTrackingEnabled: true,
      language: 'en',
      smsReceipts: false,
      togglePushNotifications: () =>
        set((state) => ({ pushNotificationsEnabled: !state.pushNotificationsEnabled })),
      toggleLocationTracking: () =>
        set((state) => ({ locationTrackingEnabled: !state.locationTrackingEnabled })),
      setLanguage: (language) => set({ language }),
      toggleSmsReceipts: () => set((state) => ({ smsReceipts: !state.smsReceipts })),
    }),
    {
      name: 'trisakay-passenger-settings',
      storage: createJSONStorage(() => settingsStorage),
    },
  ),
);

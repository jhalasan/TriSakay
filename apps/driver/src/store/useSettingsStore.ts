import { create } from 'zustand';

interface SettingsState {
  pushNotificationsEnabled: boolean;
  locationTrackingEnabled: boolean;
  language: string;
  smsReceipts: boolean;
  emailReceipts: boolean;
  togglePushNotifications: () => void;
  toggleLocationTracking: () => void;
  toggleSmsReceipts: () => void;
  toggleEmailReceipts: () => void;
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  pushNotificationsEnabled: true,
  locationTrackingEnabled: true,
  language: 'English',
  smsReceipts: false,
  emailReceipts: true,
  togglePushNotifications: () => set((state) => ({ pushNotificationsEnabled: !state.pushNotificationsEnabled })),
  toggleLocationTracking: () => set((state) => ({ locationTrackingEnabled: !state.locationTrackingEnabled })),
  toggleSmsReceipts: () => set((state) => ({ smsReceipts: !state.smsReceipts })),
  toggleEmailReceipts: () => set((state) => ({ emailReceipts: !state.emailReceipts })),
}));

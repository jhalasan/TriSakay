import { create } from 'zustand';
import type { NotificationItem } from '../types/notification';

interface NotificationsState {
  items: NotificationItem[];
  markAllRead: () => void;
}

export const useNotificationsStore = create<NotificationsState>()((set) => ({
  items: [],
  markAllRead: () => set((state) => ({ items: state.items.map((item) => ({ ...item, read: true })) })),
}));

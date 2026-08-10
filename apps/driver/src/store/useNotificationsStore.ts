import { create } from 'zustand';
import { markAllNotificationsRead, subscribeToNotifications, type NotificationRow } from '@trisakay/services';
import type { NotificationItem } from '../types/notification';

function toItem(row: NotificationRow): NotificationItem {
  return { id: row.id, title: row.title, body: row.message, read: row.is_read, createdAt: row.created_at };
}

let stopRealtime: (() => void) | null = null;

interface NotificationsState {
  items: NotificationItem[];
  error: string | null;
  subscribe: (userId: string) => void;
  unsubscribe: () => void;
  markAllRead: () => Promise<void>;
}

export const useNotificationsStore = create<NotificationsState>()((set) => ({
  items: [],
  error: null,

  subscribe: (userId) => {
    stopRealtime?.();
    stopRealtime = subscribeToNotifications(
      userId,
      (rows) => set({ items: rows.map(toItem), error: null }),
      (message) => set({ error: message }),
    );
  },

  unsubscribe: () => {
    stopRealtime?.();
    stopRealtime = null;
    set({ items: [], error: null });
  },

  markAllRead: async () => {
    // Optimistic — the Realtime subscription reconciles right behind this
    // anyway, so the visual flip doesn't need to wait on the round-trip.
    set((state) => ({ items: state.items.map((item) => ({ ...item, read: true })) }));

    const { error } = await markAllNotificationsRead();
    if (error) set({ error });
  },
}));

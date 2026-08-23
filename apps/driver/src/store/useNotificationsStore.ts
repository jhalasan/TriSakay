import { create } from 'zustand';
import { markAllNotificationsRead, markNotificationRead, subscribeToNotifications, type NotificationRow } from '@trisakay/services';
import type { NotificationItem } from '../types/notification';

function toItem(row: NotificationRow): NotificationItem {
  return { id: row.id, title: row.title, body: row.message, read: row.is_read, createdAt: row.created_at, type: row.type };
}

let stopRealtime: (() => void) | null = null;

interface NotificationsState {
  items: NotificationItem[];
  error: string | null;
  subscribe: (userId: string) => void;
  unsubscribe: () => void;
  markAllRead: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
}

export const useNotificationsStore = create<NotificationsState>()((set, get) => ({
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
    // But if the write fails, nothing changed server-side (no Realtime event
    // fires to correct it), so the previous snapshot is restored below —
    // otherwise the badge would stay silently wrong until the next restart.
    const previousItems = get().items;
    set({ items: previousItems.map((item) => ({ ...item, read: true })) });

    const { error } = await markAllNotificationsRead();
    if (error) set({ items: previousItems, error });
  },

  markRead: async (id) => {
    const previousItems = get().items;
    set({ items: previousItems.map((item) => (item.id === id ? { ...item, read: true } : item)) });

    const { error } = await markNotificationRead(id);
    if (error) set({ items: previousItems, error });
  },
}));

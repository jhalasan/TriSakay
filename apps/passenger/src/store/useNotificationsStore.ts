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
    // fires to correct it), so each item's own previous `read` value is
    // restored below — applied against the *current* state, not this
    // snapshot, so a concurrent markRead() that already succeeded elsewhere
    // isn't clobbered by this revert.
    const previousItems = get().items;
    const previousReadById = new Map(previousItems.map((item) => [item.id, item.read]));
    set({ items: previousItems.map((item) => ({ ...item, read: true })) });

    const { error } = await markAllNotificationsRead();
    if (error) {
      set((state) => ({
        items: state.items.map((item) =>
          previousReadById.has(item.id) ? { ...item, read: previousReadById.get(item.id)! } : item,
        ),
        error,
      }));
    }
  },

  markRead: async (id) => {
    const previousItem = get().items.find((item) => item.id === id);
    set((state) => ({ items: state.items.map((item) => (item.id === id ? { ...item, read: true } : item)) }));

    const { error } = await markNotificationRead(id);
    if (error) {
      // Revert only this item, against current state — a concurrent
      // markRead() for a different id that already succeeded must not be
      // clobbered by restoring a stale whole-array snapshot.
      set((state) => ({
        items: state.items.map((item) => (item.id === id ? { ...item, read: previousItem?.read ?? item.read } : item)),
        error,
      }));
    }
  },
}));

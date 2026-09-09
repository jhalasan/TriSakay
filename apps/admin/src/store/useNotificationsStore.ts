import { create } from 'zustand';
import {
  subscribeToNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationRow,
} from '@trisakay/services';

interface NotificationsState {
  notifications: NotificationRow[];
  error: string | null;
  /** Opens the Realtime subscription for the signed-in user; safe to call again — replaces any prior subscription. */
  connect: (userId: string) => void;
  disconnect: () => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

/**
 * Backs the TopBar's NotificationBell. Wraps @trisakay/services'
 * subscribeToNotifications() (already generic across all three apps, just
 * never consumed by this one) in a store so the bell survives route changes
 * without resubscribing, and disconnects on sign-out via TopBar's cleanup.
 */
export const useNotificationsStore = create<NotificationsState>()((set, get) => {
  let unsubscribe: (() => void) | null = null;

  return {
    notifications: [],
    error: null,

    connect: (userId) => {
      unsubscribe?.();
      unsubscribe = subscribeToNotifications(
        userId,
        (rows) => set({ notifications: rows, error: null }),
        (message) => set({ error: message }),
      );
    },

    disconnect: () => {
      unsubscribe?.();
      unsubscribe = null;
      set({ notifications: [], error: null });
    },

    markRead: async (id) => {
      const previous = get().notifications;
      set({ notifications: previous.map((n) => (n.id === id ? { ...n, is_read: true } : n)) });
      const { error } = await markNotificationRead(id);
      if (error) set({ notifications: previous, error });
    },

    markAllRead: async () => {
      const previous = get().notifications;
      set({ notifications: previous.map((n) => ({ ...n, is_read: true })) });
      const { error } = await markAllNotificationsRead();
      if (error) set({ notifications: previous, error });
    },
  };
});

import { create } from 'zustand';
import { listMessages, markMessagesRead, subscribeToRideMessages, subscribeToTyping, type RideMessage } from '@trisakay/services';

interface ChatState {
  rideRequestId: string | null;
  messages: RideMessage[];
  loading: boolean;
  error: string | null;
  otherPartyTyping: boolean;
  unreadCount: (selfUserId: string) => number;
  /** Loads history and opens the live subscription for this ride's thread — call once when the chat screen mounts. */
  connect: (rideRequestId: string, selfUserId: string) => void;
  disconnect: () => void;
}

let stopMessages: (() => void) | null = null;
let stopTyping: (() => void) | null = null;
let typingClearTimer: ReturnType<typeof setTimeout> | null = null;

export const useChatStore = create<ChatState>()((set, get) => ({
  rideRequestId: null,
  messages: [],
  loading: false,
  error: null,
  otherPartyTyping: false,

  unreadCount: (selfUserId: string) => get().messages.filter((m) => m.senderId !== selfUserId && m.readAt === null).length,

  connect: (rideRequestId: string, selfUserId: string) => {
    stopMessages?.();
    stopTyping?.();
    set({ rideRequestId, messages: [], loading: true, error: null, otherPartyTyping: false });

    stopMessages = subscribeToRideMessages(
      rideRequestId,
      (messages) => set({ loading: false, messages }),
      (message) => set({ loading: false, error: message })
    );

    stopTyping = subscribeToTyping(rideRequestId, (senderId) => {
      if (senderId === selfUserId) return;
      set({ otherPartyTyping: true });
      if (typingClearTimer) clearTimeout(typingClearTimer);
      typingClearTimer = setTimeout(() => set({ otherPartyTyping: false }), 3000);
    });

    void markMessagesRead(rideRequestId);
  },

  disconnect: () => {
    stopMessages?.();
    stopMessages = null;
    stopTyping?.();
    stopTyping = null;
    if (typingClearTimer) {
      clearTimeout(typingClearTimer);
      typingClearTimer = null;
    }
    set({ rideRequestId: null, messages: [], loading: false, error: null, otherPartyTyping: false });
  },
}));

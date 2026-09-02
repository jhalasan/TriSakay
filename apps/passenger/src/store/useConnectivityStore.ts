import { create } from 'zustand';
import NetInfo from '@react-native-community/netinfo';

interface ConnectivityState {
  isOffline: boolean;
  /** Subscribes to the device's connectivity listener; returns the unsubscribe. */
  subscribe: () => () => void;
}

export const useConnectivityStore = create<ConnectivityState>()((set) => ({
  // Starts online rather than unknown — `isConnected` is null for a brief
  // moment on cold start, and treating that as offline would flash the
  // offline strip on every launch before the first real reading arrives.
  isOffline: false,

  subscribe: () => {
    return NetInfo.addEventListener((state) => {
      set({ isOffline: state.isConnected === false });
    });
  },
}));

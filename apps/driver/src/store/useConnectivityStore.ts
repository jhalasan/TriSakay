import { create } from 'zustand';
import type * as NetworkModule from 'expo-network';

// P1-24 (2026-09-15 launch audit): mirrors apps/passenger/src/store/useConnectivityStore.ts
// verbatim — previously the driver app had no offline detection at all, so a
// driver who lost signal kept seeing "Listening for requests" with a pulsing
// ring while actually receiving nothing.
interface ConnectivityState {
  isOffline: boolean;
  /** Subscribes to the device's connectivity listener; returns the unsubscribe. */
  subscribe: () => () => void;
  /** Re-checks connectivity on demand. */
  refresh: () => Promise<void>;
}

/**
 * Required lazily, inside a try/catch, rather than as a static top-level
 * import — expo-network throws at module-evaluation time (not just when its
 * APIs are called) when its native module isn't linked (some Expo Go builds
 * hit this, same as @react-native-community/netinfo did before it). A static
 * `import` throws before any of this function's own code can run, so the
 * require has to happen inside whichever function wants to use it.
 */
function loadNetwork(): typeof NetworkModule | null {
  try {
    return require('expo-network') as typeof NetworkModule;
  } catch {
    return null;
  }
}

export const useConnectivityStore = create<ConnectivityState>()((set) => ({
  // Starts online rather than unknown — `isConnected` is undefined for a
  // brief moment on cold start, and treating that as offline would flash
  // the offline strip on every launch before the first real reading arrives.
  isOffline: false,

  subscribe: () => {
    const Network = loadNetwork();
    if (!Network) return () => {};

    const subscription = Network.addNetworkStateListener((state) => {
      set({ isOffline: state.isConnected === false });
    });
    return () => subscription.remove();
  },

  refresh: async () => {
    const Network = loadNetwork();
    if (!Network) return;

    const state = await Network.getNetworkStateAsync();
    set({ isOffline: state.isConnected === false });
  },
}));

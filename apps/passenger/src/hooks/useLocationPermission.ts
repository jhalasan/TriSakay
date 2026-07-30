import { AppState, Linking, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import { create } from 'zustand';

/**
 * 'blocked' means denied with canAskAgain === false — the OS will not show the
 * permission dialog again, so the only remaining route is system Settings.
 * 'unknown' means the status could not be read; it is never treated as granted.
 */
export type LocationPermissionState = 'unknown' | 'granted' | 'denied' | 'blocked';

interface LocationPermissionStore {
  state: LocationPermissionState;
  /** "Not now" suppresses the automatic prompt for this foreground session only. Never persisted. */
  dismissedThisForeground: boolean;
  refresh: () => Promise<LocationPermissionState>;
  request: () => Promise<LocationPermissionState>;
  dismiss: () => void;
}

function toState(response: Location.LocationPermissionResponse): LocationPermissionState {
  if (response.granted) return 'granted';
  return response.canAskAgain ? 'denied' : 'blocked';
}

export const useLocationPermissionStore = create<LocationPermissionStore>()((set, get) => ({
  state: 'unknown',
  dismissedThisForeground: false,

  refresh: async () => {
    let next: LocationPermissionState;
    try {
      next = toState(await Location.getForegroundPermissionsAsync());
    } catch {
      // A read that throws must never be interpreted as granted — staying
      // 'unknown' keeps location-dependent actions disabled rather than
      // letting the user into a flow that cannot work.
      next = 'unknown';
    }
    set({ state: next });
    return next;
  },

  request: async () => {
    if (get().state === 'blocked') {
      // The OS will not prompt again; send the user to system Settings instead
      // of firing a request that silently resolves to denied.
      await Linking.openSettings().catch(() => {});
      return 'blocked';
    }

    let next: LocationPermissionState;
    try {
      next = toState(await Location.requestForegroundPermissionsAsync());
    } catch {
      next = 'unknown';
    }
    set({ state: next });
    return next;
  },

  dismiss: () => set({ dismissedThisForeground: true }),
}));

/**
 * One listener for the whole app, registered at module load — the same idiom
 * useAuthStore uses for onAuthStateChange. Re-reading on every foreground is
 * what makes a permission granted in system Settings take effect on return,
 * with no reinstall and no cold start.
 */
let previousAppState: AppStateStatus = AppState.currentState;
AppState.addEventListener('change', (nextAppState) => {
  const returningToForeground = previousAppState !== 'active' && nextAppState === 'active';
  previousAppState = nextAppState;
  if (!returningToForeground) return;

  useLocationPermissionStore.setState({ dismissedThisForeground: false });
  void useLocationPermissionStore.getState().refresh();
});

void useLocationPermissionStore.getState().refresh();

export function useLocationPermission() {
  const state = useLocationPermissionStore((store) => store.state);
  const dismissedThisForeground = useLocationPermissionStore((store) => store.dismissedThisForeground);
  const refresh = useLocationPermissionStore((store) => store.refresh);
  const request = useLocationPermissionStore((store) => store.request);
  const dismiss = useLocationPermissionStore((store) => store.dismiss);

  return {
    state,
    isGranted: state === 'granted',
    dismissedThisForeground,
    refresh,
    request,
    dismiss,
  };
}

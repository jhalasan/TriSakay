import { AppState, Linking, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import { create } from 'zustand';

export type LocationPermissionState = 'unknown' | 'granted' | 'denied' | 'blocked';

interface LocationPermissionStore {
  state: LocationPermissionState;
  dismissedThisForeground: boolean;
  refresh: () => Promise<LocationPermissionState>;
  request: () => Promise<LocationPermissionState>;
  dismiss: () => void;
}

function toState(response: Location.LocationPermissionResponse): LocationPermissionState {
  if (response.granted) return 'granted';
  return response.canAskAgain ? 'denied' : 'blocked';
}

export const useLocationPermissionStore = create<LocationPermissionStore>()((set, get) => {
  let epoch = 0;

  return {
    state: 'unknown',
    dismissedThisForeground: false,

    refresh: async () => {
      const claimed = ++epoch;
      let next: LocationPermissionState;
      try {
        next = toState(await Location.getForegroundPermissionsAsync());
      } catch {
        next = 'unknown';
      }
      if (claimed === epoch) set({ state: next });
      return next;
    },

    request: async () => {
      if (get().state === 'blocked') {
        await Linking.openSettings().catch(() => {});
        return 'blocked';
      }

      let response: Location.LocationPermissionResponse;
      try {
        response = await Location.requestForegroundPermissionsAsync();
      } catch {
        return 'unknown';
      }

      const next = toState(response);
      epoch++;
      set({ state: next });
      return next;
    },

    dismiss: () => set({ dismissedThisForeground: true }),
  };
});

let wasBackgrounded = false;
AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
  if (nextAppState === 'background') {
    wasBackgrounded = true;
    return;
  }
  if (nextAppState !== 'active') return;

  void useLocationPermissionStore.getState().refresh();

  if (!wasBackgrounded) return;
  wasBackgrounded = false;
  useLocationPermissionStore.setState({ dismissedThisForeground: false });
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

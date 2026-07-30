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

export const useLocationPermissionStore = create<LocationPermissionStore>()((set, get) => {
  // Staleness guard, the same monotonic-token idiom as useAuthStore's authEpoch
  // and useConsentStore's requestEpoch: claim a token, apply the result only
  // while that token is still current.
  //
  // Both calls below are async and both write `state`, and they genuinely
  // interleave — raising the OS permission dialog drives the app
  // inactive → active, which fires the AppState listener's refresh() while
  // request() is still waiting on the user's answer. That refresh reads the
  // permission as it stands *before* the answer, so if it resolved last it
  // would overwrite request()'s 'granted' with 'denied' and re-disable every
  // location-gated control until the next foreground.
  //
  // One asymmetry from the other two stores, and it is deliberate: request()
  // claims the token when it RESOLVES rather than when it starts, so it always
  // wins. It is the only call that can change the permission, and its answer is
  // by construction newer than any read taken while the dialog was still up.
  // Claiming at start instead would invert the fix — a refresh() that began
  // after request() would outrank it and the stale read would win every time.
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
        // A read that throws must never be interpreted as granted — staying
        // 'unknown' keeps location-dependent actions disabled rather than
        // letting the user into a flow that cannot work.
        next = 'unknown';
      }
      // Superseded by a read that started later, or by a request() that has
      // since answered. Return what was read so the caller still sees it, but
      // do not publish it.
      if (claimed === epoch) set({ state: next });
      return next;
    },

    request: async () => {
      if (get().state === 'blocked') {
        // The OS will not prompt again; send the user to system Settings instead
        // of firing a request that silently resolves to denied. No token claimed
        // and nothing written: this path changes nothing itself, and must not
        // invalidate the AppState refresh that returning from Settings fires —
        // that refresh is the only thing that notices the permission was granted
        // there.
        await Linking.openSettings().catch(() => {});
        return 'blocked';
      }

      let next: LocationPermissionState;
      try {
        next = toState(await Location.requestForegroundPermissionsAsync());
      } catch {
        next = 'unknown';
      }
      epoch++;
      set({ state: next });
      return next;
    },

    dismiss: () => set({ dismissedThisForeground: true }),
  };
});

/**
 * One listener for the whole app, registered at module load — the same idiom
 * useAuthStore uses for onAuthStateChange. Re-reading on every foreground is
 * what makes a permission granted in system Settings take effect on return,
 * with no reinstall and no cold start.
 *
 * The dismissal reset is gated on having observed an actual 'background'
 * state first, not merely on "previous state wasn't active". iOS fires
 * 'inactive' for the multitasking view, Notification Center, and incoming
 * calls — none of those is a new foreground session — so gating on
 * `previousAppState !== 'active'` would clear a "Not now" dismissal on a
 * blip the user never left the app for. `refresh()` still runs on every
 * transition to 'active' regardless (cheap, idempotent, and what makes the
 * Settings round-trip work); only the dismissal reset is narrowed to a real
 * background → foreground cycle.
 */
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

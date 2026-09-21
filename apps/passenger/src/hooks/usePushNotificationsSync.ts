import { useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { registerPushToken } from '@trisakay/services';
import { useSettingsStore } from '../store/useSettingsStore';

/**
 * P6 (UAT audit): asks before the OS permission dialog fires on the very
 * first request (status 'undetermined') — the panelist's "explain why" ask,
 * done as a plain confirm rather than a full modal/store like
 * useLocationPermission's, since this hook runs silently in the background
 * on every app load rather than from a dedicated screen. Returns whether the
 * caller should still proceed to requestPermissionsAsync().
 */
function confirmBeforeFirstAsk(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Enable notifications?',
      "TriSakay uses notifications to tell you when a driver is matched, arriving, or when your fare changes.",
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Enable', onPress: () => resolve(true) },
      ],
    );
  });
}

/**
 * Registers (or clears) the signed-in user's Expo push token, driven by
 * session identity and the existing (previously inert) Settings toggle.
 *
 * Deliberately silent on every failure path — a permission denial or a
 * missing EAS `projectId` (not configured yet; see docs/PASSENGER_TODO.MD)
 * must never crash the app, same fail-open discipline as
 * useLocationPermission. This only stores the token; nothing yet sends a
 * push when a `notifications` row is inserted.
 *
 * `expo-notifications` is imported dynamically, not statically: SDK 53+
 * dropped remote push support from Expo Go, and merely evaluating the
 * package (any export) eagerly resolves its native module
 * (`ExpoPushTokenManager`), which throws at import time in Expo Go —
 * before any try/catch here would ever run. The executionEnvironment
 * check below skips the import entirely in that case.
 */
export function usePushNotificationsSync(sessionUserId: string | null) {
  const pushNotificationsEnabled = useSettingsStore((state) => state.pushNotificationsEnabled);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (sessionUserId === null) return;
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return;

    if (!pushNotificationsEnabled) {
      void registerPushToken(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const Notifications = await import('expo-notifications');
        const existing = await Notifications.getPermissionsAsync();
        let granted = existing.granted;
        if (!granted) {
          if (existing.status === 'undetermined') {
            const wantsToEnable = await confirmBeforeFirstAsk();
            if (!wantsToEnable || cancelled) return;
          }
          const requested = await Notifications.requestPermissionsAsync();
          granted = requested.granted;
        }
        if (!granted || cancelled) return;

        const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
        if (!projectId) return;

        const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
        if (cancelled) return;

        await registerPushToken(token);
      } catch {
        // Offline, permission dialog dismissed, or the push service
        // unreachable — never surface this as an app-level error.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionUserId, pushNotificationsEnabled]);
}

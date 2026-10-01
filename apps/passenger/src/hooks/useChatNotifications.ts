import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { isPastSplash, waitUntil } from '@trisakay/shared';

/**
 * C1 — the three pieces of push plumbing that never existed in this app
 * before chat needed them: an Android notification channel (everything
 * before this used the OS default), a foreground handler (without one, a
 * notification arriving while the app is open is silently dropped instead
 * of shown), and tap-to-open routing (data payloads were sent but nothing
 * ever read them back). Scoped to what chat needs, not a general
 * notification-system rebuild — see the plan's own note on this.
 *
 * Voice calls (C2) also use this hook: it registers the `calls` Android channel, suppresses the banner for an
 * incoming-call push while the app is open (the answer screen opens instead), and routes a tapped call push.
 *
 * Same dynamic-import/Expo-Go guard as usePushNotificationsSync, for the
 * same reason: merely evaluating expo-notifications throws in Expo Go.
 */
export function useChatNotifications() {
  const router = useRouter();
  // Read by the notification handler below, which is registered once: while the
  // user is on the chat or the ride screen the app already shows the message
  // itself (live thread / preview banner), so a system banner would only duplicate it.
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return;

    let cancelled = false;
    let subscription: { remove: () => void } | null = null;

    (async () => {
      try {
        const Notifications = await import('expo-notifications');
        if (cancelled) return;

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('messages', {
            name: 'Messages',
            importance: Notifications.AndroidImportance.HIGH,
            sound: 'default',
          });
          await Notifications.setNotificationChannelAsync('calls', {
            name: 'Calls',
            importance: Notifications.AndroidImportance.MAX,
            sound: 'default',
            vibrationPattern: [0, 600, 400, 600, 400, 600],
          });
        }

        Notifications.setNotificationHandler({
          handleNotification: async (notification) => {
            const data = notification.request.content.data as Record<string, unknown> | undefined;
            const path = pathnameRef.current ?? '';
            const alreadyVisible =
              (data?.type === 'chat_message' && (path.startsWith('/booking/chat') || path.startsWith('/booking/trip'))) ||
              data?.type === 'incoming_call';
            return {
              shouldShowBanner: !alreadyVisible,
              shouldShowList: !alreadyVisible,
              shouldPlaySound: !alreadyVisible,
              shouldSetBadge: false,
            };
          },
        });

        function routeFromData(data: Record<string, unknown> | undefined) {
          if (!data) return;
          if (data.type === 'incoming_call' && typeof data.callId === 'string') {
            const route = { pathname: '/booking/call', params: { callId: data.callId } } as const;
            // A cold-start tap must wait for splash to finish, or splash's redirect replaces the call screen.
            void waitUntil(() => isPastSplash(pathnameRef.current)).then((ready) => {
              if (ready) router.navigate(route);
            });
            return;
          }
          if (data.type !== 'chat_message') return;
          router.push('/booking/chat');
        }

        const last = await Notifications.getLastNotificationResponse();
        if (!cancelled && last) routeFromData(last.notification.request.content.data as Record<string, unknown>);
        if (cancelled) return;

        subscription = Notifications.addNotificationResponseReceivedListener((response) => {
          routeFromData(response.notification.request.content.data as Record<string, unknown>);
        });
      } catch {
        // Same fail-open discipline as usePushNotificationsSync — a missing
        // permission or an unreachable push service must never crash the app.
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

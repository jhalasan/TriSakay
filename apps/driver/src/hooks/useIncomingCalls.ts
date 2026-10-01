import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { subscribeToMyCalls } from '@trisakay/services';
import { isPastSplash, waitUntil } from '@trisakay/shared';

type Route = Parameters<ReturnType<typeof useRouter>['navigate']>[0];

/** A ring older than this is not worth interrupting the screen for (the ring window is 30 seconds). */
const MAX_AGE_SECONDS = 35;

/**
 * "Someone is calling you": watches this user's calls while the app is open and, for each new ringing call
 * addressed to them, opens the answer screen. `router.navigate` (not `push`) so a notification tap that routes to
 * the same call screen does not stack a second copy.
 */
export function useIncomingCalls(userId: string | null, callRoute: (callId: string) => Route) {
  const router = useRouter();
  const handled = useRef(new Set<string>());
  const routeRef = useRef(callRoute);
  routeRef.current = callRoute;
  // A call found while the app is still starting up (a cold start from a notification tap) waits for splash to finish,
  // otherwise splash's own redirect replaces the call screen and the call is declined as the screen unmounts.
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    if (!userId) return;
    return subscribeToMyCalls(userId, (calls) => {
      for (const call of calls) {
        if (call.isCaller || call.status !== 'ringing' || call.ageSeconds > MAX_AGE_SECONDS) continue;
        if (handled.current.has(call.id)) continue;
        handled.current.add(call.id);
        const route = routeRef.current(call.id);
        void waitUntil(() => isPastSplash(pathRef.current)).then((ready) => {
          if (ready) router.navigate(route);
        });
      }
    });
  }, [userId, router]);
}

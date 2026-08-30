import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import { pushDriverLocation } from '@trisakay/services/src/location/index.ts';

const DISTANCE_INTERVAL_METERS = 30;
const TIME_INTERVAL_MS = 8000;

/**
 * Keeps driver_profiles.current_lat/current_lng fresh while the driver is
 * available AND the app is foregrounded — no background-location permission
 * or task is used anywhere (see the feature's design doc, Decision 1). The
 * matching heuristic and any passenger watching this driver both read the
 * same column this writes to.
 */
export function useDriverLocationSync(sessionUserId: string | null, isAvailable: boolean): void {
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (subscriptionRef.current) return;
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      subscriptionRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: DISTANCE_INTERVAL_METERS, timeInterval: TIME_INTERVAL_MS },
        (position) => {
          void pushDriverLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        }
      );
    }

    function stop() {
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    }

    function shouldRun() {
      return sessionUserId !== null && isAvailable && appStateRef.current === 'active';
    }

    if (shouldRun()) {
      void start();
    } else {
      stop();
    }

    const appStateSubscription = AppState.addEventListener('change', (next) => {
      appStateRef.current = next;
      if (shouldRun()) {
        void start();
      } else {
        stop();
      }
    });

    return () => {
      cancelled = true;
      stop();
      appStateSubscription.remove();
    };
  }, [sessionUserId, isAvailable]);
}

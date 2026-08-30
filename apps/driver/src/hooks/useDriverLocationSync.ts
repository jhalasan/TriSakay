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
  // Bumped by every start()/stop() call. A start() call captures the
  // generation in force when it begins and re-checks it after each await —
  // if a later start()/stop() has since begun, this call's result is stale
  // and must be discarded (removed, not stored) rather than racing the ref.
  const generationRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (subscriptionRef.current) return;
      const myGeneration = ++generationRef.current;

      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled || myGeneration !== generationRef.current) return;

      const subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: DISTANCE_INTERVAL_METERS, timeInterval: TIME_INTERVAL_MS },
        (position) => {
          void pushDriverLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        }
      );

      if (cancelled || myGeneration !== generationRef.current) {
        subscription.remove();
        return;
      }
      subscriptionRef.current = subscription;
    }

    function stop() {
      generationRef.current += 1;
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

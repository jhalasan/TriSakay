import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import { haversineKm } from '@trisakay/shared';
import { pushDriverLocation } from '@trisakay/services/src/location/index.ts';
import { useDriverStore } from '../store/useDriverStore';
import { heartbeatDelayMs, shouldSendHeartbeat } from '../utils/locationHeartbeat';

const DISTANCE_INTERVAL_METERS = 30;
const TIME_INTERVAL_MS = 8000;
// During a trip the in-app navigation follows the driver along the road, so the
// phone wants fixes far more often than the server does. Local updates use this
// tighter cadence; the write to the database stays at the cadence above.
const TRIP_DISTANCE_INTERVAL_METERS = 8;
const TRIP_TIME_INTERVAL_MS = 2000;
/** Below this speed (m/s) the GPS heading is noise, so the last real heading is kept. */
const MIN_HEADING_SPEED_MS = 1;

/**
 * Keeps driver_profiles.current_lat/current_lng fresh while the driver is
 * available AND the app is foregrounded — no background-location permission
 * or task is used anywhere (see the feature's design doc, Decision 1). The
 * matching heuristic and any passenger watching this driver both read the
 * same column this writes to.
 */
export function useDriverLocationSync(
  sessionUserId: string | null,
  isAvailable: boolean,
  locationTrackingEnabled: boolean,
  hasActiveTrip = false,
): void {
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  // Bumped by every start()/stop() call. A start() call captures the
  // generation in force when it begins and re-checks it after each await —
  // if a later start()/stop() has since begun, this call's result is stale
  // and must be discarded (removed, not stored) rather than racing the ref.
  const generationRef = useRef(0);
  const lastPushRef = useRef<{ at: number; lat: number; lng: number } | null>(null);
  const lastMovementRef = useRef(Date.now());
  const heartbeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    function stopHeartbeat() {
      if (heartbeatTimerRef.current) clearTimeout(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }

    /**
     * A parked driver gets no movement updates, so re-send the position on a
     * timer to keep it inside the server's 2 minute freshness window. Movement
     * updates already refresh it, so a heartbeat is skipped when one just did.
     */
    function scheduleHeartbeat(myGeneration: number) {
      stopHeartbeat();
      heartbeatTimerRef.current = setTimeout(async () => {
        if (cancelled || myGeneration !== generationRef.current) return;
        const now = Date.now();
        const last = lastPushRef.current;
        if (shouldSendHeartbeat(last ? now - last.at : Infinity, now - lastMovementRef.current)) {
          // A fresh fix when the phone can give one quickly, otherwise the last known spot.
          let fix: { lat: number; lng: number; mocked?: boolean } | null = last ? { lat: last.lat, lng: last.lng } : null;
          try {
            const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            fix = { lat: position.coords.latitude, lng: position.coords.longitude, mocked: position.mocked };
          } catch {
            // keep the fallback above
          }
          if (cancelled || myGeneration !== generationRef.current) return;
          if (fix) {
            lastPushRef.current = { at: Date.now(), lat: fix.lat, lng: fix.lng };
            void pushDriverLocation(fix);
          }
        }
        scheduleHeartbeat(myGeneration);
      }, heartbeatDelayMs(Date.now() - lastMovementRef.current));
    }

    async function start() {
      if (subscriptionRef.current) return;
      const myGeneration = ++generationRef.current;

      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled || myGeneration !== generationRef.current) return;

      const subscription = await Location.watchPositionAsync(
        hasActiveTrip
          ? { accuracy: Location.Accuracy.High, distanceInterval: TRIP_DISTANCE_INTERVAL_METERS, timeInterval: TRIP_TIME_INTERVAL_MS }
          : { accuracy: Location.Accuracy.Balanced, distanceInterval: DISTANCE_INTERVAL_METERS, timeInterval: TIME_INTERVAL_MS },
        (position) => {
          const { latitude, longitude, heading, speed } = position.coords;
          // Server writes keep the original cadence however often the phone reports.
          const last = lastPushRef.current;
          const now = Date.now();
          const movedM = last ? haversineKm(last.lat, last.lng, latitude, longitude) * 1000 : Infinity;
          if (!last || now - last.at >= TIME_INTERVAL_MS || movedM >= DISTANCE_INTERVAL_METERS) {
            if (movedM >= DISTANCE_INTERVAL_METERS) lastMovementRef.current = now;
            lastPushRef.current = { at: now, lat: latitude, lng: longitude };
            void pushDriverLocation({ lat: latitude, lng: longitude, mocked: position.mocked });
          }
          // P1-14 (2026-09-15 launch audit): plain-data mirror for the
          // active-trip map's marker/route/recenter — see useDriverStore.
          const movingHeading =
            typeof heading === 'number' && heading >= 0 && (speed ?? 0) >= MIN_HEADING_SPEED_MS ? heading : null;
          useDriverStore.getState().setCurrentPosition(latitude, longitude, movingHeading);
        }
      );

      if (cancelled || myGeneration !== generationRef.current) {
        subscription.remove();
        return;
      }
      subscriptionRef.current = subscription;
      lastMovementRef.current = Date.now();
      scheduleHeartbeat(myGeneration);
    }

    function stop() {
      generationRef.current += 1;
      stopHeartbeat();
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    }

    function shouldRun() {
      return sessionUserId !== null && isAvailable && locationTrackingEnabled && appStateRef.current === 'active';
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
  }, [sessionUserId, isAvailable, locationTrackingEnabled, hasActiveTrip]);
}

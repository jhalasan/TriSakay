import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { getActiveRideForPassenger, getTripDriverInfo } from '@trisakay/services';
import { BrandMotif, GradientSurface } from '@trisakay/ui';
import { useAuthStore } from '../src/store/useAuthStore';
import { useBookingStore } from '../src/store/useBookingStore';
import { useConsentStore, type ConsentGateStatus } from '../src/store/useConsentStore';
import { wait } from '../src/mocks/delay';
import { styles } from '../src/styles/splash.styles';
import { WALKTHROUGH_SEEN_KEY } from '../src/constants/walkthrough';

/**
 * Re-hydrates useBookingStore from the passenger's own most recent
 * `pending`/`assigned` ride request, if any, and returns where to send them.
 * Without this, useBookingStore always boots empty — a passenger whose app
 * restarted mid-ride would land on Home with a clean slate and could start
 * an entirely new booking while the backend still has their old one active
 * and a driver who thinks they still have this passenger.
 *
 * Deliberately stops at 'assigned' — a 'completed' ride's payment/rating
 * recovery is a separate, already-tracked gap (both are still mock/local on
 * those screens), not something re-hydrating the booking store can fix.
 */
async function resolveActiveRideRoute(passengerId: string): Promise<'/booking/trip' | '/booking/finding-driver' | null> {
  const { data } = await getActiveRideForPassenger(passengerId).catch(() => ({ data: null }));
  if (!data) return null;

  useBookingStore.setState({
    rideRequestId: data.id,
    pickup: {
      label: data.pickupLabel ?? 'Pickup',
      address: data.pickupLabel ?? 'Pickup',
      latitude: data.pickupLat,
      longitude: data.pickupLng,
    },
    dropoff: {
      label: data.destLabel ?? 'Drop-off',
      address: data.destLabel ?? 'Drop-off',
      latitude: data.destLat,
      longitude: data.destLng,
    },
    seats: data.seats,
    fare: data.estimatedFare,
    paymentMethod: data.preferredMethod,
  });

  if (data.status !== 'assigned') {
    useBookingStore.setState({ tripStatus: 'searching' });
    return '/booking/finding-driver';
  }

  const { data: driverInfo } = await getTripDriverInfo(data.id).catch(() => ({ data: null }));
  useBookingStore.setState({
    driver: {
      id: driverInfo?.driverId ?? '',
      name: driverInfo?.driverName ?? '',
      plateNumber: driverInfo?.plateNo ?? '',
      rating: driverInfo?.ratingAvg ?? null,
      etaMinutes: null,
    },
    tripStatus: 'matched',
  });
  return '/booking/trip';
}

function waitUntilHydrated(): Promise<void> {
  if (!useAuthStore.getState().isHydrating) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = useAuthStore.subscribe((state) => {
      if (!state.isHydrating) {
        unsubscribe();
        resolve();
      }
    });
  });
}

/**
 * Resolves once consent is known, or as soon as the session goes away.
 *
 * The second exit is not optional. A check in flight is abandoned if the
 * session it was started for is replaced or lost (useConsentStore drops
 * superseded results, and useConsentSync's reset() puts the status back to
 * 'unknown'), so waiting on a settled status alone would wait for a result
 * that is never coming — with useProtectedRoute disabled on this segment,
 * that is a permanent hang on the splash screen. Losing the session is the
 * only way an in-flight check is abandoned without another one replacing it,
 * so watching for it covers the whole failure mode; every other path settles
 * within the store's own request timeout.
 *
 * Kicks off the check itself when nothing has started one — the root layout
 * normally does, but splash must not depend on that ordering.
 */
function waitUntilConsentResolved(): Promise<ConsentGateStatus> {
  const isSettled = (status: ConsentGateStatus) => status === 'accepted' || status === 'required';
  const hasSession = () => useAuthStore.getState().sessionUserId !== null;

  const current = useConsentStore.getState().status;
  if (isSettled(current) || !hasSession()) return Promise.resolve(current);
  if (current === 'unknown') void useConsentStore.getState().check();

  return new Promise((resolve) => {
    let done = false;
    const settle = (status: ConsentGateStatus) => {
      if (done) return;
      done = true;
      unsubscribeConsent();
      unsubscribeAuth();
      resolve(status);
    };

    const unsubscribeConsent = useConsentStore.subscribe((state) => {
      if (isSettled(state.status)) settle(state.status);
    });
    const unsubscribeAuth = useAuthStore.subscribe((state) => {
      if (state.sessionUserId === null) settle(useConsentStore.getState().status);
    });
  });
}

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await Promise.all([wait(1400), waitUntilHydrated()]);
      if (cancelled) return;

      if (!useAuthStore.getState().isAuthenticated) {
        const walkthroughSeen = await AsyncStorage.getItem(WALKTHROUGH_SEEN_KEY).catch(() => null);
        router.replace(walkthroughSeen ? '/(auth)/login' : '/walkthrough');
        return;
      }

      const consentStatus = await waitUntilConsentResolved();
      if (cancelled) return;

      // Re-read auth: the wait above also returns when the session drops (an
      // expired refresh token surfacing mid-check), and a consent verdict is
      // meaningless once there is nobody to apply it to.
      const sessionUserId = useAuthStore.getState().sessionUserId;
      if (!useAuthStore.getState().isAuthenticated || !sessionUserId) {
        router.replace('/(auth)/login');
        return;
      }

      if (consentStatus !== 'accepted') {
        router.replace('/consent');
        return;
      }

      const activeRideRoute = await resolveActiveRideRoute(sessionUserId);
      if (cancelled) return;

      router.replace(activeRideRoute ?? '/(tabs)/home');
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <GradientSurface token="hero" direction="vertical" style={styles.gradient}>
      <View style={styles.container}>
        <BrandMotif size={360} color="#FFFFFF" opacity={0.08} style={styles.motif} />
        <View style={styles.badge}>
          <Image
            source={require('../../../assets/brand/trisakay-lockup.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="TriSakay"
          />
        </View>
        <Text style={styles.subtitle}>Book a tricycle, hassle-free</Text>
        <ActivityIndicator color="#FFFFFF" style={styles.loader} />
      </View>
    </GradientSurface>
  );
}

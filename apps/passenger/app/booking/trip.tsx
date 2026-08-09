import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Animated, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { subscribeToRideRequestStatus } from '@trisakay/services';
import { Badge, Button, EmptyState, GradientSurface, OsmMap, motion, spacing } from '@trisakay/ui';
import { DriverInfoCard } from '../../src/components/DriverInfoCard';
import { useBookingStore } from '../../src/store/useBookingStore';
import { styles } from '../../src/styles/booking/trip.styles';

export default function TripScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const driver = useBookingStore((state) => state.driver);
  const pickup = useBookingStore((state) => state.pickup);
  const rideRequestId = useBookingStore((state) => state.rideRequestId);
  const setTripStatus = useBookingStore((state) => state.setTripStatus);
  const reset = useBookingStore((state) => state.reset);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  // Same exit-guard pattern as finding-driver.tsx: reset() clears
  // rideRequestId, which would otherwise re-fire this effect a second time
  // before the component finishes unmounting from the first navigate-away.
  const hasExitedRef = useRef(false);

  /** Same settle-in entrance used when this screen previously arrived from finding-driver. */
  const settle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(settle, {
      toValue: 1,
      duration: motion.duration.settle,
      easing: motion.easing.out,
      useNativeDriver: true,
    }).start();
  }, [settle]);

  useEffect(() => {
    if (hasExitedRef.current) return;

    if (!rideRequestId) {
      hasExitedRef.current = true;
      reset();
      router.replace('/(tabs)/home');
      return;
    }

    let cancelled = false;

    const unsubscribe = subscribeToRideRequestStatus(
      rideRequestId,
      (row) => {
        if (cancelled || hasExitedRef.current) return;
        if (row.status === 'completed') {
          hasExitedRef.current = true;
          setTripStatus('awaiting_payment');
          router.replace('/booking/payment');
        } else if (row.status === 'cancelled') {
          hasExitedRef.current = true;
          reset();
          router.replace('/(tabs)/home');
        }
      },
      (message) => {
        if (!cancelled) setSubscriptionError(message);
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideRequestId]);

  if (!driver) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyWrap}>
          <EmptyState title="No driver matched" message="Try requesting a ride again." />
          <Button label="Back to Home" onPress={() => router.replace('/(tabs)/home')} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapFill}>
        <OsmMap
          variant="route"
          caption="Map · trip route"
          height="100%"
          latitude={pickup?.latitude}
          longitude={pickup?.longitude}
          zoom={15}
          interactive
          edgeToEdge
        />
      </View>

      <View style={styles.statusBadgeWrap}>
        <Badge label="Driver assigned" tone="blue" dot />
      </View>

      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: spacing.xl + insets.bottom },
          {
            opacity: settle,
            transform: [
              { translateY: settle.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
            ],
          },
        ]}
      >
        <GradientSurface token="brand" direction="diagonal" style={styles.sheetAccent} />
        <DriverInfoCard driver={driver} />
        {subscriptionError && <Text style={styles.error}>{subscriptionError}</Text>}
        <Text style={styles.caption}>No in-app call or message — coordination is in person.</Text>
      </Animated.View>
    </View>
  );
}

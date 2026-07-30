import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { Animated, Text, View } from 'react-native';
import { Button, EmptyState, OsmMap, motion } from '@trisakay/ui';
import { DriverInfoCard } from '../../src/components/DriverInfoCard';
import { useBookingStore } from '../../src/store/useBookingStore';
import { randomBetween, wait } from '../../src/mocks/delay';
import { styles } from '../../src/styles/booking/driver-found.styles';

export default function DriverFoundScreen() {
  const router = useRouter();
  const driver = useBookingStore((state) => state.driver);
  const pickup = useBookingStore((state) => state.pickup);
  const setTripStatus = useBookingStore((state) => state.setTripStatus);
  const reset = useBookingStore((state) => state.reset);

  /** Second half of the ride-status moment: the match settles in from below. */
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
    let cancelled = false;

    (async () => {
      await wait(randomBetween(4000, 6000));
      if (cancelled) return;
      setTripStatus('in_progress');
      router.replace('/booking/trip-in-progress');
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCancel() {
    reset();
    router.replace('/(tabs)/home');
  }

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
      <View style={styles.mapWrap}>
        <OsmMap
          variant="route"
          caption="Map · driver en route"
          height="100%"
          latitude={pickup?.latitude}
          longitude={pickup?.longitude}
          zoom={15}
          interactive
        />
      </View>

      <Animated.View
        style={[
          styles.sheet,
          {
            opacity: settle,
            transform: [
              { translateY: settle.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
            ],
          },
        ]}
      >
        <DriverInfoCard driver={driver} />
        <Button label="Cancel ride" variant="outline" tone="neutral" fullWidth onPress={handleCancel} />
        <Text style={styles.caption}>No in-app call or message — coordination is in person.</Text>
      </Animated.View>
    </View>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, MapSearchBar, OsmMap, colors } from '@trisakay/ui';
import { LOCATION_REQUIRED_HINT, LocationRequiredNotice } from '../../src/components/LocationRequiredNotice';
import { useLocationPermission } from '../../src/hooks/useLocationPermission';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useBookingStore } from '../../src/store/useBookingStore';
import { reverseGeocode } from '../../src/utils/geocode';
import { styles } from '../../src/styles/booking/request.styles';

export default function RequestTricycleScreen() {
  const router = useRouter();
  const pickup = useBookingStore((state) => state.pickup);
  const setPickup = useBookingStore((state) => state.setPickup);
  const t = useTranslation();
  const { isGranted } = useLocationPermission();
  const [locating, setLocating] = useState(false);
  // Guards against firing a second GPS fix while one is in flight (e.g. a
  // fast remount from tab-switching) — a duplicate fix would race the first
  // and could overwrite a pin the rider has since dragged.
  const hasRequestedFix = useRef(false);

  useEffect(() => {
    if (!isGranted || pickup || hasRequestedFix.current) return;
    hasRequestedFix.current = true;
    setLocating(true);
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then((position) =>
        reverseGeocode(position.coords.latitude, position.coords.longitude),
      )
      .then((point) => setPickup(point))
      .catch(() => {
        // No GPS fix available — the rider can still drop the pin by hand
        // once the map renders at its default center.
      })
      .finally(() => setLocating(false));
  }, [isGranted, pickup, setPickup]);

  function handlePickupDrag(point: { latitude: number; longitude: number }) {
    setLocating(true);
    reverseGeocode(point.latitude, point.longitude)
      .then((resolved) => setPickup(resolved))
      .finally(() => setLocating(false));
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.mapFill}>
        <OsmMap
          variant="pin"
          caption={locating ? t.home.findingLocation : t.home.dragPinToSetPickup}
          height="100%"
          latitude={pickup?.latitude}
          longitude={pickup?.longitude}
          zoom={16}
          interactive
          edgeToEdge
          marker={pickup ? { latitude: pickup.latitude, longitude: pickup.longitude, draggable: true } : null}
          onMarkerMove={handlePickupDrag}
        />
      </View>

      <View style={styles.topFloating}>
        <Card variant="raised" style={styles.headerCard}>
          <View style={styles.headerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={8}
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="chevron-back" size={22} color={colors.accentBluePressed} />
            </Pressable>
            <Text style={styles.headerTitle}>{t.home.ctaTitle}</Text>
          </View>
          <View style={styles.pickupDivider} />
          <MapSearchBar
            variant="flat"
            label={t.home.whereTo}
            disabled={!isGranted}
            onPress={() => (isGranted ? router.push('/booking/set-destination') : router.push('/location-permission'))}
            accessibilityHint={isGranted ? undefined : LOCATION_REQUIRED_HINT}
          />
          <View style={styles.pickupDivider} />
          <MapSearchBar
            variant="flat"
            label={pickup?.label || t.home.pickupFallback}
            disabled={!isGranted}
            onPress={() => (isGranted ? router.push('/booking/set-pickup') : router.push('/location-permission'))}
            accessibilityHint={t.home.pickupAccessibilityLabel}
          />
        </Card>
        {!isGranted && <LocationRequiredNotice />}
      </View>
    </SafeAreaView>
  );
}

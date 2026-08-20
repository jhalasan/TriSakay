import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, MapSearchBar, OsmMap, colors, spacing } from '@trisakay/ui';
import { LOCATION_REQUIRED_HINT, LocationRequiredNotice } from '../../src/components/LocationRequiredNotice';
import { useLocationPermission } from '../../src/hooks/useLocationPermission';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useBookingStore } from '../../src/store/useBookingStore';
import { reverseGeocode } from '../../src/utils/geocode';
import { styles } from '../../src/styles/booking/request.styles';

export default function RequestTricycleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pickup = useBookingStore((state) => state.pickup);
  const setPickup = useBookingStore((state) => state.setPickup);
  const dropoff = useBookingStore((state) => state.dropoff);
  const resetBooking = useBookingStore((state) => state.reset);
  const t = useTranslation();
  const { isGranted } = useLocationPermission();
  const [locating, setLocating] = useState(false);
  // Surfaced only for a manual retap of the target button — the silent
  // mount-time auto-fetch stays silent (the rider can still drop a pin by
  // hand), but a button the rider explicitly pressed must show a result.
  const [locationError, setLocationError] = useState(false);
  // Guards against firing a second GPS fix while one is in flight (e.g. a
  // fast remount from tab-switching) — a duplicate fix would race the first
  // and could overwrite a pin the rider has since dragged.
  const hasRequestedFix = useRef(false);

  function useCurrentLocationForPickup(surfaceErrors: boolean) {
    setLocating(true);
    setLocationError(false);
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then((position) =>
        reverseGeocode(position.coords.latitude, position.coords.longitude),
      )
      .then((point) => setPickup(point))
      .catch(() => {
        // No GPS fix available — the rider can still drop the pin by hand
        // once the map renders at its default center.
        if (surfaceErrors) setLocationError(true);
      })
      .finally(() => setLocating(false));
  }

  useEffect(() => {
    if (!isGranted || pickup || hasRequestedFix.current) return;
    hasRequestedFix.current = true;
    useCurrentLocationForPickup(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGranted, pickup]);

  function handlePickupDrag(point: { latitude: number; longitude: number }) {
    setLocating(true);
    reverseGeocode(point.latitude, point.longitude)
      .then((resolved) => setPickup(resolved))
      .finally(() => setLocating(false));
  }

  // Leaving this screen without tapping "Confirm ride" abandons the booking
  // draft — without this, a stale pickup/destination from a trip the rider
  // never requested would still be sitting there the next time they open
  // Request a Tricycle.
  function handleBack() {
    resetBooking();
    router.back();
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
              onPress={handleBack}
            >
              <Ionicons name="chevron-back" size={22} color={colors.accentBluePressed} />
            </Pressable>
            <Text style={styles.headerTitle}>{t.home.ctaTitle}</Text>
          </View>
          <View style={styles.pickupDivider} />
          <MapSearchBar
            variant="flat"
            label={pickup?.label || t.home.pickupFallback}
            icon={<Ionicons name="radio-button-on" size={16} color={colors.accentGreen} />}
            disabled={!isGranted}
            onPress={() => (isGranted ? router.push('/booking/set-pickup') : router.push('/location-permission'))}
            accessibilityHint={t.home.pickupAccessibilityLabel}
            trailing={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.setPickup.useCurrentLocation}
                hitSlop={8}
                disabled={!isGranted || locating}
                style={styles.currentLocationButton}
                onPress={() => useCurrentLocationForPickup(true)}
              >
                {locating ? (
                  <ActivityIndicator size="small" color={colors.accentGreen} />
                ) : (
                  <Ionicons name="locate" size={18} color={colors.accentGreen} />
                )}
              </Pressable>
            }
          />
          <View style={styles.pickupDivider} />
          <MapSearchBar
            variant="flat"
            label={dropoff?.label || t.home.whereTo}
            icon={<Ionicons name="location" size={18} color={colors.accentBlue} />}
            disabled={!isGranted}
            onPress={() => (isGranted ? router.push('/booking/set-destination') : router.push('/location-permission'))}
            accessibilityHint={isGranted ? undefined : LOCATION_REQUIRED_HINT}
          />
          {locationError && <Text style={styles.locationErrorText}>{t.home.locationErrorMessage}</Text>}
        </Card>
        {!isGranted && <LocationRequiredNotice />}
      </View>

      <View style={[styles.bottomFloating, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Button
          label={t.home.confirmRideButton}
          fullWidth
          disabled={!pickup || !dropoff}
          onPress={() => router.push('/booking/confirm')}
        />
      </View>
    </SafeAreaView>
  );
}

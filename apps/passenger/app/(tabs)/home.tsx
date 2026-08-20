import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Card, EmptyState, MapOverlaySheet, MapSearchBar, OsmMap, colors } from '@trisakay/ui';
import { LOCATION_REQUIRED_HINT, LocationRequiredNotice } from '../../src/components/LocationRequiredNotice';
import { useLocationPermission } from '../../src/hooks/useLocationPermission';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useBookingStore } from '../../src/store/useBookingStore';
import { useNotificationsStore } from '../../src/store/useNotificationsStore';
import { reverseGeocode } from '../../src/utils/geocode';
import type { LocationPoint } from '../../src/types/booking';
import { styles } from '../../src/styles/tabs/home.styles';

/** Saved places come from the rider's account. Empty until the backend lands. */
const SHORTCUTS: { icon: keyof typeof Ionicons.glyphMap; point: LocationPoint }[] = [];

function getGreeting(t: ReturnType<typeof useTranslation>) {
  const hour = new Date().getHours();
  if (hour < 12) return t.home.greetingMorning;
  if (hour < 18) return t.home.greetingAfternoon;
  return t.home.greetingEvening;
}

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const pickup = useBookingStore((state) => state.pickup);
  const setPickup = useBookingStore((state) => state.setPickup);
  const setDropoff = useBookingStore((state) => state.setDropoff);
  const unreadCount = useNotificationsStore((state) => state.items.filter((n) => !n.read).length);
  const t = useTranslation();
  const { isGranted } = useLocationPermission();
  const insets = useSafeAreaInsets();
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

  function handleShortcutPress(point: LocationPoint) {
    setDropoff(point);
    router.push('/booking/confirm');
  }

  function handlePickupDrag(point: { latitude: number; longitude: number }) {
    setLocating(true);
    reverseGeocode(point.latitude, point.longitude)
      .then((resolved) => setPickup(resolved))
      .finally(() => setLocating(false));
  }

  const firstName = user?.name?.trim().split(/\s+/)[0];
  const greeting = firstName ? `${getGreeting(t)}, ${firstName}` : getGreeting(t);

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
          <Text style={styles.greeting}>{greeting}</Text>
          <View style={styles.headerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.home.profileAccessibilityLabel}
              onPress={() => router.push('/(tabs)/profile')}
            >
              <View style={styles.avatarRing}>
                <Avatar name={user?.name} source={user?.avatarUrl ? { uri: user.avatarUrl } : undefined} size="md" />
              </View>
            </Pressable>
            <MapSearchBar
              variant="flat"
              style={styles.headerSearchBar}
              label={t.home.whereTo}
              disabled={!isGranted}
              onPress={() => (isGranted ? router.push('/booking/set-destination') : router.push('/location-permission'))}
              accessibilityHint={isGranted ? undefined : LOCATION_REQUIRED_HINT}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.home.notificationsAccessibilityLabel}
              style={styles.bellButton}
              onPress={() => router.push('/notifications')}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.accentBluePressed} />
              {unreadCount > 0 && <View style={styles.bellDot} />}
            </Pressable>
          </View>
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

      <MapOverlaySheet maxHeight={320} bottomInset={insets.bottom}>
        <Text style={styles.sectionLabel}>{t.home.savedPlaces}</Text>
        {SHORTCUTS.length === 0 ? (
          <EmptyState
            title={t.home.noSavedPlacesTitle}
            message={t.home.noSavedPlacesMessage}
          />
        ) : (
          <ScrollView contentContainerStyle={styles.shortcuts}>
            {SHORTCUTS.map((shortcut) => (
              <Pressable
                key={shortcut.point.label}
                style={styles.shortcutRow}
                onPress={() => handleShortcutPress(shortcut.point)}
                accessibilityRole="button"
              >
                <View style={styles.shortcutIcon}>
                  <Ionicons name={shortcut.icon} size={20} color={colors.accentBluePressed} />
                </View>
                <View style={styles.shortcutTextSlot}>
                  <Text style={styles.shortcutLabel}>{shortcut.point.label}</Text>
                  <Text style={styles.shortcutAddress} numberOfLines={1}>
                    {shortcut.point.address}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
              </Pressable>
            ))}
          </ScrollView>
        )}
      </MapOverlaySheet>
    </SafeAreaView>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Card, EmptyState, MapOverlaySheet, MapSearchBar, OsmMap, colors } from '@trisakay/ui';
import { LOCATION_REQUIRED_HINT, LocationRequiredNotice } from '../../src/components/LocationRequiredNotice';
import { useLocationPermission } from '../../src/hooks/useLocationPermission';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useBookingStore } from '../../src/store/useBookingStore';
import { useNotificationsStore } from '../../src/store/useNotificationsStore';
import { reverseGeocode } from '../../src/utils/geocode';
import type { LocationPoint } from '../../src/types/booking';
import { styles } from '../../src/styles/tabs/home.styles';

/** Saved places come from the rider's account. Empty until the backend lands. */
const SHORTCUTS: { icon: keyof typeof Ionicons.glyphMap; point: LocationPoint }[] = [];

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const pickup = useBookingStore((state) => state.pickup);
  const setPickup = useBookingStore((state) => state.setPickup);
  const setDropoff = useBookingStore((state) => state.setDropoff);
  const unreadCount = useNotificationsStore((state) => state.items.filter((n) => !n.read).length);
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.mapFill}>
        <OsmMap
          variant="pin"
          caption={locating ? 'Finding your location…' : 'Drag the pin to set pickup'}
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
              accessibilityLabel="Profile"
              onPress={() => router.push('/(tabs)/profile')}
            >
              <Avatar name={user?.name} source={user?.avatarUrl ? { uri: user.avatarUrl } : undefined} size="md" />
            </Pressable>
            <MapSearchBar
              variant="flat"
              style={styles.headerSearchBar}
              label="Where to?"
              disabled={!isGranted}
              onPress={() => (isGranted ? router.push('/booking/set-destination') : router.push('/location-permission'))}
              accessibilityHint={isGranted ? undefined : LOCATION_REQUIRED_HINT}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              style={styles.bellButton}
              onPress={() => router.push('/notifications')}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.ink} />
              {unreadCount > 0 && <View style={styles.bellDot} />}
            </Pressable>
          </View>
        </Card>
        {!isGranted && <LocationRequiredNotice />}
      </View>

      <MapOverlaySheet maxHeight={320} bottomInset={insets.bottom}>
        <Text style={styles.sectionLabel}>Saved places</Text>
        {SHORTCUTS.length === 0 ? (
          <EmptyState
            title="No saved places yet"
            message="Places you save will appear here for one-tap booking."
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

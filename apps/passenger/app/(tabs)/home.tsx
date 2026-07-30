import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, EmptyState, OsmMap, colors } from '@trisakay/ui';
import { LOCATION_REQUIRED_HINT, LocationRequiredNotice } from '../../src/components/LocationRequiredNotice';
import { useLocationPermission } from '../../src/hooks/useLocationPermission';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useBookingStore } from '../../src/store/useBookingStore';
import { useNotificationsStore } from '../../src/store/useNotificationsStore';
import type { LocationPoint } from '../../src/types/booking';
import { styles } from './home.styles';

/** Saved places come from the rider's account. Empty until the backend lands. */
const SHORTCUTS: { icon: keyof typeof Ionicons.glyphMap; point: LocationPoint }[] = [];

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const pickup = useBookingStore((state) => state.pickup);
  const setDropoff = useBookingStore((state) => state.setDropoff);
  const unreadCount = useNotificationsStore((state) => state.items.filter((n) => !n.read).length);
  const { isGranted } = useLocationPermission();

  function handleShortcutPress(point: LocationPoint) {
    setDropoff(point);
    router.push('/booking/confirm');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/*
        The top bar and map sit OUTSIDE the ScrollView on purpose. The map is
        draggable, and a draggable map inside a scroller competes for the same
        vertical gesture — on Android the map wins and the page stops scrolling.
        Pinning it removes the conflict at the source instead of arbitrating it,
        and keeps the map visible while the rider reads the list below.
      */}
      <View style={styles.topBar}>
        <View style={styles.greetingSlot}>
          <Text style={styles.greetingLabel}>Good day</Text>
          <Text style={styles.greetingName} numberOfLines={1}>
            {user?.name ?? 'Rider'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          style={styles.bellButton}
          onPress={() => router.push('/notifications')}
        >
          <Ionicons name="notifications-outline" size={22} color={colors.ink} />
          {unreadCount > 0 && <View style={styles.bellDot} />}
        </Pressable>
      </View>

      <View style={styles.mapWrap}>
        <OsmMap
          variant="pin"
          caption="Map · your location"
          height={280}
          latitude={pickup?.latitude}
          longitude={pickup?.longitude}
          zoom={16}
          interactive
        />
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionLabel}>Saved places</Text>
        {SHORTCUTS.length === 0 ? (
          <EmptyState
            title="No saved places yet"
            message="Places you save will appear here for one-tap booking."
          />
        ) : (
          <View style={styles.shortcuts}>
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
          </View>
        )}
      </ScrollView>

      {/* Pinned so the primary action stays reachable no matter what scrolls. */}
      <View style={styles.ctaWrap}>
        <Button
          label="Where to?"
          fullWidth
          disabled={!isGranted}
          // Only while disabled — an enabled button must not announce a reason
          // that no longer applies.
          accessibilityHint={isGranted ? undefined : LOCATION_REQUIRED_HINT}
          onPress={() => router.push('/booking/set-destination')}
        />
        <LocationRequiredNotice />
      </View>
    </SafeAreaView>
  );
}

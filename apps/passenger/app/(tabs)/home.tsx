import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, MapPlaceholder, colors } from '@trisakay/ui';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useBookingStore } from '../../src/store/useBookingStore';
import { useNotificationsStore } from '../../src/store/useNotificationsStore';
import type { LocationPoint } from '../../src/types/booking';
import { styles } from './home.styles';

const SHORTCUTS: { icon: keyof typeof Ionicons.glyphMap; point: LocationPoint }[] = [
  { icon: 'home-outline', point: { label: 'Home', address: 'Brgy. San Roque, Poblacion' } },
  { icon: 'briefcase-outline', point: { label: 'Work', address: 'City Hall, Gov. Drive' } },
];

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const setDropoff = useBookingStore((state) => state.setDropoff);
  const unreadCount = useNotificationsStore((state) => state.items.filter((n) => !n.read).length);

  function handleShortcutPress(point: LocationPoint) {
    setDropoff(point);
    router.push('/booking/confirm');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
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
          <MapPlaceholder variant="pin" caption="Map · your location" height={280} />
        </View>

        <Text style={styles.sectionLabel}>Saved places</Text>
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

        <View style={styles.ctaWrap}>
          <Button label="Where to?" fullWidth onPress={() => router.push('/booking/set-destination')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, BrandMotif, Card, EmptyState, GradientSurface, colors } from '@trisakay/ui';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useBookingStore } from '../../src/store/useBookingStore';
import { useNotificationsStore } from '../../src/store/useNotificationsStore';
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
  const setDropoff = useBookingStore((state) => state.setDropoff);
  const unreadCount = useNotificationsStore((state) => state.items.filter((n) => !n.read).length);
  const t = useTranslation();

  function handleShortcutPress(point: LocationPoint) {
    setDropoff(point);
    router.push('/booking/confirm');
  }

  const firstName = user?.name?.trim().split(/\s+/)[0];
  const greeting = firstName ? `${getGreeting(t)}, ${firstName}` : getGreeting(t);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
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
            <View style={styles.headerSpacer} />
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
        </Card>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.home.ctaTitle}
          onPress={() => router.push('/booking/request')}
          style={({ pressed }) => [styles.ctaWrap, pressed && styles.ctaPressed]}
        >
          <GradientSurface token="brand" direction="diagonal" style={styles.ctaCard}>
            <BrandMotif size={140} color={colors.white} opacity={0.12} style={styles.ctaMotif} />
            <View style={styles.ctaIconBadge}>
              <Ionicons name="car-sport" size={26} color={colors.white} />
            </View>
            <View style={styles.ctaTextSlot}>
              <Text style={styles.ctaTitle}>{t.home.ctaTitle}</Text>
              <Text style={styles.ctaSubtitle}>{t.home.ctaSubtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.white} />
          </GradientSurface>
        </Pressable>

        <View>
          <Text style={styles.sectionLabel}>{t.home.savedPlaces}</Text>
          {SHORTCUTS.length === 0 ? (
            <EmptyState
              title={t.home.noSavedPlacesTitle}
              message={t.home.noSavedPlacesMessage}
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

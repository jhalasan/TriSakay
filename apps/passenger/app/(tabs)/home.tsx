import { useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, BrandMotif, EmptyState, GradientSurface, Spinner, colors } from '@trisakay/ui';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useBookingStore } from '../../src/store/useBookingStore';
import { useNotificationsStore } from '../../src/store/useNotificationsStore';
import { useSavedPlacesStore } from '../../src/store/useSavedPlacesStore';
import type { SavedPlaceRow } from '@trisakay/services';
import type { LocationPoint } from '../../src/types/booking';
import { styles } from '../../src/styles/tabs/home.styles';

function getGreeting(t: ReturnType<typeof useTranslation>) {
  const hour = new Date().getHours();
  if (hour < 12) return t.home.greetingMorning;
  if (hour < 18) return t.home.greetingAfternoon;
  return t.home.greetingEvening;
}

function getGreetingIcon(): keyof typeof Ionicons.glyphMap {
  const hour = new Date().getHours();
  if (hour < 12) return 'partly-sunny-outline';
  if (hour < 18) return 'sunny-outline';
  return 'moon-outline';
}

const KIND_ICON: Record<SavedPlaceRow['kind'], keyof typeof Ionicons.glyphMap> = {
  home: 'home-outline',
  work: 'briefcase-outline',
  custom: 'location-outline',
};

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const setDropoff = useBookingStore((state) => state.setDropoff);
  const unreadCount = useNotificationsStore((state) => state.items.filter((n) => !n.read).length);
  const t = useTranslation();
  const savedPlaces = useSavedPlacesStore((state) => state.items);
  const savedPlacesLoading = useSavedPlacesStore((state) => state.loading);
  const savedPlacesError = useSavedPlacesStore((state) => state.error);
  const loadSavedPlaces = useSavedPlacesStore((state) => state.load);
  const removeSavedPlace = useSavedPlacesStore((state) => state.remove);

  useFocusEffect(
    useCallback(() => {
      void loadSavedPlaces();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  function handleShortcutPress(point: LocationPoint) {
    setDropoff(point);
    router.push('/booking/confirm');
  }

  async function performDeleteSavedPlace(id: string) {
    const { error } = await removeSavedPlace(id);
    if (error) Alert.alert(t.home.savedPlacesErrorTitle, error);
  }

  function handleDeleteSavedPlace(item: SavedPlaceRow) {
    Alert.alert(
      t.home.deleteSavedPlaceTitle,
      t.home.deleteSavedPlaceMessage,
      [
        { text: t.common.cancel, style: 'cancel' },
        { text: t.common.delete, style: 'destructive', onPress: () => void performDeleteSavedPlace(item.id) },
      ]
    );
  }

  const firstName = user?.name?.trim().split(/\s+/)[0];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <GradientSurface token="hero" direction="diagonal" style={styles.heroPanel}>
          <BrandMotif size={220} color={colors.white} opacity={0.1} style={styles.heroMotifTop} />
          <BrandMotif size={120} color={colors.white} opacity={0.06} style={styles.heroMotifBottom} />
          <View style={styles.heroPanelInner}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroIdentityRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.home.profileAccessibilityLabel}
                  onPress={() => router.push('/(tabs)/profile')}
                >
                  <View style={styles.avatarOuterRing}>
                    <View style={styles.avatarInnerRing}>
                      <Avatar name={user?.name} source={user?.avatarUrl ? { uri: user.avatarUrl } : undefined} size="lg" />
                    </View>
                  </View>
                </Pressable>
                <View style={styles.heroTextSlot}>
                  <View style={styles.heroGreetingRow}>
                    <Ionicons name={getGreetingIcon()} size={14} color={colors.white} style={{ opacity: 0.75 }} />
                    <Text style={styles.heroGreetingLabel}>{getGreeting(t)}</Text>
                  </View>
                  <Text style={styles.heroName} numberOfLines={1}>
                    {firstName ?? user?.name ?? t.home.ctaTitle}
                  </Text>
                  <Text style={styles.heroTagline}>{t.home.heroTagline}</Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.home.notificationsAccessibilityLabel}
                style={styles.bellButton}
                onPress={() => router.push('/notifications')}
              >
                <Ionicons name="notifications-outline" size={20} color={colors.white} />
                {unreadCount > 0 && <View style={styles.bellDot} />}
              </Pressable>
            </View>
          </View>
        </GradientSurface>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.home.ctaTitle}
          onPress={() => router.push('/booking/request')}
          style={({ pressed }) => [styles.ctaWrap, pressed && styles.ctaPressed]}
        >
          <GradientSurface token="brand" direction="diagonal" style={styles.ctaCard}>
            <BrandMotif size={140} color={colors.white} opacity={0.12} style={styles.ctaMotif} />
            <View style={styles.ctaCardInner}>
              <View style={styles.ctaIconBadge}>
                <Ionicons name="car-sport" size={26} color={colors.white} />
              </View>
              <View style={styles.ctaTextSlot}>
                <Text style={styles.ctaTitle}>{t.home.ctaTitle}</Text>
                <Text style={styles.ctaSubtitle}>{t.home.ctaSubtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={colors.white} />
            </View>
          </GradientSurface>
        </Pressable>

        <View>
          <Text style={styles.sectionLabel}>{t.home.savedPlaces}</Text>
          {savedPlacesLoading && savedPlaces.length === 0 ? (
            <Spinner size="small" />
          ) : savedPlacesError ? (
            <EmptyState title={t.home.savedPlacesErrorTitle} message={t.home.savedPlacesErrorMessage} />
          ) : savedPlaces.length === 0 ? (
            <EmptyState
              title={t.home.noSavedPlacesTitle}
              message={t.home.noSavedPlacesMessage}
            />
          ) : (
            <View style={styles.shortcuts}>
              {savedPlaces.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.shortcutRow}
                  onPress={() =>
                    handleShortcutPress({
                      label: item.label,
                      address: item.address,
                      latitude: item.latitude,
                      longitude: item.longitude,
                    })
                  }
                  onLongPress={() => handleDeleteSavedPlace(item)}
                  accessibilityRole="button"
                >
                  <View style={styles.shortcutIcon}>
                    <Ionicons name={KIND_ICON[item.kind]} size={20} color={colors.accentBluePressed} />
                  </View>
                  <View style={styles.shortcutTextSlot}>
                    <Text style={styles.shortcutLabel}>{item.label}</Text>
                    <Text style={styles.shortcutAddress} numberOfLines={1}>
                      {item.address}
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

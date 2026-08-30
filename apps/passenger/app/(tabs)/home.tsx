import { useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, BrandMotif, EmptyState, GradientSurface, Spinner, StatTile, colors } from '@trisakay/ui';
import { useTranslation } from '../../src/hooks/useTranslation';
import { usePassengerStats } from '../../src/hooks/usePassengerStats';
import { useNearbyDriverCount } from '../../src/hooks/useNearbyDriverCount';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useBookingStore } from '../../src/store/useBookingStore';
import { useNotificationsStore } from '../../src/store/useNotificationsStore';
import { useSavedPlacesStore } from '../../src/store/useSavedPlacesStore';
import { SHORTCUT_ICON_TONE, DEFAULT_SHORTCUT_TONE } from '../../src/utils/savedPlaceIconTone';
import { formatDiscountLabel } from '@trisakay/services';
import type { SavedPlaceIcon, SavedPlaceRow } from '@trisakay/services';
import type { LocationPoint } from '../../src/types/booking';
import { styles } from '../../src/styles/tabs/home.styles';

// Dev-only override for reaching the empty saved-places state without clearing real data.
// Toggle in the debugger: globalThis.__TRISAKAY_MOCK_EMPTY_SAVED_PLACES__ = true
declare global {
  // eslint-disable-next-line no-var
  var __TRISAKAY_MOCK_EMPTY_SAVED_PLACES__: boolean | undefined;
}

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

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const setDropoff = useBookingStore((state) => state.setDropoff);
  const unreadCount = useNotificationsStore((state) => state.items.filter((n) => !n.read).length);
  const t = useTranslation();
  const savedPlacesReal = useSavedPlacesStore((state) => state.items);
  const savedPlaces = __DEV__ && globalThis.__TRISAKAY_MOCK_EMPTY_SAVED_PLACES__ ? [] : savedPlacesReal;
  const savedPlacesLoading = useSavedPlacesStore((state) => state.loading);
  const savedPlacesError = useSavedPlacesStore((state) => state.error);
  const loadSavedPlaces = useSavedPlacesStore((state) => state.load);
  const removeSavedPlace = useSavedPlacesStore((state) => state.remove);
  const { stats } = usePassengerStats();
  const nearbyCount = useNearbyDriverCount();

  useFocusEffect(
    useCallback(() => {
      void loadSavedPlaces();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  // Routes through /booking/request rather than straight to /booking/confirm —
  // that screen is what resolves pickup (current-location fix on mount, or a
  // manual pin drop). Jumping straight to Confirm with only dropoff set left
  // pickup permanently "Not set yet" and the Request Ride button stuck
  // disabled whenever the rider hadn't already gone through the normal flow.
  function handleShortcutPress(point: LocationPoint) {
    setDropoff(point);
    router.push('/booking/request');
  }

  async function performDeleteSavedPlace(id: string) {
    const { error } = await removeSavedPlace(id);
    if (error) Alert.alert(t.home.savedPlacesErrorTitle, error);
  }

  function handleDeleteSavedPlace(item: SavedPlaceRow) {
    Alert.alert(t.home.deleteSavedPlaceTitle, t.home.deleteSavedPlaceMessage, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.delete, style: 'destructive', onPress: () => void performDeleteSavedPlace(item.id) },
    ]);
  }

  const firstName = user?.name?.trim().split(/\s+/)[0];
  const discountValue = stats?.discount
    ? formatDiscountLabel(stats.discount.category, stats.discount.ratePercent, {
        seniorCitizen: t.home.discountLabelSeniorCitizen,
        pwd: t.home.discountLabelPwd,
        student: t.home.discountLabelStudent,
      })
    : t.home.statsDiscountEmptyValue;
  const tripsValue = stats ? String(stats.trips) : t.home.statsTripsEmptyValue;

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <GradientSurface token="hero" direction="diagonal" texture textureOpacity={0.05} style={styles.heroPanel}>
          <BrandMotif size={230} color={colors.white} opacity={0.12} style={styles.heroMotifTop} />
          <SafeAreaView edges={['top']}>
            <View style={styles.heroRow}>
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
          </SafeAreaView>
          <View style={styles.statsStrip}>
            <StatTile tone="onNavy" bare label={t.home.statsTripsLabel} value={tripsValue} />
            <View style={styles.statsDivider} />
            <StatTile tone="onNavy" bare label={t.home.statsDiscountLabel} value={discountValue} />
          </View>
        </GradientSurface>

        <View style={styles.content}>
          <Pressable accessibilityRole="button" accessibilityLabel={t.home.ctaTitle} onPress={() => router.push('/booking/request')}>
            <GradientSurface solid={colors.accentGreen} texture textureOpacity={0.06} style={styles.ctaCard}>
              <BrandMotif size={150} color={colors.white} opacity={0.14} style={styles.ctaMotif} />
              <View style={styles.ctaCardInner}>
                <View style={styles.ctaIconBadge}>
                  <Image source={require('../../../../assets/trike-white.png')} style={styles.trikeMark} resizeMode="contain" />
                </View>
                <View style={styles.ctaTextSlot}>
                  <Text style={styles.ctaTitle}>{t.home.ctaTitle}</Text>
                  {nearbyCount != null ? (
                    <View style={styles.ctaChipRow}>
                      <View style={styles.ctaChip}>
                        <Text style={styles.ctaChipText}>{t.home.ctaFareChipPrefix}</Text>
                      </View>
                      <Text style={styles.ctaNearbyText}>· {t.home.ctaNearbySuffix.replace('{count}', String(nearbyCount))}</Text>
                    </View>
                  ) : (
                    <Text style={styles.ctaSubtitle}>{t.home.ctaSubtitle}</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={22} color={colors.white} />
              </View>
            </GradientSurface>
          </Pressable>

          <View>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>{t.home.savedPlaces}</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/saved-places/manage')}>
                <Text style={styles.manageLink}>{t.home.savedPlacesManage}</Text>
              </Pressable>
            </View>
            {savedPlacesLoading && savedPlaces.length === 0 ? (
              <Spinner size="small" />
            ) : savedPlacesError ? (
              <EmptyState title={t.home.savedPlacesErrorTitle} message={t.home.savedPlacesErrorMessage} />
            ) : savedPlaces.length === 0 ? (
              <View style={styles.emptyPanel}>
                <BrandMotif size={160} color={colors.accentBlue} opacity={0.05} style={styles.emptyMotif} />
                <View style={styles.emptyIconTile}>
                  <Ionicons name="bookmark-outline" size={22} color={colors.accentBluePressed} />
                </View>
                <Text style={styles.emptyTitle}>{t.home.noSavedPlacesTitle}</Text>
                <Text style={styles.emptyMessage}>{t.home.noSavedPlacesMessage}</Text>
              </View>
            ) : (
              <View style={styles.shortcuts}>
                {savedPlaces.map((item) => {
                  const tone = SHORTCUT_ICON_TONE[item.icon] ?? DEFAULT_SHORTCUT_TONE;
                  return (
                    <Pressable
                      key={item.id}
                      style={styles.shortcutRow}
                      onPress={() =>
                        handleShortcutPress({ label: item.label, address: item.address, latitude: item.latitude, longitude: item.longitude })
                      }
                      onLongPress={() => handleDeleteSavedPlace(item)}
                      accessibilityRole="button"
                    >
                      <View style={[styles.shortcutIcon, { backgroundColor: tone.bg }]}>
                        <Ionicons name={item.icon as SavedPlaceIcon} size={20} color={tone.icon} />
                      </View>
                      <View style={styles.shortcutTextSlot}>
                        <Text style={styles.shortcutLabel}>{item.label}</Text>
                        <Text style={styles.shortcutAddress} numberOfLines={1}>
                          {item.address}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

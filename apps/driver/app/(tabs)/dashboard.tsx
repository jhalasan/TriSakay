import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, BrandMotif, GradientSurface, PulseRing, RequestCard, colors } from '@trisakay/ui';
import type { PendingRequest } from '@trisakay/ui';
import { useAcceptRideRequest } from '../../src/hooks/useAcceptRideRequest';
import { useDriverUnit } from '../../src/hooks/useDriverUnit';
import { useRequestCountdown } from '../../src/hooks/useRequestCountdown';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useDriverStore } from '../../src/store/useDriverStore';
import { useNotificationsStore } from '../../src/store/useNotificationsStore';
import { useRequestsStore } from '../../src/store/useRequestsStore';
import { useTripStore } from '../../src/store/useTripStore';
import { formatCurrency } from '../../src/utils/currency';
import { styles } from '../../src/styles/tabs/dashboard.styles';

// Dev-only overrides for reaching every state without live backend data:
// globalThis.__TRISAKAY_MOCK_ONLINE__ = true | false
// globalThis.__TRISAKAY_MOCK_REQUEST__ = true  (forces the incoming-request slot with a fake request)
declare global {
  // eslint-disable-next-line no-var
  var __TRISAKAY_MOCK_ONLINE__: boolean | undefined;
  // eslint-disable-next-line no-var
  var __TRISAKAY_MOCK_REQUEST__: boolean | undefined;
}

// Typed against @trisakay/ui's PendingRequest (which declares
// pickupDistanceMeters/expiresAt as optional) rather than the app's own
// PendingRequest (apps/driver/src/types/request.ts, which doesn't have
// those fields yet — they arrive with a future backend migration). Using
// the ui package's type here lets real store items (missing those fields)
// and this mock (which has them) share one array type without a union-typed
// `incoming` that TS would refuse property access on.
const MOCK_REQUEST: PendingRequest = {
  id: '__mock__',
  seats: 2,
  paymentMethod: 'cash',
  pickupLabel: 'Poblacion Plaza, waiting shed',
  dropoffLabel: 'Public Market, Stall 14',
  fare: 45,
  createdAt: new Date().toISOString(),
  pickupDistanceMeters: 400,
  expiresAt: new Date(Date.now() + 18_000).toISOString(),
};

export default function DashboardScreen() {
  const router = useRouter();
  const t = useTranslation();
  const user = useAuthStore((state) => state.user);
  const driverUnit = useDriverUnit();

  const isAvailableReal = useDriverStore((state) => state.isAvailable);
  const isAvailable = __DEV__ && globalThis.__TRISAKAY_MOCK_ONLINE__ !== undefined ? globalThis.__TRISAKAY_MOCK_ONLINE__ : isAvailableReal;
  const setAvailable = useDriverStore((state) => state.setAvailable);
  const availabilityError = useDriverStore((state) => state.error);
  const todayEarnings = useDriverStore((state) => state.todayEarnings);
  const todayTrips = useDriverStore((state) => state.todayTrips);
  const rating = useDriverStore((state) => state.rating);
  const ratingCount = useDriverStore((state) => state.ratingCount);
  const acceptRate = useDriverStore((state) => state.acceptRate);

  const [togglingAvailability, setTogglingAvailability] = useState(false);
  const unreadCount = useNotificationsStore((state) => state.items.filter((item) => !item.read).length);

  const pendingReal = useRequestsStore((state) => state.pending);
  const pending: PendingRequest[] = __DEV__ && globalThis.__TRISAKAY_MOCK_REQUEST__ ? [MOCK_REQUEST, ...pendingReal] : pendingReal;
  const requestError = useRequestsStore((state) => state.error);
  const decline = useRequestsStore((state) => state.decline);

  const { acceptRideRequest, acceptingId } = useAcceptRideRequest();
  const activeTrip = useTripStore((state) => state.current);

  const incoming = pending[0];
  const countdown = useRequestCountdown(incoming?.expiresAt ?? null);

  async function handleToggleAvailable(next: boolean) {
    setTogglingAvailability(true);
    let coords: { lat: number; lng: number } | undefined;
    if (next) {
      try {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        coords = { lat: position.coords.latitude, lng: position.coords.longitude };
      } catch {
        useDriverStore.setState({ error: t.driver.dashboard.locationError });
        setTogglingAvailability(false);
        return;
      }
    }
    await setAvailable(next, coords);
    setTogglingAvailability(false);
  }

  if (activeTrip) {
    return <Redirect href="/trip/active" />;
  }

  const requestExpired = incoming?.expiresAt != null && countdown === 0;
  const showListening = isAvailable && (!incoming || requestExpired);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.identityRow}>
          <Avatar name={user?.name} source={user?.avatarUrl ? { uri: user.avatarUrl } : undefined} size="md" />
          <View style={styles.identityTextSlot}>
            <Text style={styles.identityName} numberOfLines={1}>
              {user?.name ?? t.driver.dashboard.driverFallback}
            </Text>
            <View style={styles.verifiedRow}>
              <Ionicons name="shield-checkmark-outline" size={13} color={colors.accentGreen} />
              <Text style={styles.verifiedText}>
                {driverUnit?.verificationStatus === 'approved' ? t.driver.dashboard.pso : t.driver.dashboard.pendingVerification}
                {driverUnit?.bodyNo ? ` · ${t.driver.dashboard.bodyNoPrefix} ${driverUnit.bodyNo}` : ''}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.driver.dashboard.notificationsAccessibilityLabel}
            style={styles.bellButton}
            onPress={() => router.push('/notifications')}
          >
            <Ionicons name="notifications-outline" size={21} color={colors.ink} />
            {unreadCount > 0 && <View style={styles.bellDot} />}
          </Pressable>
        </View>

        {isAvailable ? (
          <GradientSurface token="hero" direction="vertical" texture textureOpacity={0.05} style={styles.consoleOnline}>
            <BrandMotif size={210} color={colors.white} opacity={0.12} style={styles.consoleMotif} />
            <View style={styles.statusRow}>
              <View style={styles.statusLeft}>
                <View style={styles.pulseHost}>
                  <PulseRing size={10} color={colors.accentGreenSoft} durationMs={2000} style={{ position: 'absolute' }} />
                  <View style={styles.statusDotStatic} />
                </View>
                <Text style={styles.statusLabelOnline}>{t.driver.dashboard.onlineBadge.toUpperCase()}</Text>
              </View>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: true, disabled: togglingAvailability }}
                onPress={() => handleToggleAvailable(false)}
                disabled={togglingAvailability}
                style={[styles.toggleTrack, styles.toggleTrackOn]}
                hitSlop={8}
              >
                <View style={[styles.toggleKnob, styles.toggleKnobOn]} />
              </Pressable>
            </View>

            <Text style={styles.earningsEyebrow}>{t.driver.dashboard.earningsTodayEyebrow}</Text>
            <Text style={styles.earningsAmount}>{formatCurrency(todayEarnings)}</Text>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Ionicons name="navigate-outline" size={15} color={colors.white} />
                <Text style={styles.metaTextOnline}>{t.driver.dashboard.statTrips.replace('{count}', String(todayTrips))}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="star" size={15} color={colors.accentGreenSoft} />
                <Text style={styles.metaTextOnline}>
                  {ratingCount > 0 && rating !== null ? t.driver.dashboard.statRating.replace('{rating}', rating.toFixed(1)) : t.driver.dashboard.noRatingsYet}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="checkmark-circle-outline" size={15} color={colors.white} />
                <Text style={styles.metaTextOnline}>
                  {acceptRate !== null ? t.driver.dashboard.statAcceptance.replace('{percent}', String(Math.round(acceptRate * 100))) : '—'}
                </Text>
              </View>
            </View>
          </GradientSurface>
        ) : (
          <View style={styles.consoleOffline}>
            <View style={styles.statusRow}>
              <View style={styles.statusLeft}>
                <View style={styles.statusDotOffline} />
                <Text style={styles.statusLabelOffline}>{t.driver.dashboard.offlineBadge.toUpperCase()}</Text>
              </View>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: false, disabled: togglingAvailability }}
                onPress={() => handleToggleAvailable(true)}
                disabled={togglingAvailability}
                style={[styles.toggleTrack, styles.toggleTrackOff]}
                hitSlop={8}
              >
                <View style={[styles.toggleKnob, styles.toggleKnobOff]} />
              </Pressable>
            </View>

            <Text style={styles.earningsEyebrowOffline}>{t.driver.dashboard.earningsTodayEyebrow}</Text>
            <Text style={styles.earningsAmountOffline}>{formatCurrency(0)}</Text>

            <View style={styles.metaRow}>
              <Text style={styles.metaTextOffline}>{t.driver.dashboard.statTrips.replace('{count}', '0')}</Text>
              <Text style={styles.metaTextOffline}>{t.driver.dashboard.noRatingsYet}</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.driver.dashboard.goOnline}
              onPress={() => handleToggleAvailable(true)}
              disabled={togglingAvailability}
            >
              <GradientSurface token="button" direction="diagonal" style={styles.goOnlineButton}>
                <View style={styles.goOnlineInner}>
                  <Ionicons name="power" size={19} color={colors.white} />
                  <Text style={styles.goOnlineText}>{t.driver.dashboard.goOnline}</Text>
                </View>
              </GradientSurface>
            </Pressable>
          </View>
        )}

        {availabilityError && <Text style={styles.error}>{availabilityError}</Text>}

        {!isAvailable && (
          <View style={styles.offlineStrip}>
            <Ionicons name="radio-outline" size={20} color={colors.accentBlue} />
            <Text style={styles.offlineStripText}>{t.driver.dashboard.offlineNote}</Text>
          </View>
        )}

        {isAvailable && incoming && !requestExpired && (
          <View>
            <View style={styles.requestSectionHeader}>
              <Text style={styles.identityName}>{t.driver.dashboard.incomingRequestEyebrow}</Text>
              {countdown !== null && (
                <View style={styles.countdownChip}>
                  <Text style={styles.countdownChipText}>{countdown}s</Text>
                </View>
              )}
            </View>
            <RequestCard
              request={incoming}
              variant="incoming"
              accepting={acceptingId === incoming.id}
              onAccept={() => acceptRideRequest(incoming.id)}
              onDecline={() => decline(incoming.id)}
              copy={{
                decline: t.driver.requestCard.decline,
                accept: t.driver.requestCard.accept,
                newRideRequest: t.driver.requestCard.newRideRequest,
                seatsSingular: t.driver.requestCard.seatsSingular,
                seatsPlural: t.driver.requestCard.seatsPlural,
                pickupLabel: t.driver.requestCard.pickupLabel,
                dropoffLabel: t.driver.requestCard.dropoffLabel,
                pickupAwaySuffix: t.driver.requestCard.pickupAwaySuffix,
              }}
            />
          </View>
        )}

        {requestError && <Text style={styles.error}>{requestError}</Text>}

        {showListening && (
          <View>
            <Text style={styles.identityName}>{t.driver.dashboard.listeningEyebrow}</Text>
            <View style={styles.listeningPanel}>
              <BrandMotif size={230} color={colors.accentBlue} opacity={0.045} style={styles.listeningMotif} />
              <View style={styles.listeningIconHost}>
                <PulseRing size={74} color={colors.accentBlueSoft} durationMs={2400} style={{ position: 'absolute' }} />
                <View style={styles.listeningIconCircle}>
                  <Ionicons name="radio-outline" size={32} color={colors.accentBlue} />
                </View>
              </View>
              <Text style={styles.listeningTitle}>{t.driver.dashboard.listeningTitle}</Text>
              <Text style={styles.listeningMessage}>
                {t.driver.dashboard.listeningMessage.replace('{area}', 'Poblacion')}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

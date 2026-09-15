import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  cancelRideRequest,
  getTripDriverInfo,
  subscribeToRideRequestStatus,
  type TripDriverInfo,
} from '@trisakay/services';
import { Button, MapOverlaySheet, OsmMap, colors } from '@trisakay/ui';
import { useEffect, useRef, useState } from 'react';
import { useBookingStore } from '../../src/store/useBookingStore';
import { useTranslation } from '../../src/hooks/useTranslation';
import { styles } from '../../src/styles/booking/no-drivers-nearby.styles';

export default function NoDriversNearbyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  const pickup = useBookingStore((state) => state.pickup);
  const rideRequestId = useBookingStore((state) => state.rideRequestId);
  const setRideRequestId = useBookingStore((state) => state.setRideRequestId);
  const setDriver = useBookingStore((state) => state.setDriver);
  const setTripStatus = useBookingStore((state) => state.setTripStatus);
  const [isChangingPickup, setIsChangingPickup] = useState(false);
  const [changePickupError, setChangePickupError] = useState<string | null>(null);
  // Guards against a second, redundant exit once a status transition has
  // already sent us elsewhere — mirrors finding-driver.tsx's own guard.
  const hasExitedRef = useRef(false);

  // The request search timeout that lands the passenger on this screen only
  // stops finding-driver.tsx's own status subscription — it does not cancel
  // the still-pending ride_request. A driver can still accept it while the
  // passenger is here, so this screen needs its own subscription to catch
  // that (and to avoid handleChangePickup racing an in-flight acceptance).
  useEffect(() => {
    if (!rideRequestId) return;

    let cancelled = false;
    const unsubscribe = subscribeToRideRequestStatus(
      rideRequestId,
      (row) => {
        if (cancelled || hasExitedRef.current) return;
        if (row.status === 'assigned') {
          hasExitedRef.current = true;
          getTripDriverInfo(row.id)
            .then(({ data }) => applyDriverAndAdvance(data))
            .catch(() => applyDriverAndAdvance());
        } else if (row.status === 'cancelled') {
          hasExitedRef.current = true;
          router.replace({
            pathname: '/booking/ride-cancelled',
            params: {
              byDriver: row.cancel_reason?.toLowerCase().includes('driver') ? '1' : '0',
              discountApplied: row.discount_applied ? '1' : '0',
            },
          });
        }
      },
      () => {
        // Best-effort subscription — no local UI depends on this error, and
        // a driver acceptance will still show up next time the passenger
        // taps "Search again" (which re-subscribes via finding-driver.tsx).
      },
    );

    function applyDriverAndAdvance(data?: TripDriverInfo | null) {
      if (cancelled) return;
      setDriver({
        id: data?.driverId ?? '',
        name: data?.driverName ?? '',
        plateNumber: data?.plateNo ?? '',
        rating: data?.ratingAvg ?? null,
        etaMinutes: null,
        avatarUrl: data?.avatarUrl ?? null,
      });
      setTripStatus('matched');
      router.replace('/booking/trip');
    }

    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideRequestId]);

  if (!rideRequestId) {
    return <Redirect href="/(tabs)/home" />;
  }

  function handleSearchAgain() {
    router.replace('/booking/finding-driver');
  }

  async function handleChangePickup() {
    if (!rideRequestId) {
      router.replace('/booking/set-pickup');
      return;
    }

    setIsChangingPickup(true);
    setChangePickupError(null);

    const { error } = await cancelRideRequest(rideRequestId, 'Cancelled by passenger');

    setIsChangingPickup(false);

    if (error) {
      // Most likely cause: a driver accepted between this screen mounting
      // and the tap — the status subscription above will redirect to the
      // trip screen momentarily. Don't clear rideRequestId or navigate away
      // on a failed cancel; that would abandon a ride a driver committed to.
      setChangePickupError(error);
      return;
    }

    hasExitedRef.current = true;
    setRideRequestId(null);
    router.replace('/booking/set-pickup');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.mapFill}>
        <OsmMap
          variant="plain"
          height="100%"
          latitude={pickup?.latitude}
          longitude={pickup?.longitude}
          zoom={15}
          edgeToEdge
        />
      </View>

      <View style={styles.topFloating}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={20} color={colors.ink} />
        </Pressable>
      </View>

      <MapOverlaySheet bottomInset={insets.bottom}>
        <View style={styles.iconTile}>
          <Ionicons name="radio-outline" size={22} color={colors.inkSoft} />
        </View>
        <Text style={styles.title}>{t.noDriversNearby.title}</Text>
        <Text style={styles.cause}>{t.noDriversNearby.cause}</Text>

        {/* P1-20 (2026-09-15 launch audit): the "Notify me" toggle here was
            removed — there is no backend field to persist the preference
            against and nothing ever sent that notification. */}

        <View style={styles.primaryButton}>
          <Button label={t.noDriversNearby.searchAgain} fullWidth onPress={handleSearchAgain} />
        </View>
        <Button
          label={t.noDriversNearby.changePickupPoint}
          variant="outline"
          tone="neutral"
          fullWidth
          loading={isChangingPickup}
          disabled={isChangingPickup}
          onPress={handleChangePickup}
        />
        {changePickupError && <Text style={styles.changePickupError}>{changePickupError}</Text>}
      </MapOverlaySheet>
    </SafeAreaView>
  );
}

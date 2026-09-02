import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { cancelRideRequest } from '@trisakay/services';
import { Button, MapOverlaySheet, OsmMap, Toggle, colors } from '@trisakay/ui';
import { useState } from 'react';
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
  // Local only — there is no backend field to persist this preference against.
  const [notifyWhenFree, setNotifyWhenFree] = useState(false);

  if (!rideRequestId) {
    return <Redirect href="/(tabs)/home" />;
  }

  function handleSearchAgain() {
    router.replace('/booking/finding-driver');
  }

  async function handleChangePickup() {
    if (rideRequestId) {
      await cancelRideRequest(rideRequestId, 'Cancelled by passenger');
      setRideRequestId(null);
    }
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
          <Ionicons name="search-outline" size={22} color={colors.inkSoft} />
        </View>
        <Text style={styles.title}>{t.noDriversNearby.title}</Text>
        <Text style={styles.cause}>{t.noDriversNearby.cause}</Text>

        <View style={styles.toggleRow}>
          <Ionicons name="notifications-outline" size={19} color={colors.accentBlue} />
          <Text style={styles.toggleLabel}>{t.noDriversNearby.notifyToggleLabel}</Text>
          <Toggle value={notifyWhenFree} onValueChange={setNotifyWhenFree} />
        </View>

        <View style={styles.primaryButton}>
          <Button label={t.noDriversNearby.searchAgain} fullWidth onPress={handleSearchAgain} />
        </View>
        <Button
          label={t.noDriversNearby.changePickupPoint}
          variant="outline"
          tone="neutral"
          fullWidth
          onPress={handleChangePickup}
        />
      </MapOverlaySheet>
    </SafeAreaView>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, MapOverlaySheet, OsmMap, colors } from '@trisakay/ui';
import { useBookingStore } from '../../src/store/useBookingStore';
import { useTranslation } from '../../src/hooks/useTranslation';
import { formatCurrency } from '../../src/utils/currency';
import { styles } from '../../src/styles/booking/ride-cancelled.styles';

export default function RideCancelledScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  const { byDriver, discountApplied } = useLocalSearchParams<{ byDriver?: string; discountApplied?: string }>();
  const pickup = useBookingStore((state) => state.pickup);
  const driver = useBookingStore((state) => state.driver);
  const rideRequestId = useBookingStore((state) => state.rideRequestId);
  const setRideRequestId = useBookingStore((state) => state.setRideRequestId);

  if (!rideRequestId) {
    return <Redirect href="/(tabs)/home" />;
  }

  const cause =
    byDriver === '1' && driver?.name
      ? `${driver.name} ${t.rideCancelled.cancelledByDriverSuffix}`
      : t.rideCancelled.cancelledGeneric;

  function handleFindAnotherDriver() {
    setRideRequestId(null);
    router.replace('/booking/confirm');
  }

  function handleReport() {
    router.replace('/(tabs)/complaints');
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
          <Ionicons name="close" size={20} color={colors.inkSoft} />
        </View>
        <Text style={styles.title}>{t.rideCancelled.title}</Text>
        <Text style={styles.cause}>{cause}</Text>

        <View style={styles.summaryPanel}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t.rideCancelled.fareHeld}</Text>
            <Text style={styles.summaryValue}>{formatCurrency(0)}</Text>
          </View>
          {discountApplied === '1' && (
            <>
              <View style={styles.summaryDivider} />
              <View style={styles.discountRow}>
                <Ionicons name="checkmark-circle" size={18} color={colors.accentGreen} />
                <Text style={styles.discountText}>{t.rideCancelled.discountStillValid}</Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.primaryButton}>
          <Button label={t.rideCancelled.findAnotherDriver} fullWidth onPress={handleFindAnotherDriver} />
        </View>
        <Button
          label={t.rideCancelled.reportCancellation}
          variant="outline"
          tone="neutral"
          fullWidth
          onPress={handleReport}
        />
      </MapOverlaySheet>
    </SafeAreaView>
  );
}

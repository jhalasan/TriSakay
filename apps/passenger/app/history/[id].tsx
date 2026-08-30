import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { Avatar, Badge, Card, EmptyState, colors } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useHistoryStore } from '../../src/store/useHistoryStore';
import { formatCurrency } from '../../src/utils/currency';
import { styles } from '../../src/styles/history/detail.styles';

function formatDateTime(iso: string) {
  const date = new Date(iso);
  const day = date.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  const time = date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

export default function RideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useHistoryStore((state) => state.items.find((ride) => ride.id === id));

  if (!item) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Ride details" />
        <EmptyState title="Ride not found" message="This ride isn't in your history anymore." />
      </View>
    );
  }

  const hasRoute = item.pickup && item.dropoff;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Ride details" />
      <ScrollView contentContainerStyle={styles.content}>
        <Card variant="raised" style={styles.summaryCard}>
          <View style={styles.summaryTopRow}>
            <Badge
              label={item.status === 'done' ? 'Completed' : 'Cancelled'}
              tone={item.status === 'done' ? 'green' : 'danger'}
            />
            <Text style={styles.dateTimeText}>{formatDateTime(item.date)}</Text>
          </View>
          <Text style={styles.fareText}>{formatCurrency(item.fare)}</Text>
          {item.discountApplied && (
            <Text style={styles.discountText}>
              {item.discountPercent != null ? `${item.discountPercent}% discount applied` : 'Discount applied'}
            </Text>
          )}
        </Card>

        {hasRoute && (
          <Card variant="raised" style={styles.section}>
            <Text style={styles.sectionLabel}>Route</Text>
            <View style={styles.routeBlock}>
              <View style={styles.routeRow}>
                <View style={styles.routeMarkerCol}>
                  <View style={[styles.routeDot, styles.routeDotPickup]} />
                  <View style={styles.routeLine} />
                </View>
                <View style={styles.routeTextCol}>
                  <Text style={styles.routeLabel}>Pickup</Text>
                  <Text style={styles.routeAddress}>{item.pickup}</Text>
                </View>
              </View>
              <View style={styles.routeRow}>
                <View style={styles.routeMarkerCol}>
                  <View style={[styles.routeDot, styles.routeDotDropoff]} />
                </View>
                <View style={styles.routeTextCol}>
                  <Text style={styles.routeLabel}>Dropoff</Text>
                  <Text style={styles.routeAddress}>{item.dropoff}</Text>
                </View>
              </View>
            </View>
            {item.distanceKm != null && (
              <View style={styles.distanceRow}>
                <Ionicons name="navigate-outline" size={14} color={colors.inkSoft} />
                <Text style={styles.distanceText}>{item.distanceKm.toFixed(1)} km</Text>
              </View>
            )}
          </Card>
        )}

        {item.driverName && (
          <Card variant="raised" style={styles.section}>
            <Text style={styles.sectionLabel}>Driver</Text>
            <View style={styles.driverRow}>
              <Avatar name={item.driverName} size="sm" />
              <Text style={styles.driverName}>{item.driverName}</Text>
            </View>
          </Card>
        )}

        <Card variant="raised" style={styles.section}>
          <Text style={styles.sectionLabel}>Payment</Text>
          <View style={styles.paymentRow}>
            <Badge label={item.paymentMethod === 'gcash' ? 'GCash' : item.paymentMethod === 'cash' ? 'Cash' : 'No payment'} tone="neutral" />
            {item.paymentStatus && (
              <Badge
                label={item.paymentStatus.charAt(0).toUpperCase() + item.paymentStatus.slice(1)}
                tone={item.paymentStatus === 'paid' ? 'green' : item.paymentStatus === 'failed' ? 'danger' : 'blue'}
              />
            )}
          </View>
        </Card>

        {item.status === 'cancelled' && item.cancelReason && (
          <Card variant="raised" style={styles.section}>
            <Text style={styles.sectionLabel}>Cancellation reason</Text>
            <Text style={styles.cancelReasonText}>{item.cancelReason}</Text>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

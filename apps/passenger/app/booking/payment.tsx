import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Badge, Button, Card } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useBookingStore } from '../../src/store/useBookingStore';
import { useHistoryStore } from '../../src/store/useHistoryStore';
import { formatCurrency } from '../../src/utils/currency';
import { wait } from '../../src/mocks/delay';
import type { PaymentMethod } from '../../src/types/booking';
import { styles } from './payment.styles';

const PAYMENT_OPTIONS: { value: PaymentMethod; title: string; subtitle: string }[] = [
  { value: 'gcash', title: 'GCash Wallet', subtitle: 'Pay using your GCash balance' },
  { value: 'cash', title: 'Cash', subtitle: 'Pay the driver directly' },
];

export default function PaymentScreen() {
  const router = useRouter();
  const pickup = useBookingStore((state) => state.pickup);
  const dropoff = useBookingStore((state) => state.dropoff);
  const fare = useBookingStore((state) => state.fare);
  const driver = useBookingStore((state) => state.driver);
  const paymentMethod = useBookingStore((state) => state.paymentMethod);
  const setPaymentMethod = useBookingStore((state) => state.setPaymentMethod);
  const setTripStatus = useBookingStore((state) => state.setTripStatus);
  const addRide = useHistoryStore((state) => state.addRide);

  const [paying, setPaying] = useState(false);

  async function handlePayNow() {
    setPaying(true);
    await wait(800);
    setPaying(false);
    setTripStatus('paid');

    if (driver && dropoff) {
      addRide({
        id: `r-${Date.now()}`,
        driverName: driver.name,
        date: new Date().toISOString(),
        pickup: pickup.label,
        dropoff: dropoff.label,
        fare: fare ?? 0,
        status: 'done',
        paymentMethod,
      });
    }

    router.replace('/booking/rate-driver');
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Payment" showBack={false} />
      <View style={styles.content}>
        <Card style={styles.amountCard}>
          <Text style={styles.amountLabel}>Amount due</Text>
          <Text style={styles.amountValue}>{formatCurrency(fare ?? 0)}</Text>
          {dropoff && <Text style={styles.amountNote}>Trip to {dropoff.label}</Text>}
        </Card>

        <View>
          <Text style={styles.sectionLabel}>Pay with</Text>
          {PAYMENT_OPTIONS.map((option) => {
            const selected = paymentMethod === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[styles.optionRow, selected && styles.optionRowSelected]}
                onPress={() => setPaymentMethod(option.value)}
              >
                <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                  {selected && <View style={styles.radioInner} />}
                </View>
                <View style={styles.optionTextSlot}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
                </View>
                <Badge label={option.value === 'gcash' ? 'GCash' : 'Cash'} tone="neutral" />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.footer}>
        <Button label="Pay now" fullWidth loading={paying} onPress={handlePayNow} />
      </View>
    </View>
  );
}

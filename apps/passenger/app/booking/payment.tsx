import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, Text, View } from 'react-native';
import { Badge, Button, Card } from '@trisakay/ui';
import { createGcashCheckout, subscribeToTransactionStatus } from '@trisakay/services';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useBookingStore } from '../../src/store/useBookingStore';
import { useHistoryStore } from '../../src/store/useHistoryStore';
import { formatCurrency } from '../../src/utils/currency';
import { wait } from '../../src/mocks/delay';
import type { PaymentMethod } from '../../src/types/booking';
import { styles } from '../../src/styles/booking/payment.styles';

const PAYMENT_OPTIONS: { value: PaymentMethod; title: string; subtitle: string }[] = [
  { value: 'gcash', title: 'GCash Wallet', subtitle: 'Pay using your GCash balance' },
  { value: 'cash', title: 'Cash', subtitle: 'Pay the driver directly' },
];

const GCASH_WAIT_TIMEOUT_MS = 120_000;

type GcashPhase = 'idle' | 'opening' | 'waiting' | 'failed';

export default function PaymentScreen() {
  const router = useRouter();
  const pickup = useBookingStore((state) => state.pickup);
  const dropoff = useBookingStore((state) => state.dropoff);
  const fare = useBookingStore((state) => state.fare);
  const driver = useBookingStore((state) => state.driver);
  const rideRequestId = useBookingStore((state) => state.rideRequestId);
  const paymentMethod = useBookingStore((state) => state.paymentMethod);
  const setPaymentMethod = useBookingStore((state) => state.setPaymentMethod);
  const setTripStatus = useBookingStore((state) => state.setTripStatus);
  const addRide = useHistoryStore((state) => state.addRide);

  const [paying, setPaying] = useState(false);
  const [gcashPhase, setGcashPhase] = useState<GcashPhase>('idle');
  const [gcashError, setGcashError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      unsubscribeRef.current?.();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function finishSuccessfulPayment() {
    setTripStatus('paid');

    if (driver && dropoff) {
      addRide({
        id: `r-${Date.now()}`,
        driverName: driver.name,
        date: new Date().toISOString(),
        pickup: pickup?.label ?? '',
        dropoff: dropoff.label,
        fare: fare ?? 0,
        status: 'done',
        paymentMethod,
      });
    }

    router.replace('/booking/rate-driver');
  }

  async function handlePayNowCash() {
    setPaying(true);
    await wait(800);
    setPaying(false);
    finishSuccessfulPayment();
  }

  async function handlePayNowGcash() {
    if (!rideRequestId) {
      setGcashError('Missing ride details — please go back and try again.');
      setGcashPhase('failed');
      return;
    }

    setGcashPhase('opening');
    setGcashError(null);

    const { checkoutUrl, error } = await createGcashCheckout(rideRequestId);

    if (error || !checkoutUrl) {
      setGcashError(error ?? 'Could not start GCash checkout.');
      setGcashPhase('failed');
      return;
    }

    setGcashPhase('waiting');

    unsubscribeRef.current = subscribeToTransactionStatus(
      rideRequestId,
      (row) => {
        if (row.status === 'paid') {
          unsubscribeRef.current?.();
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          finishSuccessfulPayment();
        } else if (row.status === 'failed') {
          unsubscribeRef.current?.();
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          setGcashError('Payment failed. You can retry or pay cash instead.');
          setGcashPhase('failed');
        }
      },
      (message) => {
        setGcashError(message);
        setGcashPhase('failed');
      },
    );

    timeoutRef.current = setTimeout(() => {
      unsubscribeRef.current?.();
      setGcashError("We couldn't confirm your payment yet. You can retry or pay cash instead.");
      setGcashPhase('failed');
    }, GCASH_WAIT_TIMEOUT_MS);

    // Never trusted for anything — the Realtime subscription above is the
    // only thing that advances the UI (FR-9.2). This just gives the
    // passenger a hosted page to actually pay on.
    await WebBrowser.openBrowserAsync(checkoutUrl);
  }

  async function handlePayNow() {
    if (paymentMethod === 'gcash') {
      await handlePayNowGcash();
    } else {
      await handlePayNowCash();
    }
  }

  function handleRetryGcash() {
    setGcashPhase('idle');
    setGcashError(null);
    void handlePayNowGcash();
  }

  function handleFallbackToCash() {
    unsubscribeRef.current?.();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setGcashPhase('idle');
    setGcashError(null);
    setPaymentMethod('cash');
  }

  const gcashBusy = gcashPhase === 'opening' || gcashPhase === 'waiting';

  return (
    <View style={styles.container}>
      <ScreenHeader title="Payment" showBack={false} />
      <View style={styles.content}>
        <Card variant="raised" style={styles.amountCard}>
          <Text style={styles.amountLabel}>Amount due</Text>
          <Text style={styles.amountValue}>{fare === null ? '—' : formatCurrency(fare)}</Text>
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
                disabled={gcashBusy}
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

        {gcashPhase === 'waiting' && (
          <Text style={styles.gcashStatusText}>Waiting for PayMongo to confirm your payment…</Text>
        )}
        {gcashPhase === 'failed' && gcashError && (
          <View style={styles.gcashErrorBox}>
            <Text style={styles.gcashErrorText}>{gcashError}</Text>
            <View style={styles.gcashErrorActions}>
              <Button label="Retry GCash" onPress={handleRetryGcash} />
              <Button label="Pay cash instead" variant="outline" onPress={handleFallbackToCash} />
            </View>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Button
          label={gcashPhase === 'opening' ? 'Opening PayMongo…' : 'Pay now'}
          fullWidth
          loading={paying || gcashPhase === 'opening'}
          disabled={gcashPhase === 'waiting' || gcashPhase === 'failed'}
          onPress={handlePayNow}
        />
      </View>
    </View>
  );
}

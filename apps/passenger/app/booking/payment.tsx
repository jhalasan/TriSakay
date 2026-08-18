import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, Text, View } from 'react-native';
import { Badge, Button, Card } from '@trisakay/ui';
import { createGcashCheckout, subscribeToTransactionStatus } from '@trisakay/services';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useBookingStore } from '../../src/store/useBookingStore';
import { formatCurrency } from '../../src/utils/currency';
import type { PaymentMethod } from '../../src/types/booking';
import { styles } from '../../src/styles/booking/payment.styles';
import { useTranslation } from '../../src/hooks/useTranslation';

const GCASH_WAIT_TIMEOUT_MS = 120_000;
const CASH_WAIT_TIMEOUT_MS = 30_000;

type PaymentPhase = 'idle' | 'opening' | 'waiting' | 'failed';

export default function PaymentScreen() {
  const router = useRouter();
  const t = useTranslation();
  const PAYMENT_OPTIONS: { value: PaymentMethod; title: string; subtitle: string }[] = [
    { value: 'gcash', title: t.payment.gcashWalletTitle, subtitle: t.payment.gcashWalletSubtitle },
    { value: 'cash', title: t.common.cash, subtitle: t.payment.cashSubtitle },
  ];
  const dropoff = useBookingStore((state) => state.dropoff);
  const fare = useBookingStore((state) => state.fare);
  const rideRequestId = useBookingStore((state) => state.rideRequestId);
  const paymentMethod = useBookingStore((state) => state.paymentMethod);
  const setPaymentMethod = useBookingStore((state) => state.setPaymentMethod);
  const setTripStatus = useBookingStore((state) => state.setTripStatus);

  const [paymentPhase, setPaymentPhase] = useState<PaymentPhase>('idle');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cashWaitRestartRef = useRef<(() => void) | null>(null);
  const settledRef = useRef(false);

  useEffect(() => {
    return () => {
      unsubscribeRef.current?.();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (paymentMethod !== 'cash') return;

    if (!rideRequestId) {
      function markMissingRideDetails() {
        setPaymentError(t.payment.missingRideDetails);
        setPaymentPhase('failed');
      }

      markMissingRideDetails();
      cashWaitRestartRef.current = markMissingRideDetails;
      return;
    }

    function startCashWait() {
      setPaymentPhase('waiting');
      setPaymentError(null);

      unsubscribeRef.current?.();
      unsubscribeRef.current = subscribeToTransactionStatus(
        rideRequestId!,
        (row) => {
          if (row.status === 'paid') {
            unsubscribeRef.current?.();
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            finishSuccessfulPayment();
          }
        },
        (message) => {
          unsubscribeRef.current?.();
          unsubscribeRef.current = null;
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          setPaymentError(message);
          setPaymentPhase('failed');
        },
      );

      timeoutRef.current = setTimeout(() => {
        unsubscribeRef.current?.();
        setPaymentError(t.payment.stillWaitingCashConfirm);
        setPaymentPhase('failed');
      }, CASH_WAIT_TIMEOUT_MS);
    }

    startCashWait();
    cashWaitRestartRef.current = startCashWait;
  }, [paymentMethod, rideRequestId]);

  function finishSuccessfulPayment() {
    if (settledRef.current) return;
    settledRef.current = true;

    setTripStatus('paid');
    router.replace('/booking/rate-driver');
  }

  async function handlePayNowGcash() {
    // Defensive: tear down any stale subscription from a prior attempt
    // before starting a new one, even if a previous cleanup path missed it.
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;

    if (!rideRequestId) {
      setPaymentError(t.payment.missingRideDetails);
      setPaymentPhase('failed');
      return;
    }

    setPaymentPhase('opening');
    setPaymentError(null);

    const { checkoutUrl, error } = await createGcashCheckout(rideRequestId);

    if (error || !checkoutUrl) {
      setPaymentError(error ?? t.payment.couldNotStartGcashCheckout);
      setPaymentPhase('failed');
      return;
    }

    setPaymentPhase('waiting');

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
          setPaymentError(t.payment.paymentFailedRetry);
          setPaymentPhase('failed');
        }
      },
      (message) => {
        unsubscribeRef.current?.();
        unsubscribeRef.current = null;
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setPaymentError(message);
        setPaymentPhase('failed');
      },
    );

    timeoutRef.current = setTimeout(() => {
      unsubscribeRef.current?.();
      setPaymentError(t.payment.couldNotConfirmPaymentYet);
      setPaymentPhase('failed');
    }, GCASH_WAIT_TIMEOUT_MS);

    // Never trusted for anything — the Realtime subscription above is the
    // only thing that advances the UI (FR-9.2). This just gives the
    // passenger a hosted page to actually pay on.
    await WebBrowser.openBrowserAsync(checkoutUrl);
  }

  async function handlePayNow() {
    await handlePayNowGcash();
  }

  function handleRetryGcash() {
    setPaymentPhase('idle');
    setPaymentError(null);
    void handlePayNowGcash();
  }

  function handleCheckAgainCash() {
    unsubscribeRef.current?.();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    cashWaitRestartRef.current?.();
  }

  const gcashBusy = paymentPhase === 'opening' || paymentPhase === 'waiting';

  return (
    <View style={styles.container}>
      <ScreenHeader title={t.payment.title} showBack={false} />
      <View style={styles.content}>
        <Card variant="raised" style={styles.amountCard}>
          <Text style={styles.amountLabel}>{t.payment.amountDue}</Text>
          <Text style={styles.amountValue}>{fare === null ? '—' : formatCurrency(fare)}</Text>
          {dropoff && <Text style={styles.amountNote}>{t.payment.tripTo} {dropoff.label}</Text>}
        </Card>

        <View>
          <Text style={styles.sectionLabel}>{t.payment.payWith}</Text>
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
                <Badge label={option.value === 'gcash' ? t.common.gcash : t.common.cash} tone="neutral" />
              </Pressable>
            );
          })}
        </View>

        {paymentPhase === 'waiting' && (
          <Text style={styles.gcashStatusText}>
            {paymentMethod === 'cash'
              ? t.payment.waitingForCashConfirm
              : t.payment.waitingForGcashConfirm}
          </Text>
        )}
        {paymentPhase === 'failed' && paymentError && (
          <View style={styles.gcashErrorBox}>
            <Text style={styles.gcashErrorText}>{paymentError}</Text>
            <View style={styles.gcashErrorActions}>
              {paymentMethod === 'cash' ? (
                <Button label={t.payment.checkAgain} onPress={handleCheckAgainCash} />
              ) : (
                <Button label={t.payment.retryGcash} onPress={handleRetryGcash} />
              )}
            </View>
          </View>
        )}
      </View>

      {paymentMethod === 'gcash' && (
        <View style={styles.footer}>
          <Button
            label={paymentPhase === 'opening' ? t.payment.openingPaymongo : t.payment.payNow}
            fullWidth
            loading={paymentPhase === 'opening'}
            disabled={paymentPhase === 'waiting' || paymentPhase === 'failed'}
            onPress={handlePayNow}
          />
        </View>
      )}
    </View>
  );
}

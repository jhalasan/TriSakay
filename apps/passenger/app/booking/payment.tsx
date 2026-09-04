import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { BrandMotif, Button, GradientSurface, colors } from '@trisakay/ui';
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
  // Guards against a fast double-tap firing two concurrent GCash checkouts —
  // `paymentPhase` alone isn't enough since React batches the 'opening' state
  // update, leaving a window where a second tap still reads 'idle'.
  const gcashInFlightRef = useRef(false);

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
    router.replace('/booking/trip-complete');
  }

  async function handlePayNowGcash() {
    if (gcashInFlightRef.current) return;
    gcashInFlightRef.current = true;

    // Defensive: tear down any stale subscription from a prior attempt
    // before starting a new one, even if a previous cleanup path missed it.
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;

    if (!rideRequestId) {
      setPaymentError(t.payment.missingRideDetails);
      setPaymentPhase('failed');
      gcashInFlightRef.current = false;
      return;
    }

    setPaymentPhase('opening');
    setPaymentError(null);

    const { checkoutUrl, error } = await createGcashCheckout(rideRequestId);

    if (error || !checkoutUrl) {
      setPaymentError(error ?? t.payment.couldNotStartGcashCheckout);
      setPaymentPhase('failed');
      gcashInFlightRef.current = false;
      return;
    }

    setPaymentPhase('waiting');
    // From here, the button's own `disabled` prop (phase 'waiting'/'failed')
    // covers re-entry — safe to release the pre-render guard.
    gcashInFlightRef.current = false;

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
        <View style={styles.amountShadowWrap}>
          <GradientSurface token="hero" direction="diagonal" style={styles.amountCard}>
            <BrandMotif size={170} color={colors.white} opacity={0.12} style={styles.amountMotif} />
            <Text style={styles.amountLabel}>{t.payment.amountDue}</Text>
            <Text style={styles.amountValue}>{fare === null ? '—' : formatCurrency(fare)}</Text>
            {dropoff && (
              <View style={styles.amountNoteRow}>
                <Ionicons name="location" size={14} color={colors.white} style={{ opacity: 0.7 }} />
                <Text style={styles.amountNote}>
                  {t.payment.tripTo} {dropoff.label}
                </Text>
              </View>
            )}
          </GradientSurface>
        </View>

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
                <Ionicons
                  name={option.value === 'gcash' ? 'card-outline' : 'cash-outline'}
                  size={20}
                  color={selected ? colors.accentBlue : colors.inkFaint}
                />
              </Pressable>
            );
          })}
        </View>

        <View style={styles.noticeBox}>
          <Ionicons name="information-circle-outline" size={18} color={colors.accentBluePressed} />
          <Text style={styles.noticeText}>{t.payment.keepScreenOpenNotice}</Text>
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
            label={
              paymentPhase === 'opening'
                ? t.payment.openingPaymongo
                : `${t.payment.payNow} ${fare === null ? '' : formatCurrency(fare)}`
            }
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

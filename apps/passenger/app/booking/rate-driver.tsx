import { useState } from 'react';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Avatar, Button, Card, StarRating, Textarea } from '@trisakay/ui';
import { submitRating } from '@trisakay/services';
import { useBookingStore } from '../../src/store/useBookingStore';
import { useTranslation } from '../../src/hooks/useTranslation';
import { styles } from '../../src/styles/booking/rate-driver.styles';

export default function RateDriverScreen() {
  const router = useRouter();
  const driver = useBookingStore((state) => state.driver);
  const rideRequestId = useBookingStore((state) => state.rideRequestId);
  const reset = useBookingStore((state) => state.reset);
  const t = useTranslation();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canRate = Boolean(driver?.id) && Boolean(rideRequestId);

  function finish() {
    reset();
    router.replace('/(tabs)/home');
  }

  function handleRatingChange(value: number) {
    setSubmitError(null);
    setRating(value);
  }

  function handleCommentChange(value: string) {
    setSubmitError(null);
    setComment(value);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);

    const { error } = await submitRating({
      rideRequestId: rideRequestId!,
      driverId: driver!.id,
      stars: rating,
      comment,
    });

    setSubmitting(false);

    if (error) {
      setSubmitError(error);
      return;
    }

    finish();
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card variant="raised" style={styles.driverCard}>
          <Avatar name={driver?.name} size="xl" />
          <Text style={styles.name}>{driver?.name ?? t.rateDriver.yourDriverFallback}</Text>
          <Text style={styles.subtitle}>{t.rateDriver.howWasYourRide}</Text>
        </Card>

        {canRate ? (
          <>
            <View style={styles.starsRow}>
              <StarRating value={rating} onChange={handleRatingChange} size={34} />
            </View>

            <View style={styles.commentWrap}>
              <Textarea
                label={t.rateDriver.commentLabel}
                placeholder={t.rateDriver.commentPlaceholder}
                value={comment}
                onChangeText={handleCommentChange}
              />
            </View>

            {submitError && <Text style={styles.errorText}>{submitError}</Text>}

            <View style={styles.submitWrap}>
              <Button
                label={t.rateDriver.submitRating}
                fullWidth
                disabled={rating === 0}
                loading={submitting}
                onPress={handleSubmit}
              />
            </View>

            {submitError && (
              <View style={styles.submitWrap}>
                <Button label={t.rateDriver.skipForNow} variant="outline" fullWidth onPress={finish} />
              </View>
            )}
          </>
        ) : (
          <>
            <Text style={styles.fallbackNote}>
              {t.rateDriver.couldNotConfirmDriver}
            </Text>
            <View style={styles.submitWrap}>
              <Button label={t.rateDriver.continue} fullWidth onPress={finish} />
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

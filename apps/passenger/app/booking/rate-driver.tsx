import { useState } from 'react';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Avatar, Button, Card, StarRating, Textarea } from '@trisakay/ui';
import { submitRating } from '@trisakay/services';
import { useBookingStore } from '../../src/store/useBookingStore';
import { styles } from '../../src/styles/booking/rate-driver.styles';

export default function RateDriverScreen() {
  const router = useRouter();
  const driver = useBookingStore((state) => state.driver);
  const rideRequestId = useBookingStore((state) => state.rideRequestId);
  const reset = useBookingStore((state) => state.reset);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canRate = Boolean(driver?.id) && Boolean(rideRequestId);

  function finish() {
    reset();
    router.replace('/(tabs)/home');
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
          <Text style={styles.name}>{driver?.name ?? 'Your driver'}</Text>
          <Text style={styles.subtitle}>How was your ride?</Text>
        </Card>

        {canRate ? (
          <>
            <View style={styles.starsRow}>
              <StarRating value={rating} onChange={setRating} size={34} />
            </View>

            <View style={styles.commentWrap}>
              <Textarea
                label="Comment (optional)"
                placeholder="Tell us about your trip"
                value={comment}
                onChangeText={setComment}
              />
            </View>

            {submitError && <Text style={styles.errorText}>{submitError}</Text>}

            <View style={styles.submitWrap}>
              <Button
                label="Submit rating"
                fullWidth
                disabled={rating === 0}
                loading={submitting}
                onPress={handleSubmit}
              />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.fallbackNote}>
              We couldn't confirm your driver for this trip — you can still continue.
            </Text>
            <View style={styles.submitWrap}>
              <Button label="Continue" fullWidth onPress={finish} />
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

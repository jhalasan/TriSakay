import { useState } from 'react';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Avatar, Button, Card, StarRating, Textarea } from '@trisakay/ui';
import { useBookingStore } from '../../src/store/useBookingStore';
import { wait } from '../../src/mocks/delay';
import { styles } from '../../src/styles/booking/rate-driver.styles';

export default function RateDriverScreen() {
  const router = useRouter();
  const driver = useBookingStore((state) => state.driver);
  const reset = useBookingStore((state) => state.reset);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    await wait(500);
    setSubmitting(false);
    reset();
    router.replace('/(tabs)/home');
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card variant="raised" style={styles.driverCard}>
          <Avatar name={driver?.name} size="xl" />
          <Text style={styles.name}>{driver?.name ?? 'Your driver'}</Text>
          <Text style={styles.subtitle}>How was your ride?</Text>
        </Card>

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

        <View style={styles.submitWrap}>
          <Button
            label="Submit rating"
            fullWidth
            disabled={rating === 0}
            loading={submitting}
            onPress={handleSubmit}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, EmptyState, ListRow, Textarea, TextField, colors } from '@trisakay/ui';
import { useHistoryStore } from '../../src/store/useHistoryStore';
import { isNonEmpty } from '../../src/utils/validation';
import { wait } from '../../src/mocks/delay';
import { styles } from './complaints.styles';

export default function ComplaintsScreen() {
  const rides = useHistoryStore((state) => state.rides);

  const [relatedTripId, setRelatedTripId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const selectedRide = rides.find((ride) => ride.id === relatedTripId) ?? null;
  const canSubmit = !!relatedTripId && isNonEmpty(subject) && isNonEmpty(message);

  function resetForm() {
    setRelatedTripId(null);
    setSubject('');
    setMessage('');
    setSubmitted(false);
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    await wait(600);
    setSubmitting(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.successWrap}>
          <EmptyState
            icon={<Ionicons name="checkmark-circle" size={40} color={colors.accentGreen} />}
            title="Complaint submitted"
            message="Our team will review this and follow up if needed."
          />
          <Button label="Submit another" variant="outline" tone="neutral" onPress={resetForm} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Complaints</Text>

          <View>
            <Text style={styles.fieldLabel}>Related trip</Text>
            <Pressable
              style={styles.pickerField}
              onPress={() => setPickerOpen((prev) => !prev)}
              accessibilityRole="button"
            >
              <Text style={[styles.pickerFieldText, !selectedRide && styles.pickerFieldPlaceholder]} numberOfLines={1}>
                {selectedRide ? `${selectedRide.driverName} · ${selectedRide.dropoff}` : 'Select a past ride'}
              </Text>
              <Ionicons name={pickerOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.inkSoft} />
            </Pressable>

            {pickerOpen && (
              <Card style={styles.pickerList}>
                {rides.length === 0 ? (
                  <Text style={styles.pickerEmpty}>
                    No past rides to report on yet.
                  </Text>
                ) : (
                  rides.map((ride, index) => (
                    <ListRow
                      key={ride.id}
                      title={ride.driverName || 'Driver'}
                      subtitle={ride.pickup && ride.dropoff ? `${ride.pickup} → ${ride.dropoff}` : undefined}
                      onPress={() => {
                        setRelatedTripId(ride.id);
                        setPickerOpen(false);
                      }}
                      divider={index < rides.length - 1}
                    />
                  ))
                )}
              </Card>
            )}
          </View>

          <TextField label="Subject" placeholder="What's this about?" value={subject} onChangeText={setSubject} />
          <Textarea
            label="Message"
            placeholder="Describe what happened"
            value={message}
            onChangeText={setMessage}
          />

          <Button label="Submit complaint" fullWidth disabled={!canSubmit} loading={submitting} onPress={handleSubmit} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

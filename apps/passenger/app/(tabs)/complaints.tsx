import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { submitComplaint, type ComplaintCategory } from '@trisakay/services';
import { Button, Card, EmptyState, ListRow, Textarea, TextField, colors } from '@trisakay/ui';
import { useHistoryStore } from '../../src/store/useHistoryStore';
import { isNonEmpty } from '../../src/utils/validation';
import { styles } from '../../src/styles/tabs/complaints.styles';

const CATEGORY_LABEL: Record<ComplaintCategory, string> = {
  fare: 'Fare dispute',
  conduct: 'Driver conduct',
  safety: 'Safety concern',
  low_rating: 'Low rating',
  vehicle_condition: 'Vehicle condition',
  other: 'Other',
};

const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABEL) as ComplaintCategory[];

export default function ComplaintsScreen() {
  const rides = useHistoryStore((state) => state.items);
  const loadHistory = useHistoryStore((state) => state.load);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const [relatedTripId, setRelatedTripId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [category, setCategory] = useState<ComplaintCategory>('other');
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedRide = rides.find((ride) => ride.id === relatedTripId) ?? null;
  const canSubmit = !!relatedTripId && isNonEmpty(subject) && isNonEmpty(message);

  function resetForm() {
    setRelatedTripId(null);
    setCategory('other');
    setSubject('');
    setMessage('');
    setSubmitted(false);
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);

    const { error } = await submitComplaint({
      subject,
      message,
      category,
      rideRequestId: relatedTripId ?? undefined,
    });

    setSubmitting(false);

    if (error) {
      setSubmitError(error);
      return;
    }

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

          <View>
            <Text style={styles.fieldLabel}>Category</Text>
            <Pressable
              style={styles.pickerField}
              onPress={() => setCategoryPickerOpen((prev) => !prev)}
              accessibilityRole="button"
            >
              <Text style={styles.pickerFieldText} numberOfLines={1}>
                {CATEGORY_LABEL[category]}
              </Text>
              <Ionicons name={categoryPickerOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.inkSoft} />
            </Pressable>

            {categoryPickerOpen && (
              <Card style={styles.pickerList}>
                {CATEGORY_OPTIONS.map((value, index) => (
                  <ListRow
                    key={value}
                    title={CATEGORY_LABEL[value]}
                    onPress={() => {
                      setCategory(value);
                      setCategoryPickerOpen(false);
                    }}
                    divider={index < CATEGORY_OPTIONS.length - 1}
                  />
                ))}
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

          {submitError && <Text style={styles.error}>{submitError}</Text>}

          <Button label="Submit complaint" fullWidth disabled={!canSubmit} loading={submitting} onPress={handleSubmit} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

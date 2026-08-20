import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { submitComplaint, type ComplaintCategory } from '@trisakay/services';
import { Button, Card, EmptyState, ListRow, Textarea, TextField, colors } from '@trisakay/ui';
import { useHistoryStore } from '../../src/store/useHistoryStore';
import { isNonEmpty } from '../../src/utils/validation';
import { styles } from '../../src/styles/tabs/complaints.styles';

const MAX_EVIDENCE_PHOTOS = 3;

/**
 * expo-file-system's `File` class is a no-op stub on web (every method warns
 * and does nothing — see ExpoFileSystem.web.ts) even though it's the
 * reliable read path on native. `fetch(uri).arrayBuffer()` is the flaky one
 * on native (RN Android), but on web the picker's URI is a blob: URL that
 * fetch reads fine, so branch rather than pick one for both platforms.
 */
async function readFileBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') return (await fetch(uri)).arrayBuffer();
  return new File(uri).arrayBuffer();
}

const CATEGORY_LABEL: Record<ComplaintCategory, string> = {
  fare: 'Fare dispute',
  conduct: 'Driver conduct',
  safety: 'Safety concern',
  low_rating: 'Low rating',
  vehicle_condition: 'Vehicle condition',
  other: 'Other',
};

const CATEGORY_ICON: Record<ComplaintCategory, keyof typeof Ionicons.glyphMap> = {
  fare: 'cash-outline',
  conduct: 'person-outline',
  safety: 'shield-outline',
  low_rating: 'star-outline',
  vehicle_condition: 'build-outline',
  other: 'ellipsis-horizontal',
};

const CATEGORY_TONE: Record<ComplaintCategory, { bg: string; fg: string }> = {
  fare: { bg: colors.accentGreenSoft, fg: colors.accentGreenPressed },
  conduct: { bg: colors.accentBlueSoft, fg: colors.accentBluePressed },
  safety: { bg: colors.dangerSoft, fg: colors.dangerPressed },
  low_rating: { bg: colors.accentBlueSoft, fg: colors.accentBluePressed },
  vehicle_condition: { bg: colors.accentBlueSoft, fg: colors.accentBluePressed },
  other: { bg: colors.fill, fg: colors.inkSoft },
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
  const [evidenceUris, setEvidenceUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedWarning, setSubmittedWarning] = useState<string | null>(null);

  const selectedRide = rides.find((ride) => ride.id === relatedTripId) ?? null;
  const canSubmit = !!relatedTripId && isNonEmpty(subject) && isNonEmpty(message);

  function resetForm() {
    setRelatedTripId(null);
    setCategory('other');
    setSubject('');
    setMessage('');
    setEvidenceUris([]);
    setSubmitted(false);
    setSubmittedWarning(null);
  }

  async function handlePickEvidence() {
    if (evidenceUris.length >= MAX_EVIDENCE_PHOTOS) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    setEvidenceUris((prev) => [...prev, result.assets[0].uri]);
  }

  function removeEvidence(index: number) {
    setEvidenceUris((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);

    const attachments = await Promise.all(
      evidenceUris.map(async (uri) => ({ data: await readFileBytes(uri) }))
    );

    const { error, attachmentError } = await submitComplaint({
      subject,
      message,
      category,
      rideRequestId: relatedTripId ?? undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    setSubmitting(false);

    if (error) {
      setSubmitError(error);
      return;
    }

    setSubmittedWarning(
      attachmentError ? `Your complaint was filed, but the evidence photos could not be attached (${attachmentError}).` : null
    );
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.successWrap}>
          <EmptyState
            icon={
              <View style={styles.successIconBadge}>
                <Ionicons name="checkmark" size={32} color={colors.accentGreenPressed} />
              </View>
            }
            title="Complaint submitted"
            message="Our team will review this and follow up if needed."
          />
          {submittedWarning && <Text style={styles.successWarning}>{submittedWarning}</Text>}
          <Button label="Submit another" variant="outline" tone="neutral" onPress={resetForm} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.headerBlock}>
            <Text style={styles.title}>Complaints</Text>
            <Text style={styles.tagline}>We're here to help make things right.</Text>
          </View>

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
              <View style={styles.categoryFieldContent}>
                <View style={[styles.categoryIconBadge, { backgroundColor: CATEGORY_TONE[category].bg }]}>
                  <Ionicons name={CATEGORY_ICON[category]} size={14} color={CATEGORY_TONE[category].fg} />
                </View>
                <Text style={styles.pickerFieldText} numberOfLines={1}>
                  {CATEGORY_LABEL[category]}
                </Text>
              </View>
              <Ionicons name={categoryPickerOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.inkSoft} />
            </Pressable>

            {categoryPickerOpen && (
              <Card style={styles.pickerList}>
                {CATEGORY_OPTIONS.map((value, index) => (
                  <ListRow
                    key={value}
                    title={CATEGORY_LABEL[value]}
                    leading={
                      <View style={[styles.categoryIconBadge, { backgroundColor: CATEGORY_TONE[value].bg }]}>
                        <Ionicons name={CATEGORY_ICON[value]} size={14} color={CATEGORY_TONE[value].fg} />
                      </View>
                    }
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

          <View>
            <View style={styles.evidenceLabelRow}>
              <Text style={styles.fieldLabel}>Evidence (optional)</Text>
              <View style={styles.evidenceCounter}>
                <Text style={styles.evidenceCounterText}>
                  {evidenceUris.length}/{MAX_EVIDENCE_PHOTOS}
                </Text>
              </View>
            </View>
            <View style={styles.evidenceRow}>
              {evidenceUris.map((uri, index) => (
                <View key={uri} style={styles.evidenceThumbWrap}>
                  <Image source={{ uri }} style={styles.evidenceThumb} resizeMode="cover" />
                  <Pressable
                    style={styles.evidenceRemove}
                    onPress={() => removeEvidence(index)}
                    accessibilityRole="button"
                    accessibilityLabel="Remove photo"
                  >
                    <Ionicons name="close" size={14} color={colors.white} />
                  </Pressable>
                </View>
              ))}
              {evidenceUris.length < MAX_EVIDENCE_PHOTOS && (
                <Pressable
                  style={styles.evidenceAddTile}
                  onPress={handlePickEvidence}
                  accessibilityRole="button"
                  accessibilityLabel="Add evidence photo"
                >
                  <Ionicons name="camera-outline" size={22} color={colors.inkSoft} />
                </Pressable>
              )}
            </View>
            <Text style={styles.evidenceHint}>Up to {MAX_EVIDENCE_PHOTOS} photos.</Text>
          </View>

          {submitError && <Text style={styles.error}>{submitError}</Text>}

          <Button label="Submit complaint" fullWidth disabled={!canSubmit} loading={submitting} onPress={handleSubmit} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

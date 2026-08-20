import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { Image, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { ComplaintCategory } from '@trisakay/services';
import { Badge, Button, Card, EmptyState, ListRow, Textarea, TextField, colors, type BadgeTone } from '@trisakay/ui';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { useComplaintsStore, type ComplaintStatus } from '../src/store/useComplaintsStore';
import { useHistoryStore } from '../src/store/useHistoryStore';
import { isNonEmpty } from '../src/utils/validation';
import { styles } from '../src/styles/complaints.styles';

const MAX_EVIDENCE_PHOTOS = 3;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

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

const STATUS_LABEL: Record<ComplaintStatus, string> = { open: 'Open', review: 'Review', closed: 'Closed' };
const STATUS_TONE: Record<ComplaintStatus, BadgeTone> = { open: 'blue', review: 'neutral', closed: 'green' };

const CATEGORY_LABEL: Record<ComplaintCategory, string> = {
  fare: 'Fare dispute',
  conduct: 'Passenger conduct',
  safety: 'Safety concern',
  low_rating: 'Low rating',
  vehicle_condition: 'Vehicle condition',
  other: 'Other',
};

const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABEL) as ComplaintCategory[];

export default function ComplaintsScreen() {
  const complaints = useComplaintsStore((state) => state.complaints);
  const loading = useComplaintsStore((state) => state.loading);
  const complaintsError = useComplaintsStore((state) => state.error);
  const load = useComplaintsStore((state) => state.load);
  const submit = useComplaintsStore((state) => state.submit);
  const trips = useHistoryStore((state) => state.trips);
  const loadTrips = useHistoryStore((state) => state.load);
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<ComplaintCategory>('other');
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [relatedTripId, setRelatedTripId] = useState<string | null>(null);
  const [tripPickerOpen, setTripPickerOpen] = useState(false);
  const [evidenceUris, setEvidenceUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submittedWarning, setSubmittedWarning] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void loadTrips();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const selectedTrip = trips.find((trip) => trip.id === relatedTripId) ?? null;
  const canSubmit = isNonEmpty(subject) && isNonEmpty(message);

  function resetForm() {
    setSubject('');
    setMessage('');
    setCategory('other');
    setRelatedTripId(null);
    setEvidenceUris([]);
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
    setSubmittedWarning(null);

    const attachments = await Promise.all(
      evidenceUris.map(async (uri) => ({ data: await readFileBytes(uri) }))
    );

    const { ok, attachmentError } = await submit(
      subject,
      message,
      category,
      relatedTripId ?? undefined,
      attachments.length > 0 ? attachments : undefined
    );

    setSubmitting(false);
    if (!ok) return;
    resetForm();
    setComposing(false);
    if (attachmentError) {
      setSubmittedWarning(`Your complaint was filed, but the evidence photos could not be attached (${attachmentError}).`);
    }
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Complaints"
        right={
          <Text
            onPress={() => {
              setComposing((prev) => !prev);
              setSubmittedWarning(null);
            }}
            style={styles.newToggleText}
          >
            {composing ? 'Cancel' : 'New'}
          </Text>
        }
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        >
          {composing ? (
            <View style={styles.formGap}>
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

              <View>
                <Text style={styles.fieldLabel}>Related trip (optional)</Text>
                <Pressable
                  style={styles.pickerField}
                  onPress={() => setTripPickerOpen((prev) => !prev)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.pickerFieldText, !selectedTrip && styles.pickerFieldPlaceholder]} numberOfLines={1}>
                    {selectedTrip
                      ? `${selectedTrip.passengerName ?? 'Passenger'} · ${formatDate(selectedTrip.date)}`
                      : 'Select a past trip'}
                  </Text>
                  <Ionicons name={tripPickerOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.inkSoft} />
                </Pressable>

                {tripPickerOpen && (
                  <Card style={styles.pickerList}>
                    {trips.length === 0 ? (
                      <Text style={styles.pickerEmpty}>No past trips to report on yet.</Text>
                    ) : (
                      trips.map((trip, index) => (
                        <ListRow
                          key={trip.id}
                          title={trip.passengerName || 'Passenger'}
                          subtitle={formatDate(trip.date)}
                          onPress={() => {
                            setRelatedTripId(trip.id);
                            setTripPickerOpen(false);
                          }}
                          divider={index < trips.length - 1}
                        />
                      ))
                    )}
                  </Card>
                )}
              </View>

              <TextField label="Subject" placeholder="What's this about?" value={subject} onChangeText={setSubject} />
              <Textarea label="Message" placeholder="Describe what happened" value={message} onChangeText={setMessage} />

              <View>
                <Text style={styles.fieldLabel}>Evidence (optional)</Text>
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

              {complaintsError && <Text style={styles.error}>{complaintsError}</Text>}
              <Button label="Submit complaint" fullWidth disabled={!canSubmit} loading={submitting} onPress={handleSubmit} />
            </View>
          ) : complaints.length === 0 ? (
            loading ? null : (
              <>
                {submittedWarning && <Text style={styles.submittedWarning}>{submittedWarning}</Text>}
                <EmptyState title="No complaints" message="Complaints you submit will appear here." />
              </>
            )
          ) : (
            <View style={styles.listContent}>
              {submittedWarning && <Text style={styles.submittedWarning}>{submittedWarning}</Text>}
              {complaints.map((item) => (
                <Card key={item.id} style={styles.cardRow}>
                  <View style={styles.subjectRow}>
                    <Text style={styles.subject}>{item.subject}</Text>
                    <Badge label={STATUS_LABEL[item.status]} tone={STATUS_TONE[item.status]} />
                  </View>
                </Card>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

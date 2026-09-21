import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  listMyComplaints,
  submitComplaint,
  type ComplaintCategory,
  type ComplaintDbStatus,
  type MyComplaintRow,
} from '@trisakay/services';
import { Avatar, Badge, Button, Card, EmptyState, ListRow, Textarea, TextField, colors, useTutorialTarget, type BadgeTone } from '@trisakay/ui';
import { OfflineState } from '../../src/components/OfflineState';
import { useConnectivityStore } from '../../src/store/useConnectivityStore';
import { useHistoryStore } from '../../src/store/useHistoryStore';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useComplaintFormTutorialDemo } from '../../src/hooks/useTutorialDemoState';
import { isNonEmpty } from '../../src/utils/validation';
import { getReferenceCode } from '../../src/utils/reference';
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

const STATUS_TONE: Record<ComplaintDbStatus, BadgeTone> = {
  open: 'blue',
  under_review: 'blue',
  mediation_scheduled: 'blue',
  escalated: 'danger',
  resolved: 'green',
  dismissed: 'neutral',
};

export default function ComplaintsScreen() {
  const t = useTranslation();
  const router = useRouter();
  const rides = useHistoryStore((state) => state.items);
  const loadHistory = useHistoryStore((state) => state.load);
  const tutorialDemo = useComplaintFormTutorialDemo();
  const tripAndCategoryTarget = useTutorialTarget('trip-and-category');
  const evidenceAndSubmitTarget = useTutorialTarget('evidence-and-submit');

  const CATEGORY_LABEL: Record<ComplaintCategory, string> = {
    fare: t.complaints.categoryFare,
    conduct: t.complaints.categoryConduct,
    safety: t.complaints.categorySafety,
    low_rating: t.complaints.categoryLowRating,
    vehicle_condition: t.complaints.categoryVehicleCondition,
    other: t.complaints.categoryOther,
  };
  const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABEL) as ComplaintCategory[];
  const STATUS_LABEL: Record<ComplaintDbStatus, string> = {
    open: t.complaints.statusOpen,
    under_review: t.complaints.statusUnderReview,
    escalated: t.complaints.statusEscalated,
    mediation_scheduled: t.complaints.statusMediationScheduled,
    resolved: t.complaints.statusResolved,
    dismissed: t.complaints.statusDismissed,
  };

  const isOffline = useConnectivityStore((state) => state.isOffline);
  const [myComplaints, setMyComplaints] = useState<MyComplaintRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void loadHistory();
      listMyComplaints().then(({ data }) => {
        if (!cancelled) setMyComplaints(data);
      });
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const [relatedTripId, setRelatedTripId] = useState<string | null>(null);
  // P2 (2026-09-15 launch audit): "Complaints require a completed trip — a
  // passenger who was never picked up cannot file one." The backend never
  // actually required this (complaints.ride_request_id is nullable, and
  // complaints_submit's RLS check is just `submitted_by = auth.uid()`) —
  // canSubmit's `!!relatedTripId` was the only thing enforcing it. This flag
  // lets a passenger explicitly say "not about a specific ride" (e.g. their
  // driver never showed and the request never resolved to completed/
  // cancelled, so it never appears in the ride picker below) instead of
  // being unable to submit anything at all.
  const [generalComplaint, setGeneralComplaint] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [categoryState, setCategory] = useState<ComplaintCategory>('other');
  const category = tutorialDemo.active ? tutorialDemo.data.category : categoryState;
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [evidenceUris, setEvidenceUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedWarning, setSubmittedWarning] = useState<string | null>(null);

  const selectedRide = rides.find((ride) => ride.id === relatedTripId) ?? null;
  const canSubmit = (!!relatedTripId || generalComplaint) && isNonEmpty(subject) && isNonEmpty(message);

  function resetForm() {
    setRelatedTripId(null);
    setGeneralComplaint(false);
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
      attachmentError ? `${t.complaints.attachmentUploadFailedPrefix} (${attachmentError}).` : null
    );
    setSubmitted(true);
    listMyComplaints().then(({ data }) => setMyComplaints(data));
  }

  if (isOffline) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <OfflineState />
      </SafeAreaView>
    );
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
            title={t.complaints.submittedTitle}
            message={t.complaints.submittedMessage}
          />
          {submittedWarning && <Text style={styles.successWarning}>{submittedWarning}</Text>}
          <Button label={t.complaints.submitAnother} variant="outline" tone="neutral" onPress={resetForm} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.headerBlock}>
            <Text style={styles.title}>{t.complaints.title}</Text>
            <Text style={styles.tagline}>{t.complaints.tagline}</Text>
          </View>

          <View {...tripAndCategoryTarget}>
          <View>
            <Text style={styles.fieldLabel}>{t.complaints.relatedTrip}</Text>
            <Pressable
              style={styles.pickerField}
              onPress={() => (tutorialDemo.active ? undefined : setPickerOpen((prev) => !prev))}
              accessibilityRole="button"
            >
              <View style={styles.categoryFieldContent}>
                {selectedRide && <Avatar name={selectedRide.driverName} size="xs" />}
                <Text
                  style={[styles.pickerFieldText, !selectedRide && !generalComplaint && styles.pickerFieldPlaceholder]}
                  numberOfLines={1}
                >
                  {tutorialDemo.active
                    ? tutorialDemo.data.relatedTripLabel
                    : selectedRide
                      ? `${selectedRide.driverName} · ${selectedRide.dropoff} · #${getReferenceCode(selectedRide.id)}`
                      : generalComplaint
                        ? t.complaints.notRelatedToARide
                        : t.complaints.selectAPastRide}
                </Text>
              </View>
              <Ionicons name={pickerOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.inkSoft} />
            </Pressable>

            {pickerOpen && (
              <Card style={styles.pickerList}>
                <ListRow
                  title={t.complaints.notRelatedToARide}
                  subtitle={t.complaints.notRelatedToARideSubtitle}
                  onPress={() => {
                    setRelatedTripId(null);
                    setGeneralComplaint(true);
                    setPickerOpen(false);
                  }}
                  divider={rides.length > 0}
                />
                {rides.map((ride, index) => (
                  <ListRow
                    key={ride.id}
                    title={`${ride.driverName || 'Driver'} · #${getReferenceCode(ride.id)}`}
                    subtitle={ride.pickup && ride.dropoff ? `${ride.pickup} → ${ride.dropoff}` : undefined}
                    onPress={() => {
                      setRelatedTripId(ride.id);
                      setGeneralComplaint(false);
                      setPickerOpen(false);
                    }}
                    divider={index < rides.length - 1}
                  />
                ))}
              </Card>
            )}
          </View>

          <View>
            <Text style={styles.fieldLabel}>{t.complaints.category}</Text>
            <Pressable
              style={styles.pickerField}
              onPress={() => (tutorialDemo.active ? undefined : setCategoryPickerOpen((prev) => !prev))}
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
          </View>

          <TextField
            label={t.complaints.subject}
            placeholder={t.complaints.subjectPlaceholder}
            value={subject}
            onChangeText={setSubject}
          />
          <Textarea
            label={t.complaints.message}
            placeholder={t.complaints.messagePlaceholder}
            value={message}
            onChangeText={setMessage}
          />

          <View {...evidenceAndSubmitTarget}>
          <View>
            <View style={styles.evidenceLabelRow}>
              <Text style={styles.fieldLabel}>{t.complaints.evidenceOptional}</Text>
              <View style={styles.evidenceCounter}>
                <Text style={styles.evidenceCounterText}>
                  {tutorialDemo.active ? 1 : evidenceUris.length}/{MAX_EVIDENCE_PHOTOS}
                </Text>
              </View>
            </View>
            <View style={styles.evidenceRow}>
              {tutorialDemo.active ? (
                <View style={styles.evidenceThumbWrap}>
                  <View style={[styles.evidenceThumb, styles.evidenceThumbPlaceholder]}>
                    <Ionicons name="image" size={18} color={colors.inkSoft} />
                  </View>
                </View>
              ) : (
                evidenceUris.map((uri, index) => (
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
                ))
              )}
              {(tutorialDemo.active ? 1 : evidenceUris.length) < MAX_EVIDENCE_PHOTOS && (
                <Pressable
                  style={styles.evidenceAddTile}
                  onPress={() => (tutorialDemo.active ? undefined : handlePickEvidence())}
                  accessibilityRole="button"
                  accessibilityLabel="Add evidence photo"
                >
                  <Ionicons name="camera-outline" size={22} color={colors.inkSoft} />
                </Pressable>
              )}
            </View>
            <Text style={styles.evidenceHint}>
              {t.complaints.evidenceHintPrefix} {MAX_EVIDENCE_PHOTOS} {t.complaints.evidenceHintSuffix}
            </Text>
          </View>

          {submitError && <Text style={styles.error}>{submitError}</Text>}

          <Button
            label={t.complaints.submitComplaint}
            fullWidth
            disabled={!tutorialDemo.active && !canSubmit}
            loading={submitting}
            onPress={tutorialDemo.active ? undefined : handleSubmit}
          />
          </View>

          {myComplaints.length > 0 && (
            <View style={styles.priorSection}>
              <Text style={styles.fieldLabel}>{t.complaints.yourComplaints}</Text>
              <Card style={styles.pickerList}>
                {myComplaints.map((complaint, index) => (
                  <ListRow
                    key={complaint.id}
                    title={complaint.subject}
                    trailing={<Badge label={STATUS_LABEL[complaint.status]} tone={STATUS_TONE[complaint.status]} />}
                    onPress={() => router.push(`/complaints/${complaint.id}`)}
                    divider={index < myComplaints.length - 1}
                  />
                ))}
              </Card>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

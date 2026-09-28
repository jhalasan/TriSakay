import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { submitComplaint, type ComplaintCategory } from '@trisakay/services';
import { Avatar, Badge, Button, Card, ListRow, Textarea, TextField, colors, useTutorialTarget } from '@trisakay/ui';
import { IconTile, StickyFooter } from '../../src/components/complaints';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useComplaintFormTutorialDemo } from '../../src/hooks/useTutorialDemoState';
import { useHistoryStore } from '../../src/store/useHistoryStore';
import { CATEGORY_GRID_ORDER, CATEGORY_ICON, CATEGORY_TONE } from '../../src/utils/complaintCategories';
import { getReferenceCode } from '../../src/utils/reference';
import { isNonEmpty } from '../../src/utils/validation';
import { styles } from '../../src/styles/complaints/new.styles';

const MAX_EVIDENCE_PHOTOS = 3;

/** Client-side per-category quick subjects (README §3.2). Not translated yet — flagged as English-only for now. */
const SUBJECT_SUGGESTIONS: Record<ComplaintCategory, string[]> = {
  fare: ['Charged above the fare matrix', 'No change given', 'Discount not applied'],
  conduct: ['Rude or unsafe behaviour', 'Refused my drop-off point', 'Asked for extra passengers'],
  safety: ['Reckless driving', 'Overloaded tricycle', 'Felt unsafe during the ride'],
  vehicle_condition: ['Tricycle in poor condition', 'No body number visible'],
  low_rating: ['Explaining my rating'],
  other: [],
};

function formatRideDateTime(iso: string) {
  const date = new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  const time = new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
  return `${date}, ${time}`;
}

/** See (tabs)/complaints.tsx's former copy of this comment: expo-file-system's `File` is a web no-op, fetch(uri) is the flaky one on native. */
async function readFileBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') return (await fetch(uri)).arrayBuffer();
  return new File(uri).arrayBuffer();
}

type Step = 1 | 2 | 'sent';

export default function NewComplaintScreen() {
  const t = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const rides = useHistoryStore((state) => state.items);
  const params = useLocalSearchParams<{ rideRequestId?: string; category?: ComplaintCategory }>();
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

  const [step, setStep] = useState<Step>(1);
  const effectiveStep: Step = tutorialDemo.active && tutorialDemo.step ? tutorialDemo.step : step;

  const [relatedTripId, setRelatedTripId] = useState<string | null>(params.rideRequestId ?? null);
  const [generalComplaint, setGeneralComplaint] = useState(false);
  const [pickerExpanded, setPickerExpanded] = useState(false);
  const [category, setCategory] = useState<ComplaintCategory | null>(params.category ?? null);
  const effectiveCategory = tutorialDemo.active ? tutorialDemo.data.category : category;

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [evidenceUris, setEvidenceUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedWarning, setSubmittedWarning] = useState<string | null>(null);
  const [newComplaintId, setNewComplaintId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedRide = rides.find((ride) => ride.id === relatedTripId) ?? null;
  const canContinue = (!!relatedTripId || generalComplaint) && !!effectiveCategory;
  const canSubmit = isNonEmpty(subject) && isNonEmpty(message);

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
    if (!canSubmit || !effectiveCategory) return;
    setSubmitting(true);
    setSubmitError(null);

    const attachments = await Promise.all(evidenceUris.map(async (uri) => ({ data: await readFileBytes(uri) })));

    const { error, id, attachmentError } = await submitComplaint({
      subject,
      message,
      category: effectiveCategory,
      rideRequestId: relatedTripId ?? undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    setSubmitting(false);

    if (error) {
      setSubmitError(error);
      return;
    }

    setSubmittedWarning(attachmentError ? `${t.complaints.attachmentUploadFailedPrefix} (${attachmentError}).` : null);
    setNewComplaintId(id);
    setStep('sent');
  }

  async function handleCopyReference() {
    const ref = getReferenceCode(newComplaintId);
    if (!ref) return;
    await Clipboard.setStringAsync('#' + ref);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (effectiveStep === 'sent') {
    const ref = getReferenceCode(newComplaintId);
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView contentContainerStyle={styles.sentScroll}>
          <View style={styles.sentIconHalo}>
            <View style={styles.sentIconCircle}>
              <Ionicons name="checkmark" size={34} color={colors.accentGreenPressed} />
            </View>
          </View>
          <Text style={styles.sentTitle}>{t.complaints.complaintSentTitle}</Text>
          <Text style={styles.sentMessage}>{t.complaints.complaintSentMessage}</Text>
          {submittedWarning && <Text style={styles.sentWarning}>{submittedWarning}</Text>}

          <View style={styles.referenceCard}>
            <View>
              <Text style={styles.referenceEyebrow}>{t.complaints.referenceLabel}</Text>
              <Text style={styles.referenceValue}>#{ref}</Text>
            </View>
            <Pressable style={styles.copyButton} onPress={handleCopyReference} accessibilityRole="button">
              <Text style={styles.copyButtonText}>{copied ? t.complaints.copiedButton : t.complaints.copyButton}</Text>
            </Pressable>
          </View>

          <View style={styles.nextCard}>
            <Text style={styles.sectionLabel}>{t.complaints.whatHappensNext}</Text>
            <View style={styles.nextRow}>
              <View style={[styles.nextTile, { backgroundColor: colors.accentGreenSoft }]}>
                <Ionicons name="checkmark" size={12} color={colors.accentGreenPressed} />
              </View>
              <View style={styles.nextTextSlot}>
                <Text style={styles.nextTitle}>{t.complaints.nextReceived}</Text>
                <Text style={styles.nextBody}>{t.complaints.nextJustNow}</Text>
              </View>
            </View>
            <View style={styles.nextRow}>
              <View style={[styles.nextTile, { backgroundColor: colors.accentBlueSoft }]}>
                <Text style={styles.nextTileNumber}>2</Text>
              </View>
              <View style={styles.nextTextSlot}>
                <Text style={styles.nextTitle}>{t.complaints.nextOperatorReviews}</Text>
                <Text style={styles.nextBody}>{t.complaints.nextDriverAsked}</Text>
              </View>
            </View>
            <View style={styles.nextRow}>
              <View style={[styles.nextTile, { backgroundColor: colors.accentBlueSoft }]}>
                <Text style={styles.nextTileNumber}>3</Text>
              </View>
              <View style={styles.nextTextSlot}>
                <Text style={styles.nextTitle}>{t.complaints.nextDecision}</Text>
                <Text style={styles.nextBody}>{t.complaints.nextNotified}</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={[styles.sentBottom, { paddingBottom: 12 + insets.bottom }]}>
          <Button
            label={t.complaints.trackThisComplaint}
            fullWidth
            onPress={() => newComplaintId && router.replace(`/complaints/${newComplaintId}`)}
          />
          <Pressable style={styles.backTextButton} onPress={() => router.back()} accessibilityRole="button">
            <Text style={styles.backTextButtonLabel}>{t.complaints.backToComplaints}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.headerRow}>
          <Pressable
            style={styles.headerTile}
            accessibilityRole="button"
            onPress={() => (effectiveStep === 2 ? setStep(1) : router.back())}
          >
            <Ionicons name={effectiveStep === 2 ? 'chevron-back' : 'close'} size={18} color={colors.ink} />
          </Pressable>
          <Text style={styles.headerTitle}>{t.complaints.newComplaintTitle}</Text>
          <Text style={styles.headerStep}>{t.complaints.stepOfTwo.replace('{n}', String(effectiveStep))}</Text>
        </View>
        <View style={styles.progressRow}>
          <View style={[styles.progressSegment, { backgroundColor: colors.accentBlue }]} />
          <View style={[styles.progressSegment, { backgroundColor: effectiveStep === 2 ? colors.accentBlue : colors.line }]} />
        </View>

        {effectiveStep === 1 ? (
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View {...tripAndCategoryTarget} style={styles.stepGroups}>
              <View style={styles.group}>
                <Text style={styles.question}>{t.complaints.whichTrip}</Text>

                {tutorialDemo.active ? (
                  <View style={styles.tripCard}>
                    <View style={styles.tripTopRow}>
                      <Avatar name="Juan Dela Cruz" size="sm" />
                      <Text style={styles.tripName} numberOfLines={1}>
                        {tutorialDemo.data.relatedTripLabel}
                      </Text>
                    </View>
                    <View style={styles.routeBlock}>
                      <Text style={styles.routeLine}>{tutorialDemo.data.pickup}</Text>
                      <Text style={styles.routeLine}>{tutorialDemo.data.dropoff}</Text>
                    </View>
                  </View>
                ) : selectedRide ? (
                  <Pressable style={styles.tripCard} onPress={() => setPickerExpanded((v) => !v)} accessibilityRole="button">
                    <View style={styles.tripTopRow}>
                      <Avatar name={selectedRide.driverName} source={selectedRide.driverAvatarUrl ? { uri: selectedRide.driverAvatarUrl } : undefined} size="sm" />
                      <View style={styles.tripNameSlot}>
                        <Text style={styles.tripName} numberOfLines={1}>
                          {selectedRide.driverName || 'Driver'}
                        </Text>
                        <Text style={styles.tripMeta} numberOfLines={1}>
                          {formatRideDateTime(selectedRide.date)} · #{getReferenceCode(selectedRide.id)}
                        </Text>
                      </View>
                      <Text style={styles.changeLink}>{t.complaints.change}</Text>
                    </View>
                    <View style={styles.routeBlock}>
                      <Text style={styles.routeLine} numberOfLines={1}>
                        {selectedRide.pickup}
                      </Text>
                      <Text style={styles.routeLine} numberOfLines={1}>
                        {selectedRide.dropoff}
                      </Text>
                      {selectedRide.fare > 0 && <Text style={styles.tripFare}>₱{selectedRide.fare}</Text>}
                    </View>
                  </Pressable>
                ) : (
                  <Pressable
                    style={[styles.tripCard, styles.tripCardEmpty, generalComplaint && styles.tripCardDimmed]}
                    onPress={() => setPickerExpanded((v) => !v)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.tripPlaceholder}>{t.complaints.selectAPastRide}</Text>
                    <Ionicons name="chevron-down" size={18} color={colors.inkFaint} />
                  </Pressable>
                )}

                {pickerExpanded && !tutorialDemo.active && (
                  <Card style={styles.pickerCard}>
                    <ListRow
                      title={t.complaints.notRelatedToARide}
                      subtitle={t.complaints.notAboutARideHint}
                      onPress={() => {
                        setRelatedTripId(null);
                        setGeneralComplaint(true);
                        setPickerExpanded(false);
                      }}
                      divider={rides.length > 0}
                    />
                    {rides.length > 0 && (
                      <ScrollView style={styles.pickerScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                        {rides.map((ride, index) => (
                          <ListRow
                            key={ride.id}
                            leading={<Avatar name={ride.driverName} source={ride.driverAvatarUrl ? { uri: ride.driverAvatarUrl } : undefined} size="xs" />}
                            title={`${ride.driverName || 'Driver'} · #${getReferenceCode(ride.id)}`}
                            subtitle={ride.pickup && ride.dropoff ? `${formatRideDateTime(ride.date)} · ${ride.pickup} → ${ride.dropoff}` : formatRideDateTime(ride.date)}
                            trailing={ride.status === 'cancelled' ? <Badge label="Cancelled" tone="danger" /> : undefined}
                            onPress={() => {
                              setRelatedTripId(ride.id);
                              setGeneralComplaint(false);
                              setPickerExpanded(false);
                            }}
                            divider={index < rides.length - 1}
                          />
                        ))}
                      </ScrollView>
                    )}
                  </Card>
                )}

                <Pressable
                  style={[styles.radioRow, generalComplaint && styles.radioRowSelected]}
                  onPress={() => {
                    setGeneralComplaint(true);
                    setRelatedTripId(null);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: generalComplaint }}
                >
                  <View style={[styles.radioRing, generalComplaint && styles.radioRingSelected]}>
                    {generalComplaint && <View style={styles.radioDot} />}
                  </View>
                  <View style={styles.radioTextSlot}>
                    <Text style={styles.radioTitle}>{t.complaints.notRelatedToARide}</Text>
                    <Text style={styles.radioSub}>{t.complaints.notAboutARideHint}</Text>
                  </View>
                </Pressable>
              </View>

              <View style={styles.group}>
                <Text style={styles.question}>{t.complaints.whatsItAbout}</Text>
                <View style={styles.categoryGrid}>
                  {CATEGORY_GRID_ORDER.map((value) => {
                    const selected = value === effectiveCategory;
                    return (
                      <Pressable
                        key={value}
                        style={[styles.categoryTile, selected && styles.categoryTileSelected]}
                        onPress={() => (tutorialDemo.active ? undefined : setCategory(value))}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected }}
                      >
                        <IconTile size={34} backgroundColor={CATEGORY_TONE[value].bg}>
                          <Ionicons name={CATEGORY_ICON[value]} size={16} color={CATEGORY_TONE[value].fg} />
                        </IconTile>
                        <Text style={styles.categoryLabel}>{CATEGORY_LABEL[value]}</Text>
                        {selected && (
                          <View style={styles.categoryCheckBadge}>
                            <Ionicons name="checkmark" size={10} color={colors.white} />
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <Pressable style={styles.summaryChip} onPress={() => setStep(1)} accessibilityRole="button">
              <IconTile size={30} backgroundColor={CATEGORY_TONE[effectiveCategory ?? 'other'].bg}>
                <Ionicons name={CATEGORY_ICON[effectiveCategory ?? 'other']} size={15} color={CATEGORY_TONE[effectiveCategory ?? 'other'].fg} />
              </IconTile>
              <Text style={styles.summaryText} numberOfLines={1}>
                {effectiveCategory ? CATEGORY_LABEL[effectiveCategory] : ''} ·{' '}
                {tutorialDemo.active ? tutorialDemo.data.relatedTripLabel : selectedRide ? `${selectedRide.driverName}, ${formatRideDateTime(selectedRide.date)}` : t.complaints.notRelatedToARide}
              </Text>
              <Ionicons name="pencil" size={15} color={colors.inkSoft} />
            </Pressable>

            <View>
              <TextField label={t.complaints.subject} placeholder={t.complaints.subjectPlaceholder} value={subject} onChangeText={setSubject} />
              {effectiveCategory && SUBJECT_SUGGESTIONS[effectiveCategory].length > 0 && (
                <View style={styles.chipRow}>
                  {SUBJECT_SUGGESTIONS[effectiveCategory].map((chip) => {
                    const selected = subject === chip;
                    return (
                      <Pressable key={chip} style={[styles.suggestionChip, selected && styles.suggestionChipSelected]} onPress={() => setSubject(chip)}>
                        <Text style={[styles.suggestionChipText, selected && styles.suggestionChipTextSelected]}>{chip}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            <Textarea
              label={t.complaints.whatHappenedLabel}
              helperText={t.hints.complaintMessage}
              placeholder={t.complaints.messagePlaceholder}
              value={message}
              onChangeText={setMessage}
            />

            <View {...evidenceAndSubmitTarget}>
              <View style={styles.evidenceLabelRow}>
                <Text style={styles.fieldLabel}>{t.complaints.photosOptional}</Text>
                <View style={styles.evidenceCounter}>
                  <Text style={styles.evidenceCounterText}>
                    {tutorialDemo.active ? 1 : evidenceUris.length}/{MAX_EVIDENCE_PHOTOS}
                  </Text>
                </View>
              </View>
              <View style={styles.evidenceRow}>
                {tutorialDemo.active ? (
                  <View style={[styles.evidenceThumb, styles.evidenceThumbPlaceholder]}>
                    <Ionicons name="image" size={18} color={colors.inkSoft} />
                  </View>
                ) : (
                  evidenceUris.map((uri, index) => (
                    <View key={uri} style={styles.evidenceThumbWrap}>
                      <Image source={{ uri }} style={styles.evidenceThumb} resizeMode="cover" />
                      <Pressable style={styles.evidenceRemove} onPress={() => removeEvidence(index)} accessibilityRole="button" accessibilityLabel={t.complaints.removePhotoA11y}>
                        <Ionicons name="close" size={10} color={colors.white} />
                      </Pressable>
                    </View>
                  ))
                )}
                {(tutorialDemo.active ? 1 : evidenceUris.length) < MAX_EVIDENCE_PHOTOS && (
                  <Pressable
                    style={[styles.addPhotoTile, (tutorialDemo.active ? 1 : evidenceUris.length) === 2 && styles.addPhotoTileCompact]}
                    onPress={() => (tutorialDemo.active ? undefined : handlePickEvidence())}
                    accessibilityRole="button"
                    accessibilityLabel={t.complaints.addEvidencePhotoA11y}
                  >
                    <Ionicons name="camera-outline" size={22} color={colors.accentBlue} />
                    {(tutorialDemo.active ? 1 : evidenceUris.length) < 2 && (
                      <Text style={styles.addPhotoText}>
                        <Text style={styles.addPhotoTextStrong}>{t.complaints.addPhoto}</Text> {t.complaints.addPhotoHint}
                      </Text>
                    )}
                  </Pressable>
                )}
              </View>

              {submitError && <Text style={styles.error}>{submitError}</Text>}
            </View>
          </ScrollView>
        )}

        <StickyFooter>
          <Button
            label={effectiveStep === 1 ? t.complaints.continueButton : t.complaints.submitComplaint}
            fullWidth
            icon={effectiveStep === 1 ? <Ionicons name="arrow-forward" size={18} color={colors.white} /> : undefined}
            disabled={tutorialDemo.active ? false : effectiveStep === 1 ? !canContinue : !canSubmit}
            loading={submitting}
            onPress={tutorialDemo.active ? undefined : effectiveStep === 1 ? () => setStep(2) : handleSubmit}
          />
        </StickyFooter>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

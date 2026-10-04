import { useCallback, useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { Image, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ComplaintCategory } from '@trisakay/services';
import {
  Avatar,
  Button,
  EmptyState,
  IconTile,
  NavyBandHeader,
  ProgressSegments,
  RouteRail,
  SelectTile,
  StatusPill,
  Textarea,
  TextField,
  colors,
  type IconTileTone, ADAPTIVE_LABEL_PROPS } from '@trisakay/ui';
import { complaintStepIndex } from '@trisakay/shared';
import { useTranslation } from '../src/hooks/useTranslation';
import { useComplaintsStore } from '../src/store/useComplaintsStore';
import { useHistoryStore } from '../src/store/useHistoryStore';
import { formatCurrency } from '../src/utils/currency';
import { interpolate } from '../src/utils/interpolate';
import { isNonEmpty } from '../src/utils/validation';
import { styles } from '../src/styles/complaints.styles';

const MAX_EVIDENCE_PHOTOS = 3;
const SUBJECT_MIN_LENGTH = 3;

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Driver categories in the handoff's order, each with its tile tone and icon. */
const CATEGORIES: Array<{ value: ComplaintCategory; tone: IconTileTone; icon: IconName }> = [
  { value: 'fare', tone: 'green', icon: 'cash' },
  { value: 'conduct', tone: 'navy', icon: 'person' },
  { value: 'safety', tone: 'red', icon: 'shield-checkmark' },
  { value: 'low_rating', tone: 'navy', icon: 'star-outline' },
  { value: 'vehicle_condition', tone: 'navy', icon: 'construct' },
  { value: 'other', tone: 'neutral', icon: 'ellipsis-horizontal' },
];

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

function tripStamp(iso: string) {
  const date = new Date(iso);
  return `${shortDate(iso)}, ${date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}`;
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

type View3 = 'home' | 'step1' | 'step2';

export default function ComplaintsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { rideRequestId: prefillRideRequestId, category: prefillCategory } = useLocalSearchParams<{ rideRequestId?: string; category?: string }>();
  const t = useTranslation();
  const c = t.driver.complaints;

  const CATEGORY_LABEL: Record<ComplaintCategory, string> = {
    fare: c.categoryFareDispute,
    conduct: c.categoryConduct,
    safety: c.categorySafety,
    low_rating: c.categoryLowRating,
    vehicle_condition: c.categoryVehicleCondition,
    other: c.categoryOther,
  };
  const SUGGESTIONS: Record<ComplaintCategory, readonly string[]> = {
    fare: c.suggestionsFare,
    conduct: c.suggestionsConduct,
    safety: c.suggestionsSafety,
    low_rating: c.suggestionsLowRating,
    vehicle_condition: c.suggestionsVehicleCondition,
    other: c.suggestionsOther,
  };
  const HINT: Record<ComplaintCategory, string> = {
    fare: c.hintFare,
    conduct: c.hintConduct,
    safety: c.hintSafety,
    low_rating: c.hintLowRating,
    vehicle_condition: c.hintVehicleCondition,
    other: c.hintOther,
  };

  const complaints = useComplaintsStore((state) => state.complaints);
  const loading = useComplaintsStore((state) => state.loading);
  const complaintsError = useComplaintsStore((state) => state.error);
  const load = useComplaintsStore((state) => state.load);
  const submit = useComplaintsStore((state) => state.submit);
  const trips = useHistoryStore((state) => state.trips);
  const loadTrips = useHistoryStore((state) => state.load);

  const [view, setView] = useState<View3>('home');
  const [category, setCategory] = useState<ComplaintCategory | null>(null);
  const [relatedTripId, setRelatedTripId] = useState<string | null>(null);
  const [noTrip, setNoTrip] = useState(false);
  const [tripPickerOpen, setTripPickerOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [evidenceUris, setEvidenceUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const appliedPrefillRef = useRef(false);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void loadTrips();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  // Entry points from trip details (1a) and ratings (3a) arrive with a ride —
  // and, from ratings, category=low_rating — and open straight into step 1.
  useEffect(() => {
    if (!prefillRideRequestId || appliedPrefillRef.current) return;
    appliedPrefillRef.current = true;
    setRelatedTripId(prefillRideRequestId);
    if (prefillCategory && CATEGORIES.some((item) => item.value === prefillCategory)) setCategory(prefillCategory as ComplaintCategory);
    setView('step1');
  }, [prefillRideRequestId, prefillCategory]);

  // Default trip: the one passed in, else the most recent.
  const selectedTrip = noTrip ? null : (trips.find((trip) => trip.id === relatedTripId) ?? trips[0] ?? null);
  const recentTrips = trips.slice(0, 8);

  const openCases = complaints.filter((row) => row.status !== 'closed').length;
  const closedCases = complaints.length - openCases;

  function resetForm() {
    setCategory(null);
    setRelatedTripId(null);
    setNoTrip(false);
    setTripPickerOpen(false);
    setSubject('');
    setMessage('');
    setEvidenceUris([]);
    setSubmitError(null);
  }

  function startFiling(preselect?: ComplaintCategory) {
    resetForm();
    if (preselect) setCategory(preselect);
    setView('step1');
  }

  function leaveFiling() {
    resetForm();
    setView('home');
  }

  function pickTrip(id: string) {
    setNoTrip(false);
    setRelatedTripId(id);
    setTripPickerOpen(false);
  }

  function chooseNoTrip() {
    setNoTrip(true);
    setRelatedTripId(null);
    setTripPickerOpen(false);
  }

  function handleCategory(next: ComplaintCategory) {
    setCategory(next);
    // Suggestions are per category, so a subject picked from another category's chips no longer fits.
    setSubject('');
  }

  async function addEvidence() {
    if (evidenceUris.length >= MAX_EVIDENCE_PHOTOS) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    setEvidenceUris((prev) => [...prev, result.assets[0].uri]);
  }

  const canSubmit = subject.trim().length >= SUBJECT_MIN_LENGTH && isNonEmpty(message);

  async function handleSubmit() {
    if (!canSubmit || !category || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const attachments = await Promise.all(evidenceUris.map(async (uri) => ({ data: await readFileBytes(uri) })));
      const { ok, id } = await submit(
        subject.trim(),
        message,
        category,
        selectedTrip?.id,
        attachments.length > 0 ? attachments : undefined
      );
      if (!ok) {
        setSubmitError(useComplaintsStore.getState().error ?? c.caseNotFound);
        return;
      }
      resetForm();
      setView('home');
      if (id) router.push({ pathname: '/complaints/[id]', params: { id } });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  }

  function barColors(step: 0 | 1 | 2): string[] {
    if (step === 2) return [colors.accentGreen, colors.accentGreen, colors.accentGreen];
    if (step === 1) return [colors.accentGreen, colors.accentBlue, colors.line];
    return [colors.accentBlue, colors.line, colors.line];
  }

  // -------------------------------------------------------------- filing
  if (view !== 'home') {
    const stepNumber = view === 'step1' ? 1 : 2;
    const categoryMeta = CATEGORIES.find((item) => item.value === category);
    return (
      <View style={[styles.container, { paddingTop: insets.top + 6 }]}>
        <View style={styles.filingHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={view === 'step1' ? c.closeA11y : c.backA11y}
            onPress={view === 'step1' ? leaveFiling : () => setView('step1')}
            style={styles.headerTile}
          >
            <Ionicons name={view === 'step1' ? 'close' : 'chevron-back'} size={18} color={colors.ink} />
          </Pressable>
          <Text style={styles.filingTitle}>{c.newComplaintTitle}</Text>
          <Text style={styles.filingStep}>{interpolate(c.stepOfTwo, { n: stepNumber })}</Text>
        </View>
        <View style={styles.progressWrap}>
          <ProgressSegments colors={[colors.accentBlue, stepNumber === 2 ? colors.accentBlue : colors.line]} gap={6} />
        </View>

        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {view === 'step1' ? (
              <>
                <View style={styles.block}>
                  <Text style={styles.question}>{c.whichTrip}</Text>
                  {selectedTrip && (
                    <View style={styles.tripCard}>
                      <View style={styles.tripTop}>
                        <Avatar name={selectedTrip.passengerName ?? undefined} source={selectedTrip.passengerAvatarUrl ? { uri: selectedTrip.passengerAvatarUrl } : undefined} size="sm" />
                        <View style={styles.tripTopBody}>
                          <Text style={styles.tripName} numberOfLines={1}>
                            {selectedTrip.passengerName || c.passengerFallback}
                          </Text>
                          <Text style={styles.tripSub} numberOfLines={1}>
                            {tripStamp(selectedTrip.date)}
                          </Text>
                        </View>
                        {recentTrips.length > 1 && (
                          <Pressable accessibilityRole="button" onPress={() => setTripPickerOpen((open) => !open)} style={styles.linkButton}>
                            <Text {...ADAPTIVE_LABEL_PROPS} style={styles.linkText}>{c.changeTrip}</Text>
                          </Pressable>
                        )}
                      </View>
                      {selectedTrip.pickup && selectedTrip.dropoff && (
                        <View style={styles.tripBottom}>
                          <View style={styles.tripRail}>
                            <RouteRail variant="compact" gap={6} pickup={{ name: selectedTrip.pickup }} dropoff={{ name: selectedTrip.dropoff }} />
                          </View>
                          {selectedTrip.fare !== null && <Text style={styles.tripFare}>{formatCurrency(selectedTrip.fare)}</Text>}
                        </View>
                      )}
                    </View>
                  )}
                  {tripPickerOpen && (
                    <View style={styles.pickerList}>
                      {recentTrips.map((trip, index) => (
                        <Pressable
                          key={trip.id}
                          accessibilityRole="button"
                          onPress={() => pickTrip(trip.id)}
                          style={[styles.pickerRow, index > 0 && styles.pickerRowDivider]}
                        >
                          <Avatar name={trip.passengerName ?? undefined} size="xs" />
                          <View style={styles.tripTopBody}>
                            <Text style={styles.tripName} numberOfLines={1}>
                              {trip.passengerName || c.passengerFallback}
                            </Text>
                            <Text style={styles.tripSub} numberOfLines={1}>
                              {tripStamp(trip.date)}
                            </Text>
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: noTrip }}
                    onPress={chooseNoTrip}
                    style={[styles.altRow, noTrip && styles.altRowActive]}
                  >
                    <View style={[styles.radio, noTrip && styles.radioActive]}>{noTrip && <View style={styles.radioDot} />}</View>
                    <View style={styles.altBody}>
                      <Text style={styles.tripName}>{c.notAboutTrip}</Text>
                      <Text style={styles.tripSub}>{c.notAboutTripSub}</Text>
                    </View>
                  </Pressable>
                </View>

                <View style={styles.block}>
                  <Text style={styles.question}>{c.whatAbout}</Text>
                  <View style={styles.categoryGrid}>
                    {[0, 2, 4].map((start) => (
                      <View key={start} style={styles.categoryRow}>
                        {CATEGORIES.slice(start, start + 2).map((item) => (
                          <SelectTile
                            key={item.value}
                            role="radio"
                            label={CATEGORY_LABEL[item.value]}
                            icon={item.icon}
                            idleTone={item.tone}
                            accent="navy"
                            selected={category === item.value}
                            onPress={() => handleCategory(item.value)}
                          />
                        ))}
                      </View>
                    ))}
                  </View>
                </View>
              </>
            ) : (
              category && (
                <>
                  <Pressable accessibilityRole="button" onPress={() => setView('step1')} style={styles.summaryChip}>
                    <IconTile icon={categoryMeta!.icon} tone={categoryMeta!.tone} size={30} />
                    <Text style={styles.summaryText} numberOfLines={1}>
                      {selectedTrip
                        ? `${CATEGORY_LABEL[category]} · ${selectedTrip.passengerName || c.passengerFallback}, ${shortDate(selectedTrip.date)}`
                        : CATEGORY_LABEL[category]}
                    </Text>
                    <Ionicons name="pencil" size={15} color={colors.inkSoft} />
                  </Pressable>

                  <View>
                    <Text style={styles.fieldLabel}>{c.subjectHeading}</Text>
                    <TextField placeholder={c.subjectPlaceholder} value={subject} onChangeText={setSubject} />
                    <View style={styles.suggestions}>
                      {SUGGESTIONS[category].map((suggestion) => {
                        const active = subject === suggestion;
                        return (
                          <Pressable
                            key={suggestion}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            onPress={() => setSubject(suggestion)}
                            style={[styles.suggestion, active && styles.suggestionActive]}
                          >
                            <Text style={[styles.suggestionText, active && styles.suggestionTextActive]}>{suggestion}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  <View>
                    <Text style={styles.fieldLabel}>{c.whatHappened}</Text>
                    <Textarea placeholder={c.messagePlaceholder} value={message} onChangeText={setMessage} />
                    <Text style={styles.hint}>{HINT[category]}</Text>
                  </View>

                  <View>
                    <View style={styles.photosHeader}>
                      <Text style={[styles.fieldLabel, { marginBottom: 0 }]}>{c.photosOptional}</Text>
                      <View style={styles.counterPill}>
                        <Text style={styles.counterText}>{`${evidenceUris.length}/${MAX_EVIDENCE_PHOTOS}`}</Text>
                      </View>
                    </View>
                    <View style={styles.photoRow}>
                      {evidenceUris.map((uri, index) => (
                        <View key={uri} style={styles.thumbWrap}>
                          <Image source={{ uri }} style={styles.thumb} />
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={c.removePhotoAccessibilityLabel}
                            hitSlop={8}
                            onPress={() => setEvidenceUris((prev) => prev.filter((_, i) => i !== index))}
                            style={styles.thumbRemove}
                          >
                            <Ionicons name="close" size={14} color={colors.white} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                    {evidenceUris.length < MAX_EVIDENCE_PHOTOS && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={c.addEvidencePhotoAccessibilityLabel}
                        onPress={addEvidence}
                        style={[styles.photoSlot, evidenceUris.length > 0 && { marginTop: 8 }]}
                      >
                        <Ionicons name="camera-outline" size={22} color={colors.accentBlue} />
                        <Text style={styles.photoSlotText}>
                          <Text style={styles.photoSlotStrong}>{c.addPhoto}</Text> — {c.addPhotoHint}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </>
              )
            )}
          </ScrollView>

          <View style={[styles.bottomBar, { paddingBottom: Math.max(14, insets.bottom + 6) }]}>
            {submitError && view === 'step2' && (
              <View style={styles.errorBlock}>
                <Text style={styles.errorBlockText}>{submitError}</Text>
              </View>
            )}
            {view === 'step1' ? (
              <Button label={c.continue} fullWidth disabled={!category} onPress={() => setView('step2')} />
            ) : (
              <Button label={c.submit} fullWidth disabled={!canSubmit} loading={submitting} onPress={handleSubmit} />
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ---------------------------------------------------------------- home
  return (
    <View style={styles.container}>
      <NavyBandHeader
        title={c.title}
        titleSize="xl"
        onBack={() => router.back()}
        backAccessibilityLabel={c.backA11y}
        topInset={insets.top}
        paddingBottom={20}
        elevated
      >
        <View style={styles.bandBody}>
          <Text style={styles.bandSub}>{c.homeSub}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Text style={styles.statNumber}>{openCases}</Text>
              <Text style={styles.statCaption}>{c.statOpen}</Text>
            </View>
            <View style={[styles.statCol, styles.statDivider]}>
              <Text style={styles.statNumber}>{closedCases}</Text>
              <Text style={styles.statCaption}>{c.statClosed}</Text>
            </View>
          </View>
        </View>
      </NavyBandHeader>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        {complaintsError && <Text style={styles.error}>{complaintsError}</Text>}

        <View style={styles.primaryShadow}>
          <Pressable accessibilityRole="button" onPress={() => startFiling()} style={styles.primaryCard}>
            <View style={styles.primaryTile}>
              <Ionicons name="add" size={26} color={colors.white} />
            </View>
            <View style={styles.primaryBody}>
              <Text style={styles.primaryTitle}>{c.reportCardTitle}</Text>
              <Text style={styles.primarySub}>{c.reportCardSub}</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={colors.accentBlue} />
          </Pressable>
        </View>

        <View>
          <Text style={styles.sectionLabel}>{c.commonIssues}</Text>
          <View style={styles.issueGrid}>
            {CATEGORIES.slice(0, 3).map((item) => (
              <Pressable key={item.value} accessibilityRole="button" onPress={() => startFiling(item.value)} style={styles.issueCard}>
                <IconTile icon={item.icon} tone={item.tone} size={34} />
                <Text style={styles.issueLabel}>{CATEGORY_LABEL[item.value]}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {complaints.length > 0 ? (
          <View>
            <Text style={styles.sectionLabel}>{c.yourCases}</Text>
            <View style={styles.caseList}>
              {complaints.map((row) => {
                const step = complaintStepIndex(row.dbStatus);
                const trip = row.rideRequestId ? trips.find((item) => item.id === row.rideRequestId) : undefined;
                return (
                  <Pressable
                    key={row.id}
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: '/complaints/[id]', params: { id: row.id } })}
                    style={styles.caseCard}
                  >
                    <View style={styles.caseTop}>
                      <Text style={styles.caseMeta} numberOfLines={1}>
                        {`${CATEGORY_LABEL[row.category]} · ${shortDate(row.createdAt)}`}
                      </Text>
                      <StatusPill
                        label={step === 0 ? c.statusOpen : step === 1 ? c.statusUnderReview : c.statusClosed}
                        tone={step === 2 ? 'green' : 'navy'}
                      />
                    </View>
                    <Text style={styles.caseSubject}>{row.subject}</Text>
                    <ProgressSegments colors={barColors(step)} />
                    {trip && (
                      <View style={styles.caseFooter}>
                        <Text style={styles.caseFooterText} numberOfLines={1}>
                          {[trip.passengerName || c.passengerFallback, trip.pickup && trip.dropoff ? `${trip.pickup} → ${trip.dropoff}` : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color={colors.inkSoft} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : (
          !loading && <EmptyState title={c.noComplaintsTitle} message={c.noComplaintsMessage} />
        )}
      </ScrollView>
    </View>
  );
}

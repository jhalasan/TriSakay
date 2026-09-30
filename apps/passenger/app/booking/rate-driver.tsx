import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  Text,
  UIManager,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button, NavyBandHeader, SelectTile, StarPicker, Textarea, colors } from '@trisakay/ui';
import { RATING_TAGS, submitRating, type RatingTag } from '@trisakay/services';
import { REPORT_PROMPT_MAX_SCORE, pruneTagsForScore, scoreTone, tagsForScore, type ScoreTone } from '@trisakay/shared';
import { useBookingStore } from '../../src/store/useBookingStore';
import { useTranslation } from '../../src/hooks/useTranslation';
import { formatCurrency } from '../../src/utils/currency';
import { styles } from '../../src/styles/booking/rate-driver.styles';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TAG_ICON: Record<RatingTag, IconName> = {
  friendly: 'person',
  safe_driving: 'shield-checkmark',
  clean_vehicle: 'bicycle',
  on_time: 'time',
  late: 'time',
  rude: 'person',
  unsafe_driving: 'alert-circle',
  poor_vehicle_condition: 'construct',
};

const TONE_COLORS: Record<ScoreTone, { star: string; word: string }> = {
  danger: { star: colors.danger, word: colors.dangerPressed },
  navy: { star: colors.accentBlue, word: colors.accentBlue },
  green: { star: colors.accentGreen, word: colors.accentGreenPressed },
};

export default function RateDriverScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { initialScore } = useLocalSearchParams<{ initialScore?: string }>();
  const driver = useBookingStore((state) => state.driver);
  const rideRequestId = useBookingStore((state) => state.rideRequestId);
  const fare = useBookingStore((state) => state.fare);
  const distanceKm = useBookingStore((state) => state.distanceKm);
  const paymentMethod = useBookingStore((state) => state.paymentMethod);
  const reset = useBookingStore((state) => state.reset);
  const t = useTranslation();

  const paymentLabel = paymentMethod === 'gcash' ? t.common.gcash : t.common.cash;
  const summaryParts = [
    fare !== null && `${formatCurrency(fare)} ${t.rateDriver.paidVia} ${paymentLabel}`,
    distanceKm !== null && `${distanceKm.toFixed(1)} km`,
  ].filter(Boolean);

  const parsedInitial = Number(initialScore);
  const [rating, setRating] = useState(parsedInitial >= 1 && parsedInitial <= 5 ? Math.round(parsedInitial) : 0);
  const [comment, setComment] = useState('');
  const [commentExpanded, setCommentExpanded] = useState(false);
  const [selectedTags, setSelectedTags] = useState<RatingTag[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const canRate = Boolean(driver?.id) && Boolean(rideRequestId);
  const hasScore = rating > 0;
  const lowScore = hasScore && rating <= 3;
  const compact = lowScore || keyboardOpen;
  const tone = hasScore ? scoreTone(rating) : 'navy';
  const toneColors = TONE_COLORS[tone];
  const positive = rating >= 4;
  const commentOpen = lowScore || commentExpanded;
  const firstName = driver?.name?.trim().split(/\s+/)[0] ?? t.rateDriver.yourDriverFallback;

  const TAG_LABEL: Record<RatingTag, string> = {
    friendly: t.rateDriver.tagFriendly,
    safe_driving: t.rateDriver.tagSafeDriving,
    clean_vehicle: t.rateDriver.tagCleanVehicle,
    on_time: t.rateDriver.tagOnTime,
    late: t.rateDriver.tagLate,
    rude: t.rateDriver.tagRude,
    unsafe_driving: t.rateDriver.tagUnsafeDriving,
    poor_vehicle_condition: t.rateDriver.tagPoorVehicleCondition,
  };
  const SCORE_WORD = ['', t.rateDriver.scoreTerrible, t.rateDriver.scorePoor, t.rateDriver.scoreOkay, t.rateDriver.scoreGood, t.rateDriver.scoreExcellent];

  // The current score's side of the split, in the design's order, limited to values the enum actually has.
  const visibleTags = (tagsForScore(rating || 5) as readonly RatingTag[]).filter((tag) => RATING_TAGS.includes(tag));

  function animate() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }

  function toggleTag(tag: RatingTag) {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]));
  }

  function finish() {
    reset();
    router.replace('/(tabs)/home');
  }

  function handleRatingChange(value: number) {
    animate();
    setSubmitError(null);
    setRating(value);
    // Switching between the positive and negative sets clears tags that no longer apply.
    setSelectedTags((prev) => pruneTagsForScore(prev, value));
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
      tags: selectedTags,
    });

    setSubmitting(false);

    if (error) {
      setSubmitError(error);
      return;
    }

    finish();
  }

  // A push (not replace) keeps this screen — and the rating draft — mounted underneath.
  function handleReport() {
    router.push({ pathname: '/complaints/new', params: { rideRequestId: rideRequestId! } });
  }

  const tagRows: RatingTag[][] = [];
  for (let i = 0; i < visibleTags.length; i += 2) tagRows.push(visibleTags.slice(i, i + 2));

  const skipLink = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.rateDriver.skipForNow}
      onPress={finish}
      style={styles.skipButton}
    >
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.3} style={styles.skipText}>{compact ? t.rateDriver.skipShort : t.rateDriver.skipForNow}</Text>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <NavyBandHeader
        topInset={insets.top}
        hideMotif={compact}
        paddingBottom={compact ? 18 : 22}
        style={compact ? styles.bandCompact : styles.bandLarge}
      >
        {compact ? (
          <View style={styles.driverRow}>
            <Avatar name={driver?.name} size="md" />
            <View style={styles.driverText}>
              <Text style={styles.nameCompact} numberOfLines={1}>
                {driver?.name ?? t.rateDriver.yourDriverFallback}
              </Text>
              {summaryParts.length > 0 && <Text style={styles.fareLineCompact}>{summaryParts.join(' · ')}</Text>}
            </View>
            {skipLink}
          </View>
        ) : (
          <>
            <View style={styles.topRow}>
              <Text style={styles.eyebrow}>{t.rateDriver.tripCompletedEyebrow}</Text>
              {skipLink}
            </View>
            <View style={styles.driverRow}>
              <Avatar name={driver?.name} size="lg" />
              <View style={styles.driverText}>
                <Text style={styles.nameLarge} numberOfLines={1}>
                  {driver?.name ?? t.rateDriver.yourDriverFallback}
                </Text>
                {summaryParts.length > 0 && <Text style={styles.fareLine}>{summaryParts.join(' · ')}</Text>}
              </View>
            </View>
          </>
        )}
      </NavyBandHeader>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.flex} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {canRate ? (
            hasScore ? (
              <View style={styles.body}>
                <View style={styles.starsBlock}>
                  <StarPicker
                    value={rating}
                    size={44}
                    gap={10}
                    activeColor={toneColors.star}
                    accessibilityLabel={t.rateDriver.ratingA11y}
                    starLabel={(n) => t.rateDriver.starA11y.replace('{n}', String(n))}
                    onChange={handleRatingChange}
                  />
                  <Text style={[styles.scoreWord, { color: toneColors.word }]}>{SCORE_WORD[rating]}</Text>
                </View>

                <View>
                  <Text style={styles.sectionLabel}>{positive ? t.rateDriver.tagsLabel : t.rateDriver.tagsNegativeLabel}</Text>
                  <View style={styles.tagGrid}>
                    {tagRows.map((row) => (
                      <View key={row[0]} style={styles.tagRow}>
                        {row.map((tag) => (
                          <SelectTile
                            key={tag}
                            label={TAG_LABEL[tag]}
                            icon={TAG_ICON[tag]}
                            selected={selectedTags.includes(tag)}
                            accent={positive ? 'green' : 'red'}
                            onPress={() => toggleTag(tag)}
                          />
                        ))}
                      </View>
                    ))}
                  </View>
                </View>

                {commentOpen ? (
                  <Textarea
                    label={t.rateDriver.commentLabel}
                    helperText={t.hints.rateComment}
                    placeholder={t.rateDriver.commentPlaceholder}
                    value={comment}
                    autoFocus={!lowScore && commentExpanded}
                    onChangeText={handleCommentChange}
                  />
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      animate();
                      setCommentExpanded(true);
                    }}
                    style={styles.commentCollapsed}
                  >
                    <Ionicons name="pencil" size={16} color={colors.accentBlue} />
                    <Text style={styles.commentCollapsedLabel}>{t.rateDriver.addComment}</Text>
                    <Text style={styles.commentCollapsedHint}>{t.rateDriver.optionalTag}</Text>
                  </Pressable>
                )}

                {rating <= REPORT_PROMPT_MAX_SCORE && (
                  <Pressable accessibilityRole="button" onPress={handleReport} style={styles.reportCard}>
                    <Ionicons name="flag" size={18} color={colors.dangerPressed} />
                    <View style={styles.reportText}>
                      <Text style={styles.reportTitle}>{t.rateDriver.reportTitle}</Text>
                      <Text style={styles.reportBody}>{t.rateDriver.reportBody}</Text>
                    </View>
                    <Text style={styles.reportAction}>{t.rateDriver.reportAction}</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <View style={styles.emptyBody}>
                <Text style={styles.emptyTitle}>{t.rateDriver.howWasYourRide}</Text>
                <StarPicker
                  value={0}
                  size={44}
                  gap={10}
                  emptyColor={colors.line}
                  accessibilityLabel={t.rateDriver.ratingA11y}
                  starLabel={(n) => t.rateDriver.starA11y.replace('{n}', String(n))}
                  onChange={handleRatingChange}
                />
                <Text style={styles.emptyHint}>{t.rateDriver.tapAStar.replace('{name}', firstName)}</Text>
              </View>
            )
          ) : (
            <View style={styles.body}>
              <Text style={styles.fallbackNote}>{t.rateDriver.couldNotConfirmDriver}</Text>
            </View>
          )}
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: Math.max(14, insets.bottom + 6) }]}>
          {submitError && <Text style={styles.errorText}>{submitError}</Text>}
          {canRate ? (
            <Button label={t.rateDriver.submitRating} fullWidth disabled={rating === 0} loading={submitting} onPress={handleSubmit} />
          ) : (
            <Button label={t.rateDriver.continue} fullWidth onPress={finish} />
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMyComplaint, type ComplaintDetailRow } from '@trisakay/services';
import { complaintStepIndex } from '@trisakay/shared';
import { Avatar, EmptyState, IconTile, NavyBandHeader, Spinner, StageTimeline, StatusPill, colors, type TimelineStage } from '@trisakay/ui';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useHistoryStore } from '../../src/store/useHistoryStore';
import { formatCurrency } from '../../src/utils/currency';
import { interpolate } from '../../src/utils/interpolate';
import { styles } from '../../src/styles/complaints.styles';

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

/** Read-only case page for one of the driver's own complaints: where it stands, what happens next, and the report they filed. */
export default function ComplaintCaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  const c = t.driver.complaints;
  const trips = useHistoryStore((state) => state.trips);
  const loadTrips = useHistoryStore((state) => state.load);
  const [complaint, setComplaint] = useState<ComplaintDetailRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMyComplaint(id).then(({ data, error: loadError }) => {
      if (cancelled) return;
      setComplaint(data);
      setError(loadError);
      setLoading(false);
    });
    void loadTrips();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const CATEGORY_LABEL: Record<string, string> = {
    fare: c.categoryFareDispute,
    conduct: c.categoryConduct,
    safety: c.categorySafety,
    low_rating: c.categoryLowRating,
    vehicle_condition: c.categoryVehicleCondition,
    other: c.categoryOther,
  };

  if (loading || !complaint) {
    return (
      <View style={styles.container}>
        <NavyBandHeader onBack={() => router.back()} backAccessibilityLabel={c.backA11y} topInset={insets.top} paddingBottom={20} title={c.title} />
        {loading ? (
          <Spinner size="large" />
        ) : (
          <EmptyState title={c.caseNotFound} message={error ?? ''} />
        )}
      </View>
    );
  }

  const step = complaintStepIndex(complaint.status);
  const trip = complaint.rideRequestId ? trips.find((item) => item.id === complaint.rideRequestId) : undefined;
  const stages: TimelineStage[] = [
    { title: c.stageOpen, date: shortDate(complaint.createdAt), state: step === 0 ? 'current' : 'done' },
    { title: c.stageReview, state: step === 0 ? 'pending' : step === 1 ? 'current' : 'done' },
    { title: c.stageClosed, date: complaint.resolvedAt ? shortDate(complaint.resolvedAt) : undefined, state: step === 2 ? 'done' : 'pending' },
  ];

  const now =
    step === 0
      ? { title: c.nowOpenTitle, body: c.nowOpenBody }
      : step === 1
        ? { title: c.nowReviewTitle, body: c.nowReviewBody }
        : { title: c.nowClosedTitle, body: complaint.resolutionNotes?.trim() || c.nowClosedBody };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}>
        <NavyBandHeader onBack={() => router.back()} backAccessibilityLabel={c.backA11y} topInset={insets.top} paddingBottom={22}>
          <View style={styles.caseBand}>
            <Text style={styles.caseEyebrow}>{CATEGORY_LABEL[complaint.category] ?? complaint.category}</Text>
            <Text style={styles.caseTitle}>{complaint.subject}</Text>
            <View style={styles.caseStatusRow}>
              <StatusPill
                label={step === 0 ? c.statusOpen : step === 1 ? c.statusUnderReview : c.statusClosed}
                tone={step === 2 ? 'green' : 'navy'}
              />
              <Text style={styles.caseFiledText}>{interpolate(c.caseFiled, { date: shortDate(complaint.createdAt) })}</Text>
            </View>
          </View>
        </NavyBandHeader>

        <View style={[styles.scrollContent, { paddingTop: 16 }]}>
          <View style={styles.nowCard}>
            <IconTile icon="time" tone="navy" size={38} />
            <View style={styles.nowBody}>
              <Text style={styles.nowEyebrow}>{c.nowEyebrow}</Text>
              <Text style={styles.nowTitle}>{now.title}</Text>
              <Text style={styles.nowText}>{now.body}</Text>
            </View>
          </View>

          <View>
            <Text style={styles.sectionLabel}>{c.progressEyebrow}</Text>
            <View style={styles.reportCard}>
              <StageTimeline stages={stages} />
            </View>
          </View>

          <View>
            <Text style={styles.sectionLabel}>{c.yourReport}</Text>
            <View style={styles.reportCard}>
              <Text style={styles.reportText}>{complaint.message}</Text>
              {complaint.attachmentCount > 0 && (
                <Text style={styles.warning}>{interpolate(c.photosAttached, { n: complaint.attachmentCount })}</Text>
              )}
            </View>
          </View>

          {trip && (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/history/[id]', params: { id: trip.id } })}
              style={styles.linkedRow}
            >
              <Avatar name={trip.passengerName ?? undefined} source={trip.passengerAvatarUrl ? { uri: trip.passengerAvatarUrl } : undefined} size="sm" />
              <View style={styles.linkedBody}>
                <Text style={styles.linkedTitle} numberOfLines={1}>
                  {`${trip.passengerName || c.passengerFallback} · ${shortDate(trip.date)}`}
                </Text>
                <Text style={styles.linkedSub} numberOfLines={1}>
                  {[trip.pickup && trip.dropoff ? `${trip.pickup} → ${trip.dropoff}` : null, trip.fare !== null ? formatCurrency(trip.fare) : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.inkSoft} />
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

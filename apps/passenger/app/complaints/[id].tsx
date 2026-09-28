import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMyComplaint, getPassengerRideReceipt, type ComplaintCategory, type ComplaintDbStatus, type PassengerTripHistoryItem } from '@trisakay/services';
import { Avatar, EmptyState, Spinner, colors, useTutorialTarget } from '@trisakay/ui';
import { IconTile, NavyBand, StageTimeline, StatusChip, type TimelineStage } from '../../src/components/complaints';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useComplaintStatusTutorialDemo } from '../../src/hooks/useTutorialDemoState';
import { getComplaintStageStates } from '../../src/utils/complaintStages';
import { isTerminalStatus } from '../../src/utils/complaintStatus';
import { getReferenceCode } from '../../src/utils/reference';
import { styles } from '../../src/styles/complaints/detail.styles';

interface ComplaintStatusData {
  id: string;
  subject: string;
  status: ComplaintDbStatus;
  category: ComplaintCategory;
  createdAt: string;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  rideRequestId: string | null;
  mediationMeetingAt: string | null;
  mediationLocation: string | null;
  attachmentCount: number;
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

function formatDateTime(iso: string) {
  const date = new Date(iso);
  const day = date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  const time = date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
  return `${day}, ${time}`;
}

export default function ComplaintStatusScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslation();
  const tutorialDemo = useComplaintStatusTutorialDemo();
  const progressCardTarget = useTutorialTarget('progress-card');

  const STATUS_LABEL: Record<ComplaintDbStatus, string> = {
    open: t.complaints.statusOpen,
    under_review: t.complaints.statusUnderReview,
    escalated: t.complaints.statusEscalated,
    mediation_scheduled: t.complaints.statusMediationScheduled,
    resolved: t.complaints.statusResolved,
    dismissed: t.complaints.statusDismissed,
  };
  const CATEGORY_LABEL: Record<ComplaintCategory, string> = {
    fare: t.complaints.categoryFare,
    conduct: t.complaints.categoryConduct,
    safety: t.complaints.categorySafety,
    low_rating: t.complaints.categoryLowRating,
    vehicle_condition: t.complaints.categoryVehicleCondition,
    other: t.complaints.categoryOther,
  };

  const [loading, setLoading] = useState(!tutorialDemo.active);
  const [complaint, setComplaint] = useState<ComplaintStatusData | null>(null);

  useEffect(() => {
    if (tutorialDemo.active) {
      setComplaint({
        id: tutorialDemo.data.id,
        subject: tutorialDemo.data.subject,
        status: tutorialDemo.data.status,
        category: 'fare',
        createdAt: new Date().toISOString(),
        resolvedAt: null,
        resolutionNotes: null,
        rideRequestId: null,
        mediationMeetingAt: null,
        mediationLocation: null,
        attachmentCount: 0,
      });
      setLoading(false);
      return;
    }
    if (!id) return;

    let cancelled = false;
    setLoading(true);
    getMyComplaint(id).then(({ data }) => {
      if (cancelled) return;
      setComplaint(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tutorialDemo.active]);

  const backTile = (
    <Pressable style={styles.backTile} onPress={() => router.back()} accessibilityRole="button">
      <Ionicons name="chevron-back" size={18} color={colors.white} />
    </Pressable>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <NavyBand>
          <View style={styles.bandRow}>
            {backTile}
            <View style={styles.skeletonCol}>
              <View style={styles.skeletonBarSmall} />
              <View style={styles.skeletonBarLarge} />
            </View>
          </View>
        </NavyBand>
        <View style={styles.loadingWrap}>
          <Spinner size="small" />
        </View>
      </SafeAreaView>
    );
  }

  if (!complaint) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <NavyBand>
          <View style={styles.bandRow}>
            {backTile}
            <View style={styles.bandTextCol}>
              <Text style={styles.eyebrow}>{t.complaints.notFoundTitle}</Text>
            </View>
          </View>
        </NavyBand>
        <EmptyState title={t.complaints.notFoundTitle} message={t.complaints.notFoundMessage} />
      </SafeAreaView>
    );
  }

  const terminal = isTerminalStatus(complaint.status);
  const stageStates = getComplaintStageStates(complaint.status);
  const reference = getReferenceCode(complaint.id);

  const stages: TimelineStage[] = [
    {
      title: t.complaints.stageReceivedTitle,
      body: t.complaints.stageReceivedBody,
      date: formatDateTime(complaint.createdAt),
      state: 'done',
    },
    {
      title: t.complaints.stageUnderReviewTitleShort,
      body: complaint.status === 'mediation_scheduled' ? t.complaints.stageMediationBody : t.complaints.stageUnderReviewBodyShort,
      state: stageStates.underReview,
    },
    {
      title: t.complaints.stageResolutionTitle,
      body: t.complaints.stageResolutionBody,
      date: complaint.resolvedAt ? formatShortDate(complaint.resolvedAt) : undefined,
      state: stageStates.resolution,
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <NavyBand>
        <View style={styles.bandRow}>
          {backTile}
          <View style={styles.bandTextCol}>
            <Text style={styles.eyebrow}>
              {t.complaints.referencePrefix} #{reference}
            </Text>
            <Text style={styles.subject}>{complaint.subject}</Text>
            <View style={styles.badgeRow}>
              <StatusChip status={complaint.status} label={STATUS_LABEL[complaint.status]} />
              <Text style={styles.filedText}>
                {t.complaints.filedPrefix} {formatShortDate(complaint.createdAt)} · {CATEGORY_LABEL[complaint.category]}
              </Text>
            </View>
          </View>
        </View>
      </NavyBand>

      <ScrollView contentContainerStyle={styles.content}>
        {!terminal ? (
          <NowCard
            status={complaint.status}
            mediationMeetingAt={complaint.mediationMeetingAt}
            mediationLocation={complaint.mediationLocation}
            t={t}
          />
        ) : (
          <DecisionCard status={complaint.status} resolutionNotes={complaint.resolutionNotes} t={t} />
        )}

        <View {...progressCardTarget} style={styles.progressCard}>
          <Text style={styles.sectionLabel}>{t.complaints.progress}</Text>
          <StageTimeline stages={stages} compact={terminal} />
        </View>

        <DetailsCard
          rideRequestId={tutorialDemo.active ? null : complaint.rideRequestId}
          attachmentCount={complaint.attachmentCount}
          showEvidence={!terminal}
          t={t}
          onPressTrip={(rideId) => router.push(`/history/${rideId}`)}
        />

        {terminal && (
          <View style={styles.followUpRow}>
            <Ionicons name="information-circle-outline" size={16} color={colors.inkSoft} />
            <Text style={styles.followUpText}>
              {t.complaints.stillNotRight}{' '}
              <Text
                style={styles.followUpLink}
                onPress={() => router.push({ pathname: '/complaints/new', params: { category: complaint.category } })}
              >
                {t.complaints.fileFollowUp}
              </Text>{' '}
              {t.complaints.andQuoteRef.replace('{ref}', reference ?? '')}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function NowCard({
  status,
  mediationMeetingAt,
  mediationLocation,
  t,
}: {
  status: ComplaintDbStatus;
  mediationMeetingAt: string | null;
  mediationLocation: string | null;
  t: ReturnType<typeof useTranslation>;
}) {
  // README §4.1: use the real meeting time/place once the complaint has one, otherwise the generic fallback.
  const mediationBody =
    status === 'mediation_scheduled' && mediationMeetingAt
      ? `${formatDateTime(mediationMeetingAt)}${mediationLocation ? ` · ${mediationLocation}` : ''}`
      : t.complaints.nowMediationBody;

  const copy: Record<ComplaintDbStatus, { title: string; body: string }> = {
    open: { title: t.complaints.nowOpenTitle, body: t.complaints.nowOpenBody },
    under_review: { title: t.complaints.nowUnderReviewTitle, body: t.complaints.nowUnderReviewBody },
    mediation_scheduled: { title: t.complaints.nowMediationTitle, body: mediationBody },
    escalated: { title: t.complaints.nowEscalatedTitle, body: t.complaints.nowEscalatedBody },
    resolved: { title: '', body: '' },
    dismissed: { title: '', body: '' },
  };
  const isEscalated = status === 'escalated';
  return (
    <View style={[styles.nowCard, isEscalated && styles.nowCardEscalated]}>
      <IconTile size={38} backgroundColor={isEscalated ? colors.dangerSoft : colors.accentBlueSoft}>
        <Ionicons name="time" size={18} color={isEscalated ? colors.dangerPressed : colors.accentBluePressed} />
      </IconTile>
      <View style={styles.nowTextSlot}>
        <Text style={[styles.nowEyebrow, isEscalated && styles.nowEyebrowEscalated]}>{t.complaints.nowLabel}</Text>
        <Text style={styles.nowTitle}>{copy[status].title}</Text>
        <Text style={styles.nowBody}>{copy[status].body}</Text>
      </View>
    </View>
  );
}

function DecisionCard({
  status,
  resolutionNotes,
  t,
}: {
  status: ComplaintDbStatus;
  resolutionNotes: string | null;
  t: ReturnType<typeof useTranslation>;
}) {
  const resolved = status === 'resolved';
  return (
    <View style={[styles.decisionCard, { backgroundColor: resolved ? colors.accentGreenSoft : colors.fill }]}>
      <IconTile size={38} backgroundColor={resolved ? colors.accentGreen : colors.lineStrong}>
        <Ionicons name={resolved ? 'checkmark' : 'close'} size={18} color={colors.white} />
      </IconTile>
      <View style={styles.nowTextSlot}>
        <Text style={[styles.nowEyebrow, { color: resolved ? colors.accentGreenPressed : colors.inkSoft }]}>
          {t.complaints.decisionLabel}
        </Text>
        <Text style={styles.nowTitle}>{resolved ? t.complaints.decisionResolvedTitle : t.complaints.decisionDismissedTitle}</Text>
        {resolutionNotes && <Text style={styles.nowBody}>{resolutionNotes}</Text>}
      </View>
    </View>
  );
}

/**
 * README §4.4. The trip row needs the ride summary getMyComplaint doesn't
 * return itself — reuses getPassengerRideReceipt (already scoped to the
 * caller's own rides) rather than adding a new RPC or join.
 */
function DetailsCard({
  rideRequestId,
  attachmentCount,
  showEvidence,
  t,
  onPressTrip,
}: {
  rideRequestId: string | null;
  attachmentCount: number;
  showEvidence: boolean;
  t: ReturnType<typeof useTranslation>;
  onPressTrip: (rideId: string) => void;
}) {
  const [ride, setRide] = useState<PassengerTripHistoryItem | null>(null);

  useEffect(() => {
    if (!rideRequestId) {
      setRide(null);
      return;
    }
    let cancelled = false;
    getPassengerRideReceipt(rideRequestId).then(({ data }) => {
      if (!cancelled) setRide(data);
    });
    return () => {
      cancelled = true;
    };
  }, [rideRequestId]);

  if (!rideRequestId && !showEvidence) return null;

  return (
    <View style={styles.detailsCard}>
      {rideRequestId && ride && (
        <Pressable style={styles.detailsRow} onPress={() => onPressTrip(rideRequestId)} accessibilityRole="button">
          <Avatar name={ride.driverName ?? undefined} source={ride.driverAvatarUrl ? { uri: ride.driverAvatarUrl } : undefined} size="sm" />
          <View style={styles.detailsTextSlot}>
            <Text style={styles.detailsTitle} numberOfLines={1}>
              {ride.driverName || 'Driver'} · {formatShortDate(ride.date)}
            </Text>
            <Text style={styles.detailsSub} numberOfLines={1}>
              {ride.pickup} → {ride.dropoff}
              {ride.fare ? ` · ₱${ride.fare}` : ''}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={colors.inkSoft} />
        </Pressable>
      )}
      {rideRequestId && ride && showEvidence && <View style={styles.detailsDivider} />}
      {showEvidence && (
        <View style={styles.detailsRow}>
          <IconTile size={32} backgroundColor={colors.accentBlueSoft}>
            <Ionicons name="image-outline" size={16} color={colors.accentBluePressed} />
          </IconTile>
          <View style={styles.detailsTextSlot}>
            <Text style={styles.detailsTitle}>
              {attachmentCount === 0
                ? t.complaints.noPhotosYet
                : attachmentCount === 1
                  ? t.complaints.photoAttachedOne
                  : t.complaints.photosAttachedMany.replace('{n}', String(attachmentCount))}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

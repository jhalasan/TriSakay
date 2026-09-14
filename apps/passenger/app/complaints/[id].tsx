import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { getMyComplaint, type ComplaintCategory, type ComplaintDbStatus } from '@trisakay/services';
import { Badge, Card, EmptyState, Spinner, useTutorialTarget, type BadgeTone } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useComplaintStatusTutorialDemo } from '../../src/hooks/useTutorialDemoState';
import { styles } from '../../src/styles/complaints/detail.styles';

interface ComplaintStatusData {
  id: string;
  subject: string;
  status: ComplaintDbStatus;
  category: ComplaintCategory;
  filedLabel: string;
  receivedAtLabel: string;
}

type StageState = 'done' | 'current' | 'pending';

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
  const t = useTranslation();
  const tutorialDemo = useComplaintStatusTutorialDemo();
  const progressCardTarget = useTutorialTarget('progress-card');

  const STATUS_TONE: Record<ComplaintDbStatus, BadgeTone> = {
    open: 'blue',
    under_review: 'blue',
    mediation_scheduled: 'blue',
    escalated: 'danger',
    resolved: 'green',
    dismissed: 'neutral',
  };
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
        filedLabel: tutorialDemo.data.filedLabel,
        receivedAtLabel: tutorialDemo.data.receivedAtLabel,
      });
      setLoading(false);
      return;
    }
    if (!id) return;

    let cancelled = false;
    setLoading(true);
    getMyComplaint(id).then(({ data }) => {
      if (cancelled) return;
      setComplaint(
        data
          ? {
              id: data.id,
              subject: data.subject,
              status: data.status,
              category: data.category,
              filedLabel: formatShortDate(data.createdAt),
              receivedAtLabel: formatDateTime(data.createdAt),
            }
          : null
      );
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tutorialDemo.active]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t.complaints.detailTitle} />
        <View style={styles.loadingWrap}>
          <Spinner size="small" />
        </View>
      </View>
    );
  }

  if (!complaint) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t.complaints.detailTitle} />
        <EmptyState title={t.complaints.notFoundTitle} message={t.complaints.notFoundMessage} />
      </View>
    );
  }

  const underReviewDone = complaint.status !== 'open';
  const resolutionDone = complaint.status === 'resolved' || complaint.status === 'dismissed';
  const underReviewState: StageState = resolutionDone ? 'done' : underReviewDone ? 'current' : 'pending';
  const resolutionState: StageState = resolutionDone ? 'done' : 'pending';

  const stages: Array<{ title: string; body: string; state: StageState }> = [
    { title: t.complaints.stageReceivedTitle, body: `${complaint.receivedAtLabel} · ${t.complaints.stageReceivedBody}`, state: 'done' },
    { title: t.complaints.stageUnderReviewTitle, body: t.complaints.stageUnderReviewBody, state: underReviewState },
    { title: t.complaints.stageResolutionTitle, body: t.complaints.stageResolutionBody, state: resolutionState },
  ];

  const reference = complaint.id.replace(/[^0-9A-Za-z]/g, '').slice(-4).toUpperCase();

  return (
    <View style={styles.container}>
      <ScreenHeader title={t.complaints.detailTitle} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>
          {t.complaints.referencePrefix} #{reference}
        </Text>
        <Text style={styles.subject}>{complaint.subject}</Text>
        <View style={styles.badgeRow}>
          <Badge label={STATUS_LABEL[complaint.status]} tone={STATUS_TONE[complaint.status]} />
          <Text style={styles.filedText}>
            {t.complaints.filedPrefix} {complaint.filedLabel} · {CATEGORY_LABEL[complaint.category]}
          </Text>
        </View>

        {/* Card doesn't forward refs, so the tutorial target (which needs a real native-view ref for measureInWindow) wraps it in a plain View. */}
        <View {...progressCardTarget}>
          <Card variant="raised" style={styles.progressCard}>
            <Text style={styles.sectionLabel}>{t.complaints.progress}</Text>
            {stages.map((stage, index) => (
              <View key={stage.title} style={styles.stageRow}>
                <View style={styles.stageMarkerCol}>
                  <View style={[styles.stageDot, stage.state !== 'pending' && styles.stageDotDone]} />
                  {index < stages.length - 1 && <View style={styles.stageLine} />}
                </View>
                <View style={styles.stageTextCol}>
                  <Text style={[styles.stageTitle, stage.state === 'pending' && styles.stageTitlePending]}>{stage.title}</Text>
                  <Text style={styles.stageBody}>{stage.body}</Text>
                </View>
              </View>
            ))}
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listMyComplaints, type ComplaintCategory, type ComplaintDbStatus, type MyComplaintRow } from '@trisakay/services';
import { colors } from '@trisakay/ui';
import { OfflineState } from '../../src/components/OfflineState';
import { IconTile, NavyBand, StageBar, StatusChip } from '../../src/components/complaints';
import { useConnectivityStore } from '../../src/store/useConnectivityStore';
import { useTranslation } from '../../src/hooks/useTranslation';
import { CATEGORY_ICON, CATEGORY_TONE } from '../../src/utils/complaintCategories';
import { isTerminalStatus } from '../../src/utils/complaintStatus';
import { getReferenceCode } from '../../src/utils/reference';
import { styles } from '../../src/styles/tabs/complaints.styles';

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

export default function ComplaintsScreen() {
  const t = useTranslation();
  const router = useRouter();
  const isOffline = useConnectivityStore((state) => state.isOffline);
  const [complaints, setComplaints] = useState<MyComplaintRow[]>([]);
  const [expanded, setExpanded] = useState(false);

  const CATEGORY_LABEL: Record<ComplaintCategory, string> = {
    fare: t.complaints.categoryFare,
    conduct: t.complaints.categoryConduct,
    safety: t.complaints.categorySafety,
    low_rating: t.complaints.categoryLowRating,
    vehicle_condition: t.complaints.categoryVehicleCondition,
    other: t.complaints.categoryOther,
  };
  const STATUS_LABEL: Record<ComplaintDbStatus, string> = {
    open: t.complaints.statusOpen,
    under_review: t.complaints.statusUnderReview,
    escalated: t.complaints.statusEscalated,
    mediation_scheduled: t.complaints.statusMediationScheduled,
    resolved: t.complaints.statusResolved,
    dismissed: t.complaints.statusDismissed,
  };

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listMyComplaints().then(({ data }) => {
        if (!cancelled) setComplaints(data);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  if (isOffline) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <OfflineState />
      </SafeAreaView>
    );
  }

  const inProgressCount = complaints.filter((c) => !isTerminalStatus(c.status)).length;
  const resolvedCount = complaints.filter((c) => c.status === 'resolved').length;
  const showStats = complaints.length > 0;
  const visibleCases = expanded ? complaints : complaints.slice(0, 3);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <NavyBand>
        <View style={styles.bandContent}>
          <Text style={styles.title}>{t.complaints.title}</Text>
          <Text style={styles.subline}>{t.complaints.homeSubline}</Text>
          {showStats && (
            <View style={styles.statsStrip}>
              <View style={styles.statsCol}>
                <Text style={styles.statsValue}>{inProgressCount}</Text>
                <Text style={styles.statsLabel}>{t.complaints.statsInProgress}</Text>
              </View>
              <View style={styles.statsDivider} />
              <View style={styles.statsCol}>
                <Text style={styles.statsValue}>{resolvedCount}</Text>
                <Text style={styles.statsLabel}>{t.complaints.statsResolved}</Text>
              </View>
            </View>
          )}
        </View>
      </NavyBand>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Pressable
          style={styles.reportCard}
          accessibilityRole="button"
          onPress={() => router.push('/complaints/new')}
        >
          <IconTile size={48} backgroundColor={colors.accentBlue}>
            <Ionicons name="add" size={22} color={colors.white} />
          </IconTile>
          <View style={styles.reportTextSlot}>
            <Text style={styles.reportTitle}>{t.complaints.reportProblem}</Text>
            <Text style={styles.reportSub}>{t.complaints.reportProblemSub}</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={colors.accentBlue} />
        </Pressable>

        <View>
          <Text style={styles.sectionLabel}>{t.complaints.commonIssues}</Text>
          <View style={styles.issueGrid}>
            {(['fare', 'conduct', 'safety'] as const).map((category) => (
              <Pressable
                key={category}
                style={styles.issueTile}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/complaints/new', params: { category } })}
              >
                <IconTile size={34} backgroundColor={CATEGORY_TONE[category].bg}>
                  <Ionicons name={CATEGORY_ICON[category]} size={16} color={CATEGORY_TONE[category].fg} />
                </IconTile>
                <Text style={styles.issueLabel}>{CATEGORY_LABEL[category]}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View>
          <View style={styles.casesHeaderRow}>
            <Text style={styles.sectionLabel}>{t.complaints.yourCases}</Text>
            {complaints.length > 3 && !expanded && (
              <Pressable accessibilityRole="button" onPress={() => setExpanded(true)}>
                <Text style={styles.seeAll}>{t.complaints.seeAll}</Text>
              </Pressable>
            )}
          </View>

          {complaints.length === 0 ? (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyText}>{t.complaints.emptyCasesMessage}</Text>
            </View>
          ) : (
            <View style={styles.casesList}>
              {visibleCases.map((complaint) => {
                const terminal = isTerminalStatus(complaint.status);
                const meta = terminal
                  ? `${t.complaints.caseClosedPrefix} ${complaint.resolvedAt ? formatShortDate(complaint.resolvedAt) : ''}`
                  : `${t.complaints.caseFiledPrefix} ${formatShortDate(complaint.createdAt)}`;
                return (
                  <Pressable
                    key={complaint.id}
                    style={styles.caseCard}
                    accessibilityRole="button"
                    onPress={() => router.push(`/complaints/${complaint.id}`)}
                  >
                    <View style={styles.caseTopRow}>
                      <Text style={styles.caseRefLine}>
                        #{getReferenceCode(complaint.id)} · {CATEGORY_LABEL[complaint.category]}
                      </Text>
                      <StatusChip status={complaint.status} label={STATUS_LABEL[complaint.status]} />
                    </View>
                    <Text style={styles.caseSubject} numberOfLines={2}>
                      {complaint.subject}
                    </Text>
                    <StageBar status={complaint.status} />
                    <View style={styles.caseMetaRow}>
                      <Text style={styles.caseMeta}>{meta}</Text>
                      <Ionicons name="chevron-forward" size={14} color={colors.inkSoft} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconTile, NavyBandHeader, ProgressSegments, colors, recordsPalette, type IconTileTone } from '@trisakay/ui';
import {
  countDocumentStatuses,
  documentHealthSegments,
  getDocumentExpiry,
  type DocumentExpiry,
  type DocumentStatus,
} from '@trisakay/shared';
import type { OwnDriverDocumentRow } from '@trisakay/services';
import { DocumentDateSheet, formatLongDate, toIsoDate } from '../../src/components/DocumentDateSheet/DocumentDateSheet';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useDriverDocumentsStore } from '../../src/store/useDriverDocumentsStore';
import { DOCUMENT_TYPES, type DocumentType } from '../../src/types/document';
import { interpolate } from '../../src/utils/interpolate';
import { styles } from '../../src/styles/profile/documents.styles';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const DOC_ICON: Record<DocumentType, IconName> = {
  drivers_license: 'card-outline',
  or_cr: 'document-text-outline',
  franchise_permit: 'document-text-outline',
  tricycle_photo: 'bicycle-outline',
};

const HEALTH_COLOR: Record<DocumentStatus, string> = {
  expired: recordsPalette.onDarkRed,
  expiring: recordsPalette.onDarkBlue,
  valid: recordsPalette.onDarkGreen,
  unset: 'rgba(255, 255, 255, 0.22)',
};

function parseLocalDate(iso: string | null): Date | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

interface DocRow {
  doc: OwnDriverDocumentRow;
  type: DocumentType;
  expiry: DocumentExpiry;
}

/**
 * UAT D13 — self-reported document expiry dates, written directly to
 * driver_documents (documents_owner_rw RLS already permits a driver to
 * update their own rows) rather than through submit_driver_documents, an
 * untracked RPC not safe to extend blind. Redesigned per the trip-records
 * handoff §1b: a health bar, urgency grouping and a date sheet; the store
 * call (`setExpiry`) and the 30-day "expiring" threshold are unchanged.
 */
export default function MyDocumentsScreen() {
  const t = useTranslation();
  const d = t.driver.documents;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { documents, loading, error, saving, load, setExpiry } = useDriverDocumentsStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const DOCUMENT_LABEL: Record<DocumentType, string> = {
    drivers_license: d.driversLicense,
    or_cr: d.orCr,
    franchise_permit: d.franchisePermit,
    tricycle_photo: d.tricyclePhoto,
  };

  // Every document type that has a row, in DOCUMENT_TYPES order.
  const today = new Date();
  const rows: DocRow[] = [];
  for (const type of DOCUMENT_TYPES) {
    const doc = documents.find((item) => item.docType === type);
    if (doc) rows.push({ doc, type, expiry: getDocumentExpiry(doc.expiryDate, today) });
  }

  const statuses = rows.map((row) => row.expiry.status);
  const counts = countDocumentStatuses(statuses);
  const attentionCount = counts.expired + counts.expiring;
  const attentionRows = [
    ...rows.filter((row) => row.expiry.status === 'expired'),
    ...rows.filter((row) => row.expiry.status === 'expiring'),
  ];
  const upToDateRows = rows.filter((row) => row.expiry.status === 'valid' || row.expiry.status === 'unset');

  const editing = rows.find((row) => row.doc.id === editingId) ?? null;

  function statusLine(row: DocRow): string {
    const date = row.doc.expiryDate ? formatLongDate(parseLocalDate(row.doc.expiryDate)!) : '';
    const n = Math.abs(row.expiry.days ?? 0);
    switch (row.expiry.status) {
      case 'expired':
        return n === 0 ? interpolate(d.expiredToday, { date }) : n === 1 ? interpolate(d.expiredAgoOne, { date }) : interpolate(d.expiredAgo, { n, date });
      case 'expiring':
        return n === 0 ? interpolate(d.expiresToday, { date }) : n === 1 ? interpolate(d.expiresInOne, { date }) : interpolate(d.expiresIn, { n, date });
      case 'valid':
        return interpolate(d.validUntil, { date });
      default:
        return d.noExpiryDate;
    }
  }

  function openSheet(id: string) {
    setSaveError(null);
    setEditingId(id);
  }

  async function handleSave(date: Date) {
    if (!editing) return;
    const { error: storeError } = await setExpiry(editing.doc.id, toIsoDate(date));
    if (storeError) {
      setSaveError(storeError);
      return;
    }
    setEditingId(null);
  }

  async function handleClear() {
    if (!editing) return;
    const { error: storeError } = await setExpiry(editing.doc.id, null);
    if (storeError) {
      setSaveError(storeError);
      return;
    }
    setEditingId(null);
  }

  const legend: Array<{ status: DocumentStatus; text: string }> = [
    { status: 'expired', text: interpolate(d.legendExpired, { count: counts.expired }) },
    { status: 'expiring', text: interpolate(d.legendExpiring, { count: counts.expiring }) },
    { status: 'valid', text: interpolate(d.legendValid, { count: counts.valid }) },
    { status: 'unset', text: interpolate(d.legendUnset, { count: counts.unset }) },
  ];

  return (
    <View style={styles.container}>
      <NavyBandHeader
        title={d.myDocumentsTitle}
        onBack={() => router.back()}
        backAccessibilityLabel={t.common.goBackA11y}
        topInset={insets.top}
        paddingBottom={20}
        elevated
      >
        {!loading && rows.length > 0 && (
          <View style={styles.bandBody}>
            <Text style={styles.headline}>
              {attentionCount === 0
                ? d.headlineAllGood
                : attentionCount === 1
                  ? d.headlineAttentionOne
                  : interpolate(d.headlineAttention, { count: attentionCount })}
            </Text>
            <Text style={styles.headlineSub}>{d.healthSub}</Text>
            <ProgressSegments colors={documentHealthSegments(statuses).map((status) => HEALTH_COLOR[status])} height={6} />
            <View style={styles.legend}>
              {legend
                .filter((item) => counts[item.status] > 0)
                .map((item) => (
                  <View key={item.status} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: HEALTH_COLOR[item.status] }]} />
                    <Text style={styles.legendText}>{item.text}</Text>
                  </View>
                ))}
            </View>
          </View>
        )}
      </NavyBandHeader>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {error && <Text style={styles.error}>{error}</Text>}

        {attentionRows.length > 0 && (
          <View style={styles.group}>
            <Text style={styles.sectionLabel}>{d.groupAttention}</Text>
            {attentionRows.map((row) =>
              row.expiry.status === 'expired' ? (
                <View key={row.doc.id} style={styles.card}>
                  <View style={styles.expiredClip}>
                    <View style={styles.row}>
                      <IconTile icon={DOC_ICON[row.type]} tone="red" size={40} />
                      <View style={styles.rowBody}>
                        <Text style={styles.docName}>{DOCUMENT_LABEL[row.type]}</Text>
                        <Text style={styles.statusExpired}>{statusLine(row)}</Text>
                      </View>
                    </View>
                    <View style={styles.footer}>
                      <Text style={styles.footerText}>{d.renewedPrompt}</Text>
                      <Pressable accessibilityRole="button" onPress={() => openSheet(row.doc.id)} style={styles.updateButton}>
                        <Ionicons name="calendar-outline" size={14} color={colors.white} />
                        <Text style={styles.updateText}>{d.updateDate}</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ) : (
                <Pressable key={row.doc.id} accessibilityRole="button" onPress={() => openSheet(row.doc.id)} style={[styles.card, styles.row]}>
                  <IconTile icon={DOC_ICON[row.type]} tone="navy" size={40} />
                  <View style={styles.rowBody}>
                    <Text style={styles.docName}>{DOCUMENT_LABEL[row.type]}</Text>
                    <Text style={styles.statusExpiring}>{statusLine(row)}</Text>
                  </View>
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>{d.soonPill}</Text>
                  </View>
                </Pressable>
              )
            )}
          </View>
        )}

        {upToDateRows.length > 0 && (
          <View style={styles.group}>
            <Text style={styles.sectionLabel}>{d.groupUpToDate}</Text>
            <View style={styles.card}>
              {upToDateRows.map((row, index) => {
                const tone: IconTileTone = row.expiry.status === 'valid' ? 'green' : 'neutral';
                return (
                  <Pressable
                    key={row.doc.id}
                    accessibilityRole="button"
                    onPress={() => openSheet(row.doc.id)}
                    style={[styles.row, index > 0 && styles.rowDivider]}
                  >
                    <IconTile icon={DOC_ICON[row.type]} tone={tone} size={40} />
                    <View style={styles.rowBody}>
                      <Text style={styles.docName}>{DOCUMENT_LABEL[row.type]}</Text>
                      <Text style={styles.statusPlain}>{statusLine(row)}</Text>
                    </View>
                    {row.expiry.status === 'valid' ? (
                      <Ionicons name="shield-checkmark" size={18} color={colors.accentGreen} />
                    ) : (
                      <View style={styles.addLink}>
                        <Text style={styles.addText}>{d.addLink}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {!loading && rows.length > 0 && (
          <View style={styles.footnote}>
            <Ionicons name="information-circle-outline" size={16} color={colors.inkSoft} />
            <Text style={styles.footnoteText}>{d.datesFootnote}</Text>
          </View>
        )}
      </ScrollView>

      <DocumentDateSheet
        visible={editing !== null}
        documentName={editing ? DOCUMENT_LABEL[editing.type] : ''}
        tileTone={editing ? (editing.expiry.status === 'expired' ? 'red' : editing.expiry.status === 'valid' ? 'green' : 'navy') : 'navy'}
        tileIcon={editing ? DOC_ICON[editing.type] : 'document-text-outline'}
        initialDate={editing ? parseLocalDate(editing.doc.expiryDate) : null}
        saving={editing !== null && saving === editing.doc.id}
        error={saveError}
        onClose={() => setEditingId(null)}
        onSave={handleSave}
        onClear={handleClear}
      />
    </View>
  );
}

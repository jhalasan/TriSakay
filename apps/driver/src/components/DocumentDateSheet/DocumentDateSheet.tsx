import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, DateWheelPicker, IconTile, colors, fontFamily, radius, type IconTileTone } from '@trisakay/ui';
import { getDocumentExpiry } from '@trisakay/shared';
import { useTranslation } from '../../hooks/useTranslation';
import { interpolate } from '../../utils/interpolate';

export function toIsoDate(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

export function formatLongDate(date: Date): string {
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export interface DocumentDateSheetProps {
  visible: boolean;
  documentName: string;
  tileTone: IconTileTone;
  tileIcon: React.ComponentProps<typeof Ionicons>['name'];
  /** The stored expiry date, if any. The wheel starts here, or on today. */
  initialDate: Date | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (date: Date) => void;
  onClear: () => void;
}

/** Bottom sheet for setting a document's expiry: a month/day/year wheel, a live status preview, Save and (when a date exists) Clear. */
export function DocumentDateSheet({
  visible,
  documentName,
  tileTone,
  tileIcon,
  initialDate,
  saving,
  error,
  onClose,
  onSave,
  onClear,
}: DocumentDateSheetProps) {
  const t = useTranslation();
  const d = t.driver.documents;
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Date>(initialDate ?? new Date());

  useEffect(() => {
    if (visible) setDraft(initialDate ?? new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const today = new Date();
  const { status, days } = getDocumentExpiry(toIsoDate(draft), today);
  const n = days ?? 0;

  let previewTone: IconTileTone = 'navy';
  let previewIcon: React.ComponentProps<typeof Ionicons>['name'] = 'time';
  let previewText: string;
  if (status === 'expired') {
    previewTone = 'red';
    previewIcon = 'alert-circle';
    previewText = d.previewExpired;
  } else if (status === 'expiring') {
    previewText = n === 0 ? d.previewExpiringToday : n === 1 ? d.previewExpiringOne : interpolate(d.previewExpiring, { n });
  } else {
    previewTone = 'green';
    previewIcon = 'shield-checkmark';
    previewText = n >= 60 ? interpolate(d.previewValidMonths, { n: Math.round(n / 30.4) }) : interpolate(d.previewValidDays, { n });
  }

  const minYear = today.getFullYear() - 1;
  const maxYear = today.getFullYear() + 20;
  const previewColors =
    previewTone === 'green'
      ? { bg: colors.accentGreenSoft, fg: colors.accentGreenPressed }
      : previewTone === 'red'
        ? { bg: colors.dangerSoft, fg: colors.dangerPressed }
        : { bg: colors.accentBlueSoft, fg: colors.accentBluePressed };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel={d.closeA11y} accessibilityRole="button" />
      <View style={[styles.sheet, { paddingBottom: 26 + insets.bottom }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <IconTile icon={tileIcon} tone={tileTone} size={40} />
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1}>
              {documentName}
            </Text>
            <Text style={styles.subtitle}>{d.sheetSubtitle}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={d.closeA11y} hitSlop={5} onPress={onClose} style={styles.closeTile}>
            <Ionicons name="close" size={14} color={colors.ink} />
          </Pressable>
        </View>

        <DateWheelPicker
          value={draft}
          onChange={setDraft}
          minYear={minYear}
          maxYear={maxYear}
          monthLabel={d.monthA11y}
          dayLabel={d.dayA11y}
          yearLabel={d.yearA11y}
        />

        <View style={[styles.preview, { backgroundColor: previewColors.bg }]} accessibilityLiveRegion="polite">
          <Ionicons name={previewIcon} size={16} color={previewColors.fg} />
          <Text style={[styles.previewText, { color: previewColors.fg }]}>{previewText}</Text>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Button label={interpolate(d.saveDate, { date: formatLongDate(draft) })} fullWidth loading={saving} onPress={() => onSave(draft)} />
        {initialDate && (
          <Pressable accessibilityRole="button" onPress={onClear} disabled={saving} style={styles.clear}>
            <Text style={styles.clearText}>{d.clearDate}</Text>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.sheetTop,
    borderTopRightRadius: radius.sheetTop,
    paddingTop: 10,
    paddingHorizontal: 20,
    gap: 16,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 16,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1 },
  title: { fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 23, color: colors.ink },
  subtitle: { fontFamily: fontFamily.regular, fontSize: 12.5, lineHeight: 18, color: colors.inkSoft },
  closeTile: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.sm2, paddingVertical: 11, paddingHorizontal: 14 },
  previewText: { flex: 1, fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 18 },
  error: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: colors.danger },
  clear: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  clearText: { fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 20, color: colors.inkSoft },
});

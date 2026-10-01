import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingTop: 6, paddingHorizontal: 16, paddingBottom: 32, gap: 18 },
  sectionLabel: { ...typography.label, color: colors.inkSoft, marginBottom: spacing.sm },
  card: { gap: spacing.md },
  navGroup: { paddingHorizontal: spacing.lg, paddingVertical: 2 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  detailBody: { flex: 1, minWidth: 0, gap: 1 },
  detailLabel: { ...typography.label, fontSize: 10, color: colors.inkFaint },
  detailValue: { ...typography.bodyStrong, fontSize: 14, color: colors.ink },
  divider: { height: 1, backgroundColor: colors.lineSoft },
  iconTile: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  dialog: { alignSelf: 'stretch', backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md },
  dialogTitle: { ...typography.h2, color: colors.ink },
  dialogBody: { ...typography.body, color: colors.inkSoft },
  dialogActions: { flexDirection: 'row', gap: spacing.md },
  dialogAction: { flex: 1 },
});

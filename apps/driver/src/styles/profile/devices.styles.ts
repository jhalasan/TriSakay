import { StyleSheet } from 'react-native';
import { colors, fontFamily, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingTop: 6, paddingHorizontal: 16, paddingBottom: 24, gap: 14 },
  card: { paddingHorizontal: spacing.lg, paddingVertical: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
  tile: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.accentBlueSoft, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0, gap: 1 },
  name: { ...typography.bodyStrong, fontSize: 14, color: colors.ink },
  meta: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.inkSoft },
  empty: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.inkSoft, textAlign: 'center' },
  bottomBar: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: spacing.lg,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
});

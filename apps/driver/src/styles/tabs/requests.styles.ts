import { StyleSheet } from 'react-native';
import { colors, fontFamily, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  // 26/32/-0.7 has no matching heading token (h1b is closest, at 28/32) — a one-off literal shared by every tab screen's page title.
  title: { fontSize: 26, lineHeight: 32, fontFamily: fontFamily.extrabold, letterSpacing: -0.7, color: colors.ink },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md, flexGrow: 1 },
  error: { ...typography.caption, color: colors.danger, paddingHorizontal: spacing.lg },
  offlineIconTile: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

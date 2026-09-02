import { StyleSheet } from 'react-native';
import { colors, fontFamily, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  // 26/32/-0.7 has no matching heading token (h1b is closest, at 28/32) — a one-off literal shared by every tab screen's page title.
  title: { fontSize: 26, lineHeight: 32, fontFamily: fontFamily.extrabold, letterSpacing: -0.7, color: colors.ink },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  tripCard: {
    backgroundColor: colors.panel,
    borderRadius: radius.md3,
    paddingVertical: spacing.md + 1,
    paddingHorizontal: spacing.lg - 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  fallbackAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripInfo: { flex: 1, minWidth: 0, gap: 2 },
  tripName: { ...typography.bodyStrong, color: colors.ink },
  tripDate: { ...typography.caption, fontSize: 12.5, color: colors.inkSoft },
  trailingSlot: { alignItems: 'flex-end', gap: 4 },
  fareText: { ...typography.bodyStrong, color: colors.ink },
  fareTextMuted: { color: colors.inkFaint },
  error: { ...typography.caption, color: colors.danger, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
});

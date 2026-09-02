import { StyleSheet } from 'react-native';
import { colors, elevation, fontFamily, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  markReadText: {
    ...typography.caption,
    color: colors.accentBlue,
    fontFamily: fontFamily.semibold,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },

  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  tagline: {
    ...typography.caption,
    color: colors.inkSoft,
    flex: 1,
  },
  unreadPill: {
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginLeft: spacing.sm,
  },
  unreadPillText: {
    ...typography.label,
    fontSize: 11,
    color: colors.white,
  },

  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  filterChip: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
  },
  filterChipActive: {
    backgroundColor: colors.accentBlue,
    borderColor: colors.accentBlue,
  },
  filterChipText: {
    ...typography.caption,
    color: colors.inkSoft,
    fontFamily: fontFamily.semibold,
  },
  filterChipTextActive: {
    color: colors.white,
  },

  sectionHeader: {
    ...typography.label,
    color: colors.inkSoft,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.panel,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    ...elevation.card,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    backgroundColor: colors.danger,
  },
  textSlot: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  body: {
    ...typography.body,
    color: colors.inkSoft,
  },
  date: {
    ...typography.caption,
    color: colors.inkFaint,
    marginTop: 2,
  },
});

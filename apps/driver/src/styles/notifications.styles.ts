import { StyleSheet } from 'react-native';
import { colors, fontFamily, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.sm,
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
    backgroundColor: colors.accentBlue,
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
    backgroundColor: colors.fill,
  },
  filterChipActive: {
    backgroundColor: colors.accentBlue,
  },
  filterChipText: {
    ...typography.caption,
    color: colors.inkSoft,
    fontFamily: fontFamily.semibold,
  },
  filterChipTextActive: {
    color: colors.white,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardUnread: {
    backgroundColor: colors.accentBlueSoft,
    borderColor: colors.accentBlueSoft,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    backgroundColor: colors.accentBlue,
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

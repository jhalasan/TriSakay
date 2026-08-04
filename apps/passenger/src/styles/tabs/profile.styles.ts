import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.ink,
  },
  identity: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  /** Non-clipping wrapper — the edit badge sits just outside the avatar circle's own bounds. */
  avatarWrap: {
    position: 'relative',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentBlue,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    ...typography.h2,
    color: colors.ink,
    marginTop: spacing.sm,
  },
  editFieldWrap: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
  },
  detailsCard: {
    flexDirection: 'row',
  },
  detailCol: {
    flex: 1,
    gap: 2,
  },
  detailLabel: {
    ...typography.label,
    color: colors.inkSoft,
  },
  detailValue: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  navGroup: {
    gap: spacing.xs,
  },
});

import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  greetingSlot: {
    flex: 1,
    gap: 2,
  },
  greetingLabel: {
    ...typography.caption,
    color: colors.inkSoft,
  },
  greetingName: {
    ...typography.h1,
    color: colors.ink,
  },
  bellButton: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.lineStrong, // icon-only control
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel,
  },
  bellDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.panel,
  },
  mapWrap: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.inkSoft,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  shortcuts: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.panel,
    minHeight: 68,
  },
  shortcutIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutTextSlot: {
    flex: 1,
    gap: 2,
  },
  shortcutLabel: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  shortcutAddress: {
    ...typography.caption,
    color: colors.inkSoft,
  },
  ctaWrap: {
    paddingHorizontal: spacing.lg,
  },
});

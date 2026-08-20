import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  headerCard: {
    padding: spacing.sm,
    borderTopWidth: 3,
    borderTopColor: colors.accentGreen,
  },
  greeting: {
    ...typography.bodyStrong,
    color: colors.ink,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatarRing: {
    padding: 2,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.accentGreenSoft,
  },
  /** Pushes the bell to the row's far end now that the search bar (which used to fill this gap) lives on the Request a Tricycle screen instead. */
  headerSpacer: {
    flex: 1,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentBlueSoft,
  },
  bellDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.panel,
  },
  /** Own pressed-state wrapper (rather than Button) since this is a full custom gradient card, not a text button. */
  ctaWrap: {
    borderRadius: radius.lg,
    ...elevation.card,
  },
  ctaPressed: {
    opacity: 0.9,
  },
  ctaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  ctaMotif: {
    position: 'absolute',
    top: -30,
    right: -30,
  },
  ctaIconBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTextSlot: {
    flex: 1,
    gap: 2,
  },
  ctaTitle: {
    ...typography.h2,
    color: colors.white,
  },
  ctaSubtitle: {
    ...typography.caption,
    color: colors.white,
    opacity: 0.85,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.inkSoft,
    marginBottom: spacing.md,
  },
  shortcuts: {
    gap: spacing.md,
  },
  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.fill,
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
});

import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  // Same hero treatment as the Ride History tab (heroShadowWrap/heroPanel
  // split, BrandMotif watermark, eyebrow + title) so this pushed screen
  // reads as part of the same design language, not a plainer sub-page.
  heroShadowWrap: {
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 30,
    elevation: 10,
  },
  heroPanel: {
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: radius.heroBottom,
    borderBottomRightRadius: radius.heroBottom,
    paddingHorizontal: spacing.tight18,
    paddingTop: spacing.sm,
    paddingBottom: spacing.tight22,
  },
  heroMotif: {
    position: 'absolute',
    top: -46,
    right: -52,
  },
  backButtonRow: {
    marginBottom: spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignSelf: 'flex-start',
  },
  heroEyebrow: {
    ...typography.eyebrow,
    color: colors.white,
    opacity: 0.75,
  },
  heroTitle: {
    ...typography.h1b,
    color: colors.white,
    marginTop: 2,
  },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.tight10 },
  intro: { ...typography.caption, color: colors.inkSoft, marginBottom: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight14,
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.tight14,
    backgroundColor: colors.white,
    minHeight: 70,
    ...elevation.card,
  },
  icon: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  textSlot: { flex: 1, gap: 2 },
  label: { ...typography.bodyStrong, color: colors.ink },
  address: { ...typography.caption, color: colors.inkSoft },
  removeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingVertical: spacing.lg,
    marginTop: spacing.xs,
  },
  addRowLabel: { ...typography.bodyStrong, color: colors.accentBlue },
});

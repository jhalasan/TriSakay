import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, overflow: 'hidden' },
  motif: { position: 'absolute', top: -40, right: -50 },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, lineHeight: 29, fontFamily: typography.h2.fontFamily, letterSpacing: -0.4, color: colors.ink, textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 21, fontFamily: typography.body.fontFamily, color: colors.inkSoft, textAlign: 'center' },
  error: { ...typography.caption, color: colors.danger, textAlign: 'center' },
  actions: { width: '100%', gap: spacing.sm, marginTop: spacing.md },
  uploadScroll: { flex: 1 },
  uploadScrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  centerSelf: { alignSelf: 'center' },
  logoutFooter: { padding: spacing.xl, paddingTop: 0 },
});

import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
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
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, lineHeight: 29, fontFamily: typography.h2.fontFamily, letterSpacing: -0.4, color: colors.ink, textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 21, fontFamily: typography.body.fontFamily, color: colors.inkSoft, textAlign: 'center' },
  error: { ...typography.caption, color: colors.danger, textAlign: 'center' },
  officeCard: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: radius.md3,
    padding: spacing.lg,
    gap: 4,
    marginTop: spacing.lg,
    ...elevation.card,
  },
  officeLabel: { ...typography.label, color: colors.inkSoft },
  officeAddress: { ...typography.bodyStrong, fontSize: 14, lineHeight: 20, color: colors.ink },
  officeHours: { ...typography.caption, fontSize: 12.5, lineHeight: 18, color: colors.inkSoft },
  actions: { width: '100%', gap: spacing.sm, marginTop: spacing.xl },
});

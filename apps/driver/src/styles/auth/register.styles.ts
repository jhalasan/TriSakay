import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  heroBand: { height: 110 },
  motif: { position: 'absolute', top: -40, right: -40 },
  markBadge: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: -36,
    ...elevation.card,
  },
  mark: { width: 42, height: 50 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },
  fields: { gap: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.md },
  authError: { ...typography.caption, color: colors.danger },
  legalText: { ...typography.caption, color: colors.inkSoft, textAlign: 'center', marginTop: spacing.lg },
});

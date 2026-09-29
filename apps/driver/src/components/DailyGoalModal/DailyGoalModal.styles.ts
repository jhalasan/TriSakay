import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.panel,
    borderRadius: radius.xl2,
    padding: spacing.xl,
    gap: spacing.md,
    ...elevation.sheet,
  },
  title: { ...typography.h2, color: colors.ink },
  body: { ...typography.caption, fontSize: 13, lineHeight: 19, color: colors.inkSoft },
  pesoIcon: { ...typography.bodyStrong, color: colors.inkSoft },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  actionButton: { flex: 1 },
});

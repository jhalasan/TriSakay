import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, padding: spacing.xl, gap: spacing.xl, justifyContent: 'center' },
  title: { ...typography.h2, color: colors.ink, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.inkSoft, textAlign: 'center' },
  dialSection: { gap: spacing.md },
  psoStatus: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'center' },
  psoStatusText: { ...typography.body, color: colors.inkSoft, textAlign: 'center' },
  psoStatusTextError: { ...typography.body, color: colors.danger, textAlign: 'center' },
  retryLink: { ...typography.bodyStrong, color: colors.accentBlue, textAlign: 'center' },
  backLink: { ...typography.bodyStrong, color: colors.inkSoft, textAlign: 'center' },
});

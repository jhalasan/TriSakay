import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  eyebrow: { ...typography.label, color: colors.inkSoft },
  name: { ...typography.h2, color: colors.ink, textAlign: 'center', maxWidth: '90%' },
  subtitle: { ...typography.body, color: colors.inkSoft, textAlign: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: spacing.lg },
  action: { alignItems: 'center', gap: 8, minWidth: 96 },
  round: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  declineRound: { backgroundColor: colors.danger },
  answerRound: { backgroundColor: colors.accentGreen },
  hangUpIcon: { transform: [{ rotate: '135deg' }] },
  actionLabel: { ...typography.body, color: colors.ink, textAlign: 'center' },
});

import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  name: { ...typography.h2, color: colors.ink, textAlign: 'center', maxWidth: '90%' },
  state: { ...typography.body, color: colors.inkSoft, textAlign: 'center' },
  timer: { ...typography.h2, color: colors.ink },
  error: { ...typography.body, color: colors.danger, textAlign: 'center', maxWidth: '90%' },
  controls: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start', paddingTop: spacing.lg },
  control: { alignItems: 'center', gap: 8, minWidth: 88 },
  toggle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  toggleOff: { backgroundColor: colors.accentBlueSoft },
  toggleOn: { backgroundColor: colors.accentBlue },
  endRound: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.danger },
  hangUpIcon: { transform: [{ rotate: '135deg' }] },
  controlLabel: { ...typography.body, color: colors.ink, textAlign: 'center' },
  closeWrap: { paddingTop: spacing.lg },
});

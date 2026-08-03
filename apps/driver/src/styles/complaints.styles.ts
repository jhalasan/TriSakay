import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: spacing.lg, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.h1, color: colors.ink },
  listContent: { gap: spacing.md },
  cardRow: { padding: spacing.lg, gap: spacing.sm },
  subjectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subject: { ...typography.bodyStrong, color: colors.ink },
  formGap: { gap: spacing.md },
});

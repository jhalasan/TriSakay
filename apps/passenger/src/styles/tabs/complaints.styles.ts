import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  headerBlock: {
    gap: 2,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h1b,
    color: colors.ink,
  },
  tagline: {
    ...typography.caption,
    color: colors.inkSoft,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.inkSoft,
  },
  pickerField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    backgroundColor: colors.panel,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
  },
  categoryFieldContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  categoryIconBadge: {
    width: 30,
    height: 30,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerFieldText: {
    ...typography.body,
    color: colors.ink,
  },
  pickerFieldPlaceholder: {
    color: colors.inkFaint,
  },
  pickerEmpty: {
    ...typography.body,
    color: colors.inkSoft,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    textAlign: 'center',
  },
  pickerList: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  priorSection: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  successWarning: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
  },
  successIconBadge: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.accentGreenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  evidenceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  evidenceCounter: {
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  evidenceCounterText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.inkSoft,
  },
  evidenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  evidenceThumbWrap: {
    width: 72,
    height: 72,
  },
  evidenceThumb: {
    width: 72,
    height: 72,
    borderRadius: radius.sm2,
  },
  evidenceRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.ink,
    borderRadius: 999,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  evidenceAddTile: {
    width: 72,
    height: 72,
    borderRadius: radius.sm2,
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: 'dashed',
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  evidenceAddLabel: {
    ...typography.caption,
    color: colors.inkSoft,
  },
  evidenceHint: {
    ...typography.caption,
    color: colors.inkFaint,
  },
});

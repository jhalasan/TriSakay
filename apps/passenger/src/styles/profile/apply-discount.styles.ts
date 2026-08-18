import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  intro: {
    ...typography.body,
    color: colors.inkSoft,
  },
  statusCard: {
    gap: spacing.xs,
  },
  statusTitle: {
    ...typography.h2,
    color: colors.ink,
  },
  statusNote: {
    ...typography.body,
    color: colors.inkSoft,
  },
  remarksLabel: {
    ...typography.label,
    color: colors.inkSoft,
    marginTop: spacing.sm,
  },
  remarksBody: {
    ...typography.body,
    color: colors.ink,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.inkSoft,
    marginBottom: spacing.xs,
  },
  photoRow: {
    flexDirection: 'column',
    gap: spacing.md,
  },
  photoSlot: {},
  photoUpload: {
    height: 140,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: 'dashed',
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    gap: spacing.xs,
  },
  photoUploadFilled: {
    borderWidth: 0,
    borderStyle: 'solid',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoUploadLabel: {
    ...typography.caption,
    color: colors.inkSoft,
  },
  photoChangeLabel: {
    ...typography.caption,
    color: colors.white,
    backgroundColor: 'rgba(10,18,24,0.55)',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },
  formError: {
    ...typography.caption,
    color: colors.danger,
  },
  disclaimer: {
    ...typography.caption,
    color: colors.inkFaint,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    ...elevation.card,
  },
});

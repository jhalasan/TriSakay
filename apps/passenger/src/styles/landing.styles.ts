import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  hero: {
    flex: 0.56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  motif: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -130,
    marginLeft: -130,
  },
  heroImage: {
    width: '86%',
    height: '76%',
  },
  /** Pulled up over the hero/body boundary, same floating-badge treatment as splash.tsx's lockup — the mark is navy/green ink and disappears on a dark background otherwise. */
  badgeWrap: {
    alignItems: 'center',
    marginTop: -44,
  },
  badge: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    ...elevation.card,
  },
  logo: {
    width: 176,
    height: 98,
  },
  body: {
    flex: 0.44,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    justifyContent: 'space-between',
  },
  copy: {
    alignItems: 'center',
  },
  tagline: {
    ...typography.h2,
    color: colors.ink,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  actions: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
});

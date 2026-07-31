import { StyleSheet } from 'react-native';
import { elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  motif: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -180,
    marginLeft: -180,
  },
  /**
   * The lockup is navy/green ink drawn for a light background — it would
   * disappear against the navy hero, so it floats on its own white plate
   * rather than sitting directly on the gradient.
   */
  badge: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xxl,
    ...elevation.card,
  },
  logo: {
    width: 220,
    height: 123,
  },
  subtitle: {
    ...typography.body,
    color: 'rgba(255, 255, 255, 0.82)',
    marginTop: spacing.xl,
  },
  loader: {
    marginTop: spacing.xxl,
  },
});

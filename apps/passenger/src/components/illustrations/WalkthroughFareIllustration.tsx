import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';
import { RoadBand, useMapScale } from '../MapGround';
import { PopEntrance } from '../PopEntrance';

/** Walkthrough step 2: the estimated-fare card, pinned to the approved fare matrix. */
export function WalkthroughFareIllustration() {
  const scale = useMapScale();

  return (
    <>
      <RoadBand top={120} height={26} left={0} right={0} />
      <RoadBand bottom={80} height={14} left={0} right={0} />

      <View style={styles.centerWrap} pointerEvents="none">
        <PopEntrance
          delayMs={300}
          durationMs={700}
          style={[styles.card, elevation.floatingCard, { width: scale(232), borderRadius: radius.card, padding: scale(22) }]}
        >
          <Text style={[typography.label, styles.eyebrow]}>ESTIMATED FARE</Text>
          <Text style={[typography.amount, styles.fare]}>₱ 25.00</Text>
          <View style={styles.skeletonRow}>
            <View style={[styles.skeleton, { width: scale(64) }]} />
            <View style={[styles.skeleton, { width: scale(48) }]} />
          </View>
          <View style={styles.skeletonRow}>
            <View style={[styles.skeleton, { width: scale(80) }]} />
            <View style={[styles.skeleton, { width: scale(40) }]} />
          </View>
          <View style={styles.chip}>
            <Ionicons name="checkmark-circle" size={16} color={colors.accentGreenPressed} />
            <Text style={[typography.chip, styles.chipLabel]}>Approved fare matrix</Text>
          </View>
        </PopEntrance>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  centerWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.white,
  },
  eyebrow: {
    color: colors.inkSoft,
  },
  fare: {
    color: colors.accentBlue,
    marginTop: spacing.xs,
  },
  skeletonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  skeleton: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.lineSoft,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    marginTop: spacing.lg,
    backgroundColor: colors.accentGreenSoft,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  chipLabel: {
    color: colors.accentGreenPressed,
  },
});

import { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { BrandMotif, colors, elevation, radius, spacing, typography } from '@trisakay/ui';
import { useMapScale } from '../MapGround';
import { PopEntrance } from '../PopEntrance';

/** The sheet overlaps the map band by 28px (its `marginTop: -radius.sheetTop`) — clear that plus a little breathing room. */
const SHEET_CLEARANCE = 36;

const RING_CORE_SHADOW = Platform.select({
  ios: { shadowColor: colors.accentBlue, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.28, shadowRadius: 30 },
  android: { elevation: 10 },
  default: {},
});

/** Walkthrough step 3: concentric verification rings around the brand mark, breathing in a slow loop. */
export function WalkthroughVerifiedIllustration() {
  const scale = useMapScale();
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    pulse.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      ),
    );
  }, [pulse, reducedMotion]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 1 - pulse.value * 0.3,
    transform: [{ scale: 1 + pulse.value * 0.05 }],
  }));

  const outer = scale(286);
  const middle = scale(212);
  const inner = scale(186);
  const core = scale(128);

  return (
    <>
      <Animated.View
        style={[
          styles.outerRing,
          pulseStyle,
          { left: scale(45), top: scale(31), width: outer, height: outer, borderRadius: outer / 2 },
        ]}
      >
        <View
          style={[
            styles.middleRing,
            { top: (outer - middle) / 2, left: (outer - middle) / 2, width: middle, height: middle, borderRadius: middle / 2 },
          ]}
        >
          <View
            style={[
              styles.innerRing,
              { top: (middle - inner) / 2, left: (middle - inner) / 2, width: inner, height: inner, borderRadius: inner / 2 },
            ]}
          >
            <PopEntrance
              delayMs={250}
              durationMs={750}
              style={[styles.core, RING_CORE_SHADOW, { width: core, height: core, borderRadius: core / 2 }]}
            >
              <BrandMotif size={scale(76)} color={colors.white} chevronColor="#5EA746" opacity={1} />
            </PopEntrance>
          </View>
        </View>
      </Animated.View>

      <View style={[styles.chipWrap, { bottom: scale(SHEET_CLEARANCE) }]}>
        <View style={[styles.chip, elevation.chip]}>
          <View style={styles.chipDot} />
          <Text style={[typography.chip, styles.chipLabel]}>PSO verified</Text>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  outerRing: {
    position: 'absolute',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0, 46, 96, 0.18)',
  },
  middleRing: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 46, 96, 0.05)',
  },
  innerRing: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 46, 96, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  core: {
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accentGreen,
  },
  chipLabel: {
    color: colors.ink,
  },
});

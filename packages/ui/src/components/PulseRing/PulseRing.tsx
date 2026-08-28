import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export interface PulseRingProps {
  size: number;
  color: string;
  /** Full cycle length in ms — 2000 for the driver status dot, 2400 for the listening-panel circle (see `motion.duration.pulseStatus`/`pulseListening`). */
  durationMs: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * The redesign's one pulse keyframe, shared by the driver status dot and the
 * listening-panel circle: `scale(.9) opacity .55` → `scale(1.9) opacity 0`,
 * ease-out, looping. Renders a static circle at rest instead of animating
 * when the OS reduced-motion setting is on (`useReducedMotion`, same as
 * `apps/passenger/src/components/PopEntrance.tsx`).
 */
export function PulseRing({ size, color, durationMs, style }: PulseRingProps) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(reducedMotion ? 1 : 0.9);
  const opacity = useSharedValue(reducedMotion ? 1 : 0.55);

  useEffect(() => {
    if (!reducedMotion) {
      scale.value = withRepeat(withTiming(1.9, { duration: durationMs, easing: Easing.out(Easing.ease) }), -1, false);
      opacity.value = withRepeat(withTiming(0, { duration: durationMs, easing: Easing.out(Easing.ease) }), -1, false);
    }
  }, [reducedMotion, durationMs, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        animatedStyle,
        style,
      ]}
    />
  );
}

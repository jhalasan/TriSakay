import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { colors, elevation } from '@trisakay/ui';
import { useMapScale } from './useMapScale';

export interface MapPinProps {
  /** Baseline-px tip position — where the pin actually points to (e.g. the route's endpoint). */
  x: number;
  y: number;
  tone: 'navy' | 'green';
  delayMs?: number;
}

/**
 * The teardrop pin: a 30×30 box with three rounded corners, rotated -45deg
 * so the unrounded corner becomes the pointed tip — the CSS `border-radius:
 * 50% 50% 50% 0` trick (the fourth, bottom-left, value is the sharp corner),
 * rotated around the box's own default center.
 *
 * The source markup positions this box by its raw `left`/`top`, which (by
 * construction — verified against every pin in the handoff) puts the route
 * line's endpoint at the box's *center*, not its rotated tip: the tip then
 * hangs `r·√2` below the line (`r` = half the box size). That reads as the
 * line passing through the pin rather than the pin marking its end, so here
 * `(x, y)` is the intended tip instead, and the box is shifted up by
 * `r·√2` (to center it) plus `r` (to reach the box's corner) before
 * rotating, so the tip lands exactly on the given point.
 */
export function MapPin({ x, y, tone, delayMs = 200 }: MapPinProps) {
  const scale = useMapScale();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) return;
    progress.value = 0;
    progress.value = withDelay(delayMs, withTiming(1, { duration: 500, easing: Easing.bezier(0.34, 1.4, 0.64, 1) }));
  }, [delayMs, reducedMotion]);

  const size = scale(30);
  const dotSize = scale(10);
  const offset = scale(24);
  const color = tone === 'navy' ? colors.accentBlue : colors.accentGreen;

  const r = size / 2;
  const tipToBoxTop = r * (1 + Math.SQRT2);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateX: (1 - progress.value) * -offset },
      { translateY: (1 - progress.value) * -offset },
      { rotate: '-45deg' },
    ],
  }));

  return (
    <Animated.View
      style={[
        elevation.pin,
        {
          position: 'absolute',
          left: scale(x) - r,
          top: scale(y) - tipToBoxTop,
          width: size,
          height: size,
          backgroundColor: color,
          borderTopLeftRadius: r,
          borderTopRightRadius: r,
          borderBottomRightRadius: r,
          borderBottomLeftRadius: 0,
          alignItems: 'center',
          justifyContent: 'center',
        },
        animatedStyle,
      ]}
    >
      <View style={{ width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: colors.white }} />
    </Animated.View>
  );
}

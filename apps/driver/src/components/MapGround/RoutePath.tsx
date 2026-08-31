import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@trisakay/ui';
import { useMapScale } from './useMapScale';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export interface RoutePoint {
  x: number;
  y: number;
}

export interface RoutePathProps {
  /** Baseline-px waypoints, drawn as a right-angle polyline (M ... L ... L ...). */
  points: RoutePoint[];
  durationMs?: number;
  delayMs?: number;
}

/** The green route line, drawn on mount via an animated `strokeDashoffset`. */
export function RoutePath({ points, durationMs = 1050, delayMs = 250 }: RoutePathProps) {
  const scale = useMapScale();
  const reducedMotion = useReducedMotion();

  const scaled = points.map((p) => ({ x: scale(p.x), y: scale(p.y) }));
  const d = scaled.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const length = scaled.slice(1).reduce((total, p, i) => total + Math.hypot(p.x - scaled[i].x, p.y - scaled[i].y), 0);

  const dashOffset = useSharedValue(reducedMotion ? 0 : length);

  useEffect(() => {
    if (reducedMotion) return;
    dashOffset.value = length;
    dashOffset.value = withDelay(delayMs, withTiming(0, { duration: durationMs, easing: Easing.bezier(0.4, 0, 0.2, 1) }));
    // Re-run only when the drawn shape actually changes — not on every scale() identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, length, reducedMotion]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: dashOffset.value }));

  return (
    <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%" pointerEvents="none">
      <AnimatedPath
        d={d}
        stroke={colors.accentGreen}
        strokeWidth={scale(6)}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={length}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}

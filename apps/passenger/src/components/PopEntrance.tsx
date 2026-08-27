import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export interface PopEntranceProps {
  delayMs?: number;
  durationMs?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * The "pop" entrance shared by the splash lockup card and the walkthrough
 * fare/driver cards: opacity 0 → 1 while scale overshoots 0.88 → 1.03 → 1.
 */
export function PopEntrance({ delayMs = 300, durationMs = 700, style, children }: PopEntranceProps) {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(reducedMotion ? 1 : 0);
  const scale = useSharedValue(reducedMotion ? 1 : 0.88);

  useEffect(() => {
    if (reducedMotion) return;
    opacity.value = 0;
    scale.value = 0.88;
    opacity.value = withDelay(delayMs, withTiming(1, { duration: durationMs * 0.4 }));
    scale.value = withDelay(
      delayMs,
      withSequence(
        withTiming(1.03, { duration: durationMs * 0.65, easing: Easing.bezier(0.2, 0.7, 0.3, 1) }),
        withTiming(1, { duration: durationMs * 0.35, easing: Easing.bezier(0.2, 0.7, 0.3, 1) }),
      ),
    );
  }, [delayMs, durationMs, reducedMotion, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

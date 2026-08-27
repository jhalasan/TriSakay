import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { colors, elevation, radius, typography } from '@trisakay/ui';
import { useMapScale } from './useMapScale';

export interface LabelChipProps {
  /** Baseline-px position — x is the chip's horizontal centre, y is its top edge. */
  x: number;
  y: number;
  label: string;
  delayMs?: number;
}

/** A white pill label anchored to a pin's x-centre (e.g. "Pickup", "PSO verified"). */
export function LabelChip({ x, y, label, delayMs = 950 }: LabelChipProps) {
  const scale = useMapScale();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(reducedMotion ? 1 : 0);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    opacity.value = 0;
    opacity.value = withDelay(delayMs, withTiming(1, { duration: 400 }));
  }, [delayMs, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[
        elevation.chip,
        {
          position: 'absolute',
          left: scale(x) - width / 2,
          top: scale(y),
          backgroundColor: colors.white,
          borderRadius: radius.pill,
          paddingVertical: scale(5),
          paddingHorizontal: scale(11),
        },
        animatedStyle,
      ]}
    >
      <Text style={[typography.chip, { color: colors.ink }]}>{label}</Text>
    </Animated.View>
  );
}

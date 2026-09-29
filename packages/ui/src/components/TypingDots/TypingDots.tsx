import { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { colors } from '../../theme';

export interface TypingDotsProps {
  color?: string;
  style?: StyleProp<ViewStyle>;
}

const DOT_SIZE = 6;
const CYCLE_MS = 900;

function Dot({ delayMs, color, reducedMotion }: { delayMs: number; color: string; reducedMotion: boolean }) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    translateY.value = withDelay(
      delayMs,
      withRepeat(withSequence(withTiming(-4, { duration: CYCLE_MS / 2, easing: Easing.out(Easing.ease) }), withTiming(0, { duration: CYCLE_MS / 2, easing: Easing.in(Easing.ease) })), -1, false)
    );
  }, [reducedMotion, delayMs, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  return <Animated.View style={[{ width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2, backgroundColor: color }, animatedStyle]} />;
}

/** The chat thread's "typing…" indicator — three dots bouncing in sequence, same reanimated/reduced-motion discipline as `PulseRing`. */
export function TypingDots({ color = colors.inkSoft, style }: TypingDotsProps) {
  const reducedMotion = useReducedMotion();
  return (
    <View style={[{ flexDirection: 'row', gap: 4, alignItems: 'center' }, style]}>
      <Dot delayMs={0} color={color} reducedMotion={reducedMotion} />
      <Dot delayMs={150} color={color} reducedMotion={reducedMotion} />
      <Dot delayMs={300} color={color} reducedMotion={reducedMotion} />
    </View>
  );
}

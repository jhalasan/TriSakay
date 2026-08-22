import { useRef, useState } from 'react';
import { Animated, Pressable, Text, type PressableProps } from 'react-native';
import { motion } from '../../theme';
import { styles } from './HoldToConfirmButton.styles';

/** How long the press must be held before onConfirm fires. Not part of the
 *  shared `motion` tokens — this is a one-off interaction duration, not a
 *  reusable transition timing. */
const HOLD_DURATION_MS = 900;

export interface HoldToConfirmButtonProps extends Omit<PressableProps, 'style' | 'onPressIn' | 'onPressOut'> {
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
}

/**
 * A press-and-hold danger action, for triggers too consequential for a
 * single tap (the SOS button, FR-12's wireframe review item 8). A
 * translucent fill sweeps left-to-right over the hold duration as visible
 * progress feedback; releasing early cancels and resets it. No RN component
 * render-testing exists anywhere in this repo (see docs/superpowers/specs/
 * 2026-08-21-emergency-sos-alert-design.md, section B) — this is verified
 * live in Expo web, not by a unit test.
 */
export function HoldToConfirmButton({ label, onConfirm, disabled = false, fullWidth = false, ...pressableProps }: HoldToConfirmButtonProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const [holding, setHolding] = useState(false);

  function handlePressIn() {
    if (disabled) return;
    setHolding(true);
    Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_DURATION_MS,
      easing: motion.easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) onConfirm();
    });
  }

  function handlePressOut() {
    setHolding(false);
    Animated.timing(progress, {
      toValue: 0,
      duration: motion.duration.quick,
      easing: motion.easing.out,
      useNativeDriver: false,
    }).start();
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityHint="Press and hold to confirm"
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.base, fullWidth && styles.fullWidth, disabled && styles.disabled]}
      {...pressableProps}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.fill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
      />
      <Animated.View style={styles.content}>
        <Text style={styles.label}>{holding ? 'Keep holding…' : label}</Text>
      </Animated.View>
    </Pressable>
  );
}

import { useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, Text, View, type PressableProps } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, motion, recordsPalette } from '../../theme';
import { GradientSurface } from '../GradientSurface';
import { styles } from './HoldToConfirmButton.styles';

/** How long the press must be held before onConfirm fires. Not part of the
 *  shared `motion` tokens — this is a one-off interaction duration, not a
 *  reusable transition timing. */
const HOLD_DURATION_MS = 900;

/** `variant="disc"` geometry — the Privacy & Safety SOS: a 148 outer disc, a 5px ring track inset in it, a 116 inner disc. */
const DISC_OUTER = 148;
const DISC_INNER = 116;
const DISC_RING_STROKE = 5;
const DISC_RING_RADIUS = (DISC_OUTER - DISC_RING_STROKE) / 2;
const DISC_RING_CIRCUMFERENCE = 2 * Math.PI * DISC_RING_RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** `variant="fab"` geometry — a 58px circle with a 3px ring, the progress ring drawn just outside it. */
const FAB_SIZE = 58;
const FAB_RING_STROKE = 3;
const FAB_RING_RADIUS = FAB_SIZE / 2 + FAB_RING_STROKE / 2;
const FAB_RING_BOX = FAB_SIZE + FAB_RING_STROKE * 2;
const FAB_RING_CIRCUMFERENCE = 2 * Math.PI * FAB_RING_RADIUS;

export interface HoldToConfirmButtonProps extends Omit<PressableProps, 'style' | 'onPressIn' | 'onPressOut'> {
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  /** `'fab'` is the active-trip screen's floating circular SOS (README §6.2) — same hold behaviour, a ring instead of a left-to-right fill. */
  variant?: 'default' | 'fab' | 'disc';
  /** Hold time before `onConfirm` fires. Defaults to 900 ms (the trip SOS); the Privacy & Safety SOS passes 2000. */
  holdDurationMs?: number;
  /** `disc` only: the small line under the label ("Hold 2s"). */
  sublabel?: string;
  /** `disc` only: shows a spinner in place of the label and keeps the ring full while the request is in flight. Presses are ignored. */
  loading?: boolean;
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
export function HoldToConfirmButton({
  label,
  onConfirm,
  disabled = false,
  fullWidth = false,
  icon,
  variant = 'default',
  holdDurationMs = HOLD_DURATION_MS,
  sublabel,
  loading = false,
  ...pressableProps
}: HoldToConfirmButtonProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const [holding, setHolding] = useState(false);

  function handlePressIn() {
    if (disabled || loading) return;
    setHolding(true);
    Animated.timing(progress, {
      toValue: 1,
      duration: holdDurationMs,
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

  if (variant === 'disc') {
    const strokeDashoffset = loading
      ? 0
      : progress.interpolate({ inputRange: [0, 1], outputRange: [DISC_RING_CIRCUMFERENCE, 0] });
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || loading, busy: loading }}
        accessibilityHint="Press and hold to confirm"
        disabled={disabled || loading}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [styles.discOuter, pressed && styles.discPressed, disabled && styles.disabled]}
        {...pressableProps}
      >
        <Svg width={DISC_OUTER} height={DISC_OUTER} style={styles.discRing} pointerEvents="none">
          <Circle
            cx={DISC_OUTER / 2}
            cy={DISC_OUTER / 2}
            r={DISC_RING_RADIUS}
            stroke={recordsPalette.dangerLine}
            strokeWidth={DISC_RING_STROKE}
            fill="none"
          />
          <AnimatedCircle
            cx={DISC_OUTER / 2}
            cy={DISC_OUTER / 2}
            r={DISC_RING_RADIUS}
            stroke={colors.danger}
            strokeWidth={DISC_RING_STROKE}
            fill="none"
            strokeDasharray={DISC_RING_CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation={-90}
            originX={DISC_OUTER / 2}
            originY={DISC_OUTER / 2}
          />
        </Svg>
        <View style={styles.discInnerShadow}>
          <GradientSurface token="sos" direction="diagonal" style={styles.discInner}>
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <View style={styles.discContent}>
                <Text style={styles.discLabel}>{label}</Text>
                {sublabel ? <Text style={styles.discSublabel}>{sublabel}</Text> : null}
              </View>
            )}
          </GradientSurface>
        </View>
      </Pressable>
    );
  }

  if (variant === 'fab') {
    const strokeDashoffset = progress.interpolate({ inputRange: [0, 1], outputRange: [FAB_RING_CIRCUMFERENCE, 0] });
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        accessibilityHint="Press and hold to confirm"
        disabled={disabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.fab, disabled && styles.disabled]}
        {...pressableProps}
      >
        <Svg width={FAB_RING_BOX} height={FAB_RING_BOX} style={styles.fabRing} pointerEvents="none">
          <AnimatedCircle
            cx={FAB_RING_BOX / 2}
            cy={FAB_RING_BOX / 2}
            r={FAB_RING_RADIUS}
            stroke={colors.white}
            strokeWidth={FAB_RING_STROKE}
            fill="none"
            strokeDasharray={FAB_RING_CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation={-90}
            originX={FAB_RING_BOX / 2}
            originY={FAB_RING_BOX / 2}
          />
        </Svg>
        <View style={styles.fabContent}>
          {icon}
          <Text style={styles.fabLabel}>{label}</Text>
        </View>
      </Pressable>
    );
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
        {icon && <View style={styles.iconSlot}>{icon}</View>}
        <Text style={styles.label}>{holding ? 'Keep holding…' : label}</Text>
      </Animated.View>
    </Pressable>
  );
}

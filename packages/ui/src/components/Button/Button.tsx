import { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';
import { colors, elevation, motion, radius } from '../../theme';
import { GradientSurface } from '../GradientSurface';
import { styles } from './Button.styles';

export type ButtonVariant = 'solid' | 'outline' | 'ghost';
export type ButtonTone = 'primary' | 'neutral' | 'danger';
export type ButtonSize = 'md' | 'sm';

export interface ButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

const TONES = {
  primary: { solid: colors.accentBlue, pressed: colors.accentBluePressed, text: colors.accentBlue },
  neutral: { solid: colors.ink, pressed: colors.inkPressed, text: colors.ink },
  danger: { solid: colors.danger, pressed: colors.dangerPressed, text: colors.danger },
} as const;

function surfaceFor(tone: ButtonTone, variant: ButtonVariant, pressed: boolean, isDisabled: boolean) {
  const t = TONES[tone];
  if (variant === 'solid') {
    // Disabled solid buttons get their own flat neutral surface, not a
    // dimmed version of the tone's fill — matches the redesign's disabled
    // CTA treatment (e.g. the consent gate's "Accept & Continue").
    if (isDisabled) {
      return { backgroundColor: colors.fill, borderColor: colors.fill, textColor: colors.inkFaint };
    }
    const bg = pressed ? t.pressed : t.solid;
    return { backgroundColor: bg, borderColor: bg, textColor: colors.white };
  }
  if (variant === 'outline') {
    return {
      backgroundColor: pressed ? colors.fill : 'transparent',
      borderColor: colors.lineStrong,
      textColor: t.text,
    };
  }
  return {
    backgroundColor: pressed ? colors.fill : 'transparent',
    borderColor: 'transparent',
    textColor: t.text,
  };
}

export function Button({
  label,
  variant = 'solid',
  tone = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled = false,
  icon,
  onPressIn,
  onPressOut,
  ...pressableProps
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) =>
    Animated.timing(scale, {
      toValue: value,
      duration: motion.duration.instant,
      easing: motion.easing.out,
      useNativeDriver: true,
    }).start();

  return (
    <Animated.View style={[fullWidth && styles.fullWidth, { transform: [{ scale }] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        disabled={isDisabled}
        hitSlop={4}
        onPressIn={(e) => {
          if (!isDisabled) animateTo(motion.pressScale);
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          animateTo(1);
          onPressOut?.(e);
        }}
        style={({ pressed }) => {
          const s = surfaceFor(tone, variant, pressed, isDisabled);
          // The primary solid CTA carries its fill as a gradient (rendered
          // as a child below) instead of a flat backgroundColor — this is
          // the one signature surface, deliberately not spread to every
          // button so it stays a highlight rather than becoming noise.
          const usesGradientFill = tone === 'primary' && variant === 'solid' && !pressed && !isDisabled;
          return [
            styles.base,
            size === 'md' ? styles.md : styles.sm,
            fullWidth && styles.fullWidth,
            variant === 'solid' && !isDisabled && elevation.button,
            { backgroundColor: usesGradientFill ? 'transparent' : s.backgroundColor, borderColor: s.borderColor },
            // Solid disabled already renders its own flat colors.fill surface
            // above — only outline/ghost fall back to a plain opacity dim.
            isDisabled && variant !== 'solid' && styles.disabled,
          ];
        }}
        {...pressableProps}
      >
        {({ pressed }) => {
          const s = surfaceFor(tone, variant, pressed, isDisabled);
          const usesGradientFill = tone === 'primary' && variant === 'solid' && !pressed && !isDisabled;
          return (
            <>
              {usesGradientFill && (
                <GradientSurface
                  token="button"
                  direction="diagonal"
                  style={[StyleSheet.absoluteFillObject, { borderRadius: radius.sm2 }]}
                />
              )}
              <View style={styles.content}>
                {loading ? (
                  <ActivityIndicator color={s.textColor} style={styles.iconSlot} />
                ) : (
                  icon && <View style={styles.iconSlot}>{icon}</View>
                )}
                <Text style={[size === 'md' ? styles.labelMd : styles.labelSm, { color: s.textColor }]}>
                  {label}
                </Text>
              </View>
            </>
          );
        }}
      </Pressable>
    </Animated.View>
  );
}

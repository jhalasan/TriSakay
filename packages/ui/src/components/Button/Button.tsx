import { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, Text, View, type PressableProps } from 'react-native';
import { colors, motion } from '../../theme';
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

function surfaceFor(tone: ButtonTone, variant: ButtonVariant, pressed: boolean) {
  const t = TONES[tone];
  if (variant === 'solid') {
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
          const s = surfaceFor(tone, variant, pressed);
          return [
            styles.base,
            size === 'md' ? styles.md : styles.sm,
            fullWidth && styles.fullWidth,
            { backgroundColor: s.backgroundColor, borderColor: s.borderColor },
            isDisabled && styles.disabled,
          ];
        }}
        {...pressableProps}
      >
        {({ pressed }) => {
          const s = surfaceFor(tone, variant, pressed);
          return (
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
          );
        }}
      </Pressable>
    </Animated.View>
  );
}

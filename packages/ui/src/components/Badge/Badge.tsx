import { Text, View } from 'react-native';
import { colors } from '../../theme';
import { styles } from './Badge.styles';

export type BadgeTone = 'neutral' | 'blue' | 'green' | 'danger';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  dot?: boolean;
}

const dotColor: Record<BadgeTone, string> = {
  neutral: colors.inkFaint,
  blue: colors.accentBlue,
  green: colors.accentGreen,
  danger: colors.danger,
};

export function Badge({ label, tone = 'neutral', dot = false }: BadgeProps) {
  const toneStyle = styles[tone];
  const textStyle = styles[`${tone}Text` as const];

  return (
    <View style={[styles.base, toneStyle]}>
      {dot && <View style={[styles.dot, { backgroundColor: dotColor[tone] }]} />}
      <Text style={[styles.label, textStyle]}>{label}</Text>
    </View>
  );
}

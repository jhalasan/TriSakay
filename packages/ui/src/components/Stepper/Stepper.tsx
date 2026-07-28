import { Pressable, Text, View } from 'react-native';
import { styles } from './Stepper.styles';

export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function Stepper({ value, onChange, min = 1, max = 10, step = 1 }: StepperProps) {
  const canDecrease = value - step >= min;
  const canIncrease = value + step <= max;

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Decrease"
        disabled={!canDecrease}
        onPress={() => onChange(Math.max(min, value - step))}
        style={[styles.button, !canDecrease && styles.buttonDisabled]}
      >
        <Text style={styles.buttonGlyph}>−</Text>
      </Pressable>
      <Text style={styles.value}>{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Increase"
        disabled={!canIncrease}
        onPress={() => onChange(Math.min(max, value + step))}
        style={[styles.button, !canIncrease && styles.buttonDisabled]}
      >
        <Text style={styles.buttonGlyph}>+</Text>
      </Pressable>
    </View>
  );
}

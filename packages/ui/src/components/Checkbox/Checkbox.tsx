import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View, type PressableProps } from 'react-native';
import { colors } from '../../theme';
import { styles } from './Checkbox.styles';

export interface CheckboxProps extends Omit<PressableProps, 'style' | 'onPress'> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export function Checkbox({ checked, onChange, label, disabled = false, ...pressableProps }: CheckboxProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: disabled ?? false }}
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={8}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [styles.row, pressed && !disabled && styles.rowPressed, disabled && styles.disabled]}
      {...pressableProps}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && <Ionicons name="checkmark" size={16} color={colors.white} />}
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </Pressable>
  );
}

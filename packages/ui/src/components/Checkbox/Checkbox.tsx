import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View, type PressableProps } from 'react-native';
import { colors } from '../../theme';
import { styles } from './Checkbox.styles';

export interface CheckboxProps extends Omit<PressableProps, 'style' | 'onPress'> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export function Checkbox({
  checked,
  onChange,
  label,
  accessibilityLabel,
  disabled = false,
  ...pressableProps
}: CheckboxProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      // `?? false` is not redundant with the `= false` default above. RN types
      // PressableProps.disabled as `null | boolean | undefined`, and a parameter
      // default only substitutes for `undefined`, so an explicit
      // `disabled={null}` still arrives here as null — which AccessibilityState
      // does not accept. Removing this is a type error, not a tidy-up.
      accessibilityState={{ checked, disabled: disabled ?? false }}
      // `label` is optional, so binding the accessible name to it alone leaves
      // a screen-reader user with an unnamed checkbox any time the visible text
      // sits outside this component. Let such a caller name the control.
      accessibilityLabel={accessibilityLabel ?? label}
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

import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { colors } from '@trisakay/ui';
import { styles } from './CheckboxRow.styles';

export interface CheckboxRowProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
}

export function CheckboxRow({ label, checked, onToggle }: CheckboxRowProps) {
  return (
    <Pressable style={styles.row} onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && <Ionicons name="checkmark" size={15} color={colors.white} />}
      </View>
    </Pressable>
  );
}

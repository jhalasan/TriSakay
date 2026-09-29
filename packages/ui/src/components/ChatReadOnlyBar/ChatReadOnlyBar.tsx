import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { styles } from './ChatReadOnlyBar.styles';

export interface ChatReadOnlyBarProps {
  message: string;
  reportLabel: string;
  onReport: () => void;
  /** Safe-area bottom inset, same "screen supplies it" convention as `ChatHeader`'s `topInset`. */
  bottomInset?: number;
}

/** Shown instead of the chips + composer once the ride has ended (RLS blocks new inserts) — Part C §C10. */
export function ChatReadOnlyBar({ message, reportLabel, onReport, bottomInset = 0 }: ChatReadOnlyBarProps) {
  return (
    <View style={[styles.bar, { paddingBottom: 18 + bottomInset }]}>
      <View style={styles.row}>
        <Ionicons name="lock-closed-outline" size={18} color={colors.inkSoft} />
        <Text style={styles.text}>{message}</Text>
      </View>
      <Pressable accessibilityRole="button" style={styles.button} onPress={onReport}>
        <Ionicons name="flag-outline" size={15} color={colors.ink} />
        <Text style={styles.buttonText}>{reportLabel}</Text>
      </Pressable>
    </View>
  );
}

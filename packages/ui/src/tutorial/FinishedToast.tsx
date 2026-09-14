import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { styles } from './FinishedToast.styles';

export interface FinishedToastProps {
  message: string;
  onRestart: () => void;
}

/** Step-N+1 finished toast. Auto-closes a beat after mounting (TutorialProvider owns the timer) unless Restart is tapped first. */
export function FinishedToast({ message, onRestart }: FinishedToastProps) {
  return (
    <View style={styles.finishedToast} pointerEvents="box-none">
      <View style={styles.finishedToastCheckTile}>
        <Ionicons name="checkmark" size={14} color={styles.finishedToastCheckColor.color} />
      </View>
      <Text style={styles.finishedToastMessage}>{message}</Text>
      <Pressable accessibilityRole="button" onPress={onRestart} hitSlop={8}>
        <Text style={styles.finishedToastRestart}>Restart</Text>
      </Pressable>
    </View>
  );
}

import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { styles } from './ChatErrorBar.styles';

export interface ChatErrorBarProps {
  message: string;
  /** Omit to hide the Retry button — used for the rate-limit case (Part C §C6), which auto-clears instead. */
  onRetry?: () => void;
  retryLabel?: string;
}

/** Send/photo/rate-limit error banner (Part C §C6) — replaces the plain red text line above the chips. */
export function ChatErrorBar({ message, onRetry, retryLabel }: ChatErrorBarProps) {
  return (
    <View style={styles.row} accessibilityRole="alert">
      <Ionicons name="alert-circle" size={15} color={colors.danger} />
      <Text style={styles.text}>{message}</Text>
      {onRetry && (
        <Pressable accessibilityRole="button" style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryText}>{retryLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

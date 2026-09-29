import { Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { styles } from './ChatComposer.styles';

export interface ChatComposerProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  /** Omit to hide the attach button entirely (e.g. while an upload is already in flight). */
  onAttachPhoto?: () => void;
  sending?: boolean;
  placeholder: string;
  maxLength?: number;
  disabled?: boolean;
}

/** Text input + send button (+ optional photo-attach icon) row, pinned to the bottom of a chat screen. Neither `TextField` nor `Button` fit this row shape, so this is its own component. */
export function ChatComposer({ value, onChangeText, onSend, onAttachPhoto, sending = false, placeholder, maxLength = 1000, disabled = false }: ChatComposerProps) {
  const canSend = value.trim().length > 0 && !sending && !disabled;

  return (
    <View style={styles.row}>
      {onAttachPhoto && (
        <Pressable accessibilityRole="button" style={styles.attachButton} disabled={disabled} onPress={onAttachPhoto}>
          <Ionicons name="camera-outline" size={22} color={colors.inkSoft} />
        </Pressable>
      )}
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.inkFaint}
          multiline
          maxLength={maxLength}
          editable={!disabled}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={placeholder}
        style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
        disabled={!canSend}
        onPress={onSend}
      >
        <Ionicons name="send" size={17} color={canSend ? colors.white : colors.inkFaint} />
      </Pressable>
    </View>
  );
}

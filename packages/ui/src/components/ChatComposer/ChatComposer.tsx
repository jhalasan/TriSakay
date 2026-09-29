import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
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
  /** Shown as `{n}/{maxLength}` once `value.length` reaches this threshold (Part C §C8). */
  counterThreshold?: number;
}

/** Text input + send button (+ optional photo-attach icon) row, pinned to the bottom of a chat screen. Neither `TextField` nor `Button` fit this row shape, so this is its own component. */
export function ChatComposer({
  value,
  onChangeText,
  onSend,
  onAttachPhoto,
  sending = false,
  placeholder,
  maxLength = 1000,
  disabled = false,
  counterThreshold = 900,
}: ChatComposerProps) {
  const [focused, setFocused] = useState(false);
  const canSend = value.trim().length > 0 && !sending && !disabled;
  const showCounter = value.length >= counterThreshold;

  return (
    <View style={styles.wrap}>
      {showCounter && (
        <Text style={styles.counter}>
          {value.length}/{maxLength}
        </Text>
      )}
      <View style={styles.row}>
        {onAttachPhoto && (
          <Pressable accessibilityRole="button" style={styles.attachButton} disabled={disabled} onPress={onAttachPhoto}>
            <Ionicons name="camera-outline" size={21} color={colors.inkSoft} />
          </Pressable>
        )}
        <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
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
          style={[styles.sendButton, !canSend && !sending && styles.sendButtonDisabled]}
          disabled={!canSend}
          onPress={onSend}
        >
          {sending ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name="send" size={17} color={canSend ? colors.white : colors.inkFaint} />}
        </Pressable>
      </View>
    </View>
  );
}

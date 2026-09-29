import { Pressable, ScrollView, Text } from 'react-native';
import { styles } from './QuickReplyRow.styles';

export interface QuickReplyOption {
  code: string;
  label: string;
}

export interface QuickReplyRowProps {
  options: QuickReplyOption[];
  onSelect: (code: string) => void;
  disabled?: boolean;
}

/** A horizontal row of fixed quick-reply chips above the composer — driver and passenger each pass their own (already-localized) option set. */
export function QuickReplyRow({ options, onSelect, disabled = false }: QuickReplyRowProps) {
  if (options.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content}>
      {options.map((option) => (
        <Pressable
          key={option.code}
          accessibilityRole="button"
          disabled={disabled}
          style={[styles.chip, disabled && styles.chipDisabled]}
          onPress={() => onSelect(option.code)}
        >
          <Text style={styles.chipText}>{option.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

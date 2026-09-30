import { Pressable, ScrollView, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { styles } from './QuickReplyRow.styles';

export interface QuickReplyOption {
  code: string;
  label: string;
}

export type QuickReplyRowSize = 'md' | 'lg';

export interface QuickReplyRowProps {
  options: QuickReplyOption[];
  onSelect: (code: string) => void;
  disabled?: boolean;
  /** `'lg'` is the driver's larger, easier-to-hit-while-driving chip (Part C §C7). Defaults to `'md'` (passenger). */
  size?: QuickReplyRowSize;
}

/** A horizontal row of fixed quick-reply chips above the composer — driver and passenger each pass their own (already-localized) option set. */
export function QuickReplyRow({ options, onSelect, disabled = false, size = 'md' }: QuickReplyRowProps) {
  if (options.length === 0) return null;
  const isLg = size === 'lg';
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.content}>
      {options.map((option) => (
        <Pressable
          key={option.code}
          accessibilityRole="button"
          disabled={disabled}
          hitSlop={isLg ? undefined : 4}
          style={[styles.chip, isLg ? styles.chipLg : styles.chipMd, disabled && styles.chipDisabled]}
          onPress={() => onSelect(option.code)}
        >
          <Ionicons name="flash" size={isLg ? 12 : 11} color={colors.accentBlue} />
          <Text numberOfLines={1} style={[styles.chipText, isLg && styles.chipTextLg]}>
            {option.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors } from '../../theme';
import { styles } from './TextField.styles';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
}

export function TextField({
  label,
  error,
  helperText,
  leftIcon,
  secureTextEntry,
  onFocus,
  onBlur,
  ...inputProps
}: TextFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.fieldRow,
          isFocused && styles.fieldRowFocused,
          !!error && styles.fieldRowError,
        ]}
      >
        {leftIcon && <View style={styles.iconSlot}>{leftIcon}</View>}
        <TextInput
          style={styles.input}
          placeholderTextColor={colors.inkFaint}
          secureTextEntry={secureTextEntry && !isRevealed}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...inputProps}
        />
        {secureTextEntry && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isRevealed ? 'Hide password' : 'Show password'}
            hitSlop={8}
            onPress={() => setIsRevealed((prev) => !prev)}
            style={styles.revealButton}
          >
            <Ionicons name={isRevealed ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.inkSoft} />
          </Pressable>
        )}
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

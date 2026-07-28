import { useState } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors } from '../../theme';
import { styles } from './TextField.styles';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
}

export function TextField({ label, error, helperText, leftIcon, onFocus, onBlur, ...inputProps }: TextFieldProps) {
  const [isFocused, setIsFocused] = useState(false);

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
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

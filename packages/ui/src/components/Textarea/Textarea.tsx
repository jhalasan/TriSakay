import { useState } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors } from '../../theme';
import { styles } from './Textarea.styles';

export interface TextareaProps extends Omit<TextInputProps, 'style' | 'multiline'> {
  label?: string;
}

export function Textarea({ label, onFocus, onBlur, ...inputProps }: TextareaProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.field, isFocused && styles.fieldFocused]}>
        <TextInput
          style={styles.input}
          multiline
          numberOfLines={4}
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
    </View>
  );
}

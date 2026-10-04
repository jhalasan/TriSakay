import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fontFamily, radius } from '../../theme';

export interface PasswordFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  error?: string;
  showLabel: string;
  hideLabel: string;
  autoComplete?: 'password' | 'new-password' | 'current-password';
  /**
   * Keeps the phone's password manager out of this field. A screen with several password fields that
   * carry different autofill hints (current + new) can make Android's autofill move focus between them
   * every time one is tapped, so the change password screens turn it off.
   */
  disableAutofill?: boolean;
}

/** A masked field with an eye toggle, styled as the handoff's resting (1px line) / focused (1.5px navy) input. */
export function PasswordField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  showLabel,
  hideLabel,
  autoComplete = 'password',
  disableAutofill = false,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, focused && styles.fieldFocused, !!error && styles.fieldError]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.inkFaint}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={disableAutofill ? 'off' : autoComplete}
          importantForAutofill={disableAutofill ? 'no' : 'auto'}
          textContentType={disableAutofill ? 'none' : undefined}
          accessibilityLabel={label}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? hideLabel : showLabel}
          hitSlop={10}
          onPress={() => setVisible((v) => !v)}
          style={styles.eye}
        >
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.inkSoft} />
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 7 },
  label: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.inkSoft,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  fieldFocused: {
    borderWidth: 1.5,
    borderColor: colors.accentBlue,
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 2,
  },
  fieldError: { borderColor: colors.danger },
  input: { flex: 1, fontFamily: fontFamily.regular, fontSize: 15, color: colors.ink, paddingVertical: 12 },
  eye: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginRight: -12 },
  error: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: colors.danger },
});

import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { requestPasswordReset, signOut, updatePassword, verifyPasswordReset } from '@trisakay/services';
import { Button, TextField } from '@trisakay/ui';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { isValidPassword } from '../src/utils/validation';
import { styles } from '../src/styles/auth/reset-password.styles';

interface FormErrors {
  code?: string;
  password?: string;
  confirmPassword?: string;
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [done, setDone] = useState(false);

  if (!email) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Reset password" />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.intro}>
            We couldn't find the email for this reset. Please start again from the login screen.
          </Text>
          <Button label="Back to login" fullWidth onPress={() => router.replace('/(auth)/login')} />
        </ScrollView>
      </View>
    );
  }

  async function handleResend() {
    setResending(true);
    setFormError(null);
    const { error } = await requestPasswordReset(email!);
    setResending(false);
    if (error) setFormError(error);
  }

  async function handleSubmit() {
    const nextErrors: FormErrors = {};
    if (code.trim().length === 0) nextErrors.code = 'Enter the code we emailed you.';
    if (!isValidPassword(password)) nextErrors.password = 'Password must be at least 6 characters.';
    if (confirmPassword !== password) nextErrors.confirmPassword = "Passwords don't match.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setFormError(null);
    setSubmitting(true);

    const { error: verifyError } = await verifyPasswordReset({ email: email!, token: code.trim() });
    if (verifyError) {
      setSubmitting(false);
      setFormError('That code is invalid or has expired. Request a new one below.');
      return;
    }

    const { error: updateError } = await updatePassword(password);
    setSubmitting(false);

    if (updateError) {
      // A recovery session now exists without the password having changed —
      // sign it back out so the reset stays all-or-nothing, then let the
      // driver retry with a fresh code rather than land half-authenticated.
      await signOut();
      setFormError("Couldn't update your password. Request a new code and try again.");
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Reset password" showBack={false} />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.successTitle}>Password updated</Text>
          <Text style={styles.successBody}>You're signed in with your new password.</Text>
          <Button label="Continue" fullWidth onPress={() => router.replace('/(tabs)/dashboard')} />
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Reset password" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>Enter the code we sent to {email} and choose a new password.</Text>

        <View style={styles.fields}>
          <TextField
            label="Code"
            placeholder="123456"
            value={code}
            onChangeText={setCode}
            error={errors.code}
            keyboardType="number-pad"
          />
          <TextField
            label="New password"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secureTextEntry
            autoComplete="password-new"
          />
          <TextField
            label="Confirm new password"
            placeholder="••••••••"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            error={errors.confirmPassword}
            secureTextEntry
            autoComplete="password-new"
          />
        </View>

        <Text style={styles.resendLink} onPress={resending ? undefined : handleResend}>
          <Text style={styles.resendLinkText}>{resending ? 'Sending…' : 'Resend code'}</Text>
        </Text>

        {formError && <Text style={styles.authError}>{formError}</Text>}

        <Button label="Reset password" fullWidth loading={submitting} onPress={handleSubmit} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

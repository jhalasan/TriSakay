import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { requestPasswordReset, signOut, updatePassword, verifyPasswordReset } from '@trisakay/services';
import { Button, TextField } from '@trisakay/ui';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { useTranslation } from '../src/hooks/useTranslation';
import { interpolate } from '../src/utils/interpolate';
import { isValidPassword } from '../src/utils/validation';
import { styles } from '../src/styles/auth/reset-password.styles';

interface FormErrors {
  code?: string;
  password?: string;
  confirmPassword?: string;
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const t = useTranslation();
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
        <ScreenHeader title={t.driver.resetPassword.title} />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.intro}>{t.driver.resetPassword.noEmailFound}</Text>
          <Button label={t.driver.resetPassword.backToLogin} fullWidth onPress={() => router.replace('/(auth)/login')} />
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
    if (code.trim().length === 0) nextErrors.code = t.driver.resetPassword.enterCode;
    if (!isValidPassword(password)) nextErrors.password = t.driver.resetPassword.passwordMinLength;
    if (confirmPassword !== password) nextErrors.confirmPassword = t.driver.resetPassword.passwordsDontMatch;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setFormError(null);
    setSubmitting(true);

    const { error: verifyError } = await verifyPasswordReset({ email: email!, token: code.trim() });
    if (verifyError) {
      setSubmitting(false);
      setFormError(t.driver.resetPassword.codeInvalid);
      return;
    }

    const { error: updateError } = await updatePassword(password);
    setSubmitting(false);

    if (updateError) {
      // A recovery session now exists without the password having changed —
      // sign it back out so the reset stays all-or-nothing, then let the
      // driver retry with a fresh code rather than land half-authenticated.
      await signOut();
      setFormError(t.driver.resetPassword.couldNotUpdatePassword);
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t.driver.resetPassword.title} showBack={false} />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.successTitle}>{t.driver.resetPassword.passwordUpdatedTitle}</Text>
          <Text style={styles.successBody}>{t.driver.resetPassword.passwordUpdatedBody}</Text>
          <Button label={t.driver.resetPassword.continueButton} fullWidth onPress={() => router.replace('/(tabs)/dashboard')} />
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title={t.driver.resetPassword.title} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>{interpolate(t.driver.resetPassword.introWithEmail, { email })}</Text>

        <View style={styles.fields}>
          <TextField
            label={t.driver.resetPassword.code}
            placeholder="123456"
            value={code}
            onChangeText={setCode}
            error={errors.code}
            keyboardType="number-pad"
          />
          <TextField
            label={t.driver.resetPassword.newPassword}
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secureTextEntry
            autoComplete="password-new"
          />
          <TextField
            label={t.driver.resetPassword.confirmNewPassword}
            placeholder="••••••••"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            error={errors.confirmPassword}
            secureTextEntry
            autoComplete="password-new"
          />
        </View>

        <Text style={styles.resendLink} onPress={resending ? undefined : handleResend}>
          <Text style={styles.resendLinkText}>{resending ? t.driver.resetPassword.sending : t.driver.resetPassword.resendCode}</Text>
        </Text>

        {formError && <Text style={styles.authError}>{formError}</Text>}

        <Button label={t.driver.resetPassword.resetPasswordButton} fullWidth loading={submitting} onPress={handleSubmit} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

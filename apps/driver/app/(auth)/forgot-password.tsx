import { useState } from 'react';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { requestPasswordReset } from '@trisakay/services';
import { Button, TextField } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useTranslation } from '../../src/hooks/useTranslation';
import { isValidEmail } from '../../src/utils/validation';
import { styles } from '../../src/styles/auth/forgot-password.styles';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const t = useTranslation();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSendCode() {
    if (!isValidEmail(email)) {
      setEmailError(t.driver.forgotPassword.enterValidEmail);
      return;
    }
    setEmailError(undefined);
    setRequestError(null);
    setSubmitting(true);

    const { error } = await requestPasswordReset(email.trim());

    setSubmitting(false);

    if (error) {
      setRequestError(error);
      return;
    }

    router.push({ pathname: '/reset-password', params: { email: email.trim() } });
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title={t.driver.forgotPassword.title} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>{t.driver.forgotPassword.intro}</Text>

        <View style={styles.fields}>
          <TextField
            label={t.driver.forgotPassword.email}
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            error={emailError}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
        </View>

        {requestError && <Text style={styles.authError}>{requestError}</Text>}

        <Button label={t.driver.forgotPassword.sendCode} fullWidth loading={submitting} onPress={handleSendCode} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

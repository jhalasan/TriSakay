import { useState } from 'react';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { requestPasswordReset } from '@trisakay/services';
import { Button, TextField } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { isValidEmail } from '../../src/utils/validation';
import { styles } from '../../src/styles/auth/forgot-password.styles';

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSendCode() {
    if (!isValidEmail(email)) {
      setEmailError('Enter a valid email address.');
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
      <ScreenHeader title="Reset password" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          Enter the email on your account and we'll send you a code to reset your password.
        </Text>

        <View style={styles.fields}>
          <TextField
            label="Email"
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

        <Button label="Send code" fullWidth loading={submitting} onPress={handleSendCode} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

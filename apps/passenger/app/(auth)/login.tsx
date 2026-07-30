import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Button, TextField } from '@trisakay/ui';
import { useAuthStore } from '../../src/store/useAuthStore';
import { isValidEmail, isValidPassword } from '../../src/utils/validation';
import { styles } from './login.styles';

export default function LoginScreen() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const authError = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);
  // Sign-in succeeded and the consent gate is still deciding where this user
  // goes; the root layout deliberately holds this screen in place meanwhile.
  // Without keeping the buttons busy for that whole window the screen looks
  // idle and invites a second sign-in — which would replace the session the
  // in-flight consent check was started for.
  //
  // This flag follows the session, not any one request, so no single store
  // timeout bounds it directly. What bounds it is that each step it waits on
  // is itself timed: useAuthStore's profile fetch settles `isAuthenticated`
  // within the request timeout, and useConsentStore's check() settles
  // `status` within another — after which the root layout routes away and
  // this screen unmounts. It also clears outright if the session drops. So it
  // cannot latch, but only because both of those timeouts exist; removing
  // either one puts this button back at the mercy of a hung request.
  const awaitingGate = useAuthStore((state) => state.sessionUserId !== null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    const nextErrors: typeof errors = {};
    if (!isValidEmail(email)) nextErrors.email = 'Enter a valid email address.';
    if (!isValidPassword(password)) nextErrors.password = 'Password must be at least 6 characters.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    clearError();
    setSubmitting(true);
    await login(email, password);
    setSubmitting(false);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Image
          source={require('../../../../assets/brand/trisakay-mark.png')}
          style={styles.mark}
          resizeMode="contain"
          accessibilityLabel="TriSakay"
        />
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Log in to book your next ride.</Text>

        <View style={styles.fields}>
          <TextField
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <TextField
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secureTextEntry
            autoComplete="password"
          />
        </View>

        {authError ? <Text style={styles.authError}>{authError}</Text> : null}

        <View style={styles.forgotLink}>
          <Text
            style={styles.forgotLinkText}
            onPress={() => Alert.alert('Forgot password', 'Password recovery is not available in this preview.')}
          >
            Forgot password?
          </Text>
        </View>

        <Button label="Log in" onPress={handleLogin} loading={submitting || awaitingGate} fullWidth />

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <Button
          label="Create account"
          variant="outline"
          tone="neutral"
          fullWidth
          disabled={submitting || awaitingGate}
          onPress={() => router.push('/(auth)/register')}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

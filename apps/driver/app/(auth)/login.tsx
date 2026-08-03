import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { BrandMotif, Button, GradientSurface, TextField } from '@trisakay/ui';
import { useAuthStore } from '../../src/store/useAuthStore';
import { isValidEmail, isValidPassword } from '../../src/utils/validation';
import { styles } from '../../src/styles/auth/login.styles';

export default function LoginScreen() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const authError = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);
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
    <View style={styles.screen}>
      <GradientSurface token="hero" direction="diagonal" style={styles.heroBand}>
        <BrandMotif size={200} color="#FFFFFF" opacity={0.1} style={styles.motif} />
      </GradientSurface>
      <View style={styles.badgeWrap}>
        <View style={styles.markBadge}>
          <Image
            source={require('../../../../assets/brand/trisakay-mark.png')}
            style={styles.mark}
            resizeMode="contain"
            accessibilityLabel="TriSakay"
          />
        </View>
      </View>

      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Log in to start driving.</Text>

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
            label="Register as driver"
            variant="outline"
            tone="neutral"
            fullWidth
            disabled={submitting || awaitingGate}
            onPress={() => router.push('/(auth)/register')}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

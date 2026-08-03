import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { BrandMotif, Button, GradientSurface, TextField } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useAuthStore } from '../../src/store/useAuthStore';
import { isNonEmpty, isValidEmail, isValidPassword } from '../../src/utils/validation';
import { styles } from '../../src/styles/auth/register.styles';

interface FormState {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

export default function RegisterScreen() {
  const router = useRouter();
  const register = useAuthStore((state) => state.register);
  const authError = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);
  const awaitingGate = useAuthStore((state) => state.sessionUserId !== null);

  const [form, setForm] = useState<FormState>({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleRegister() {
    const nextErrors: Partial<FormState> = {};
    if (!isNonEmpty(form.name)) nextErrors.name = 'Enter your full name.';
    if (!isValidEmail(form.email)) nextErrors.email = 'Enter a valid email address.';
    if (!isNonEmpty(form.phone)) nextErrors.phone = 'Enter a contact number.';
    if (!isValidPassword(form.password)) nextErrors.password = 'Password must be at least 6 characters.';
    if (form.confirmPassword !== form.password) nextErrors.confirmPassword = 'Passwords do not match.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    clearError();
    setSubmitting(true);
    const outcome = await register(form.name, form.email, form.phone, form.password);
    setSubmitting(false);

    if (outcome === 'check_email') {
      Alert.alert(
        'Check your email',
        `We sent a confirmation link to ${form.email}. Confirm it, then log in.`,
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Register as driver" />
      <GradientSurface token="hero" direction="diagonal" style={styles.heroBand}>
        <BrandMotif size={120} color="#FFFFFF" opacity={0.1} style={styles.motif} />
      </GradientSurface>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Image
          source={require('../../../../assets/brand/trisakay-mark.png')}
          style={styles.markBadge}
          resizeMode="contain"
          accessibilityLabel="TriSakay"
        />

        <TextField
          label="Full name"
          placeholder="Juan Dela Cruz"
          value={form.name}
          onChangeText={(v) => update('name', v)}
          error={errors.name}
          autoCapitalize="words"
        />
        <TextField
          label="Email"
          placeholder="you@example.com"
          value={form.email}
          onChangeText={(v) => update('email', v)}
          error={errors.email}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextField
          label="Phone number"
          placeholder="09XX XXX XXXX"
          value={form.phone}
          onChangeText={(v) => update('phone', v)}
          error={errors.phone}
          keyboardType="phone-pad"
        />
        <TextField
          label="Password"
          placeholder="••••••••"
          value={form.password}
          onChangeText={(v) => update('password', v)}
          error={errors.password}
          secureTextEntry
        />
        <TextField
          label="Confirm password"
          placeholder="••••••••"
          value={form.confirmPassword}
          onChangeText={(v) => update('confirmPassword', v)}
          error={errors.confirmPassword}
          secureTextEntry
        />

        {authError ? <Text style={styles.authError}>{authError}</Text> : null}

        <Button label="Create account" onPress={handleRegister} loading={submitting || awaitingGate} fullWidth />

        <Text style={styles.legalText}>
          By registering, you agree to TriSakay's Terms of Service and Privacy Policy, and confirm you are a
          licensed tricycle driver.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

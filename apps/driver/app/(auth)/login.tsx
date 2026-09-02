import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { BrandMotif, Button, colors, GradientSurface, TextField } from '@trisakay/ui';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { isValidEmail, isValidPassword } from '../../src/utils/validation';
import { styles } from '../../src/styles/auth/login.styles';

export default function LoginScreen() {
  const router = useRouter();
  const t = useTranslation();
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
    if (!isValidEmail(email)) nextErrors.email = t.driver.login.enterValidEmail;
    if (!isValidPassword(password)) nextErrors.password = t.driver.login.passwordMinLength;
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
        <BrandMotif size={200} color={colors.white} opacity={0.1} style={styles.motif} />
        <View style={styles.driverChip}>
          <Ionicons name="shield-checkmark-outline" size={14} color={colors.accentGreenSoft} />
          <Text style={styles.driverChipText}>{t.driver.login.driverChip}</Text>
        </View>
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
          <Text style={styles.title}>{t.driver.login.welcomeBack}</Text>
          <Text style={styles.subtitle}>{t.driver.login.subtitle}</Text>

          <View style={styles.fields}>
            <TextField
              label={t.driver.login.email}
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              error={errors.email}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <TextField
              label={t.driver.login.password}
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
            <Text style={styles.forgotLinkText} onPress={() => router.push('/(auth)/forgot-password')}>
              {t.driver.login.forgotPassword}
            </Text>
          </View>

          <Button label={t.driver.login.logIn} onPress={handleLogin} loading={submitting || awaitingGate} fullWidth />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t.driver.login.or}</Text>
            <View style={styles.dividerLine} />
          </View>

          <Button
            label={t.driver.login.registerAsDriver}
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

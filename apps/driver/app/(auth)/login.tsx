import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { BrandMotif, Button, colors, GradientSurface, SegmentedControl, TextField } from '@trisakay/ui';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { isValidEmail, isValidMobile, isValidPassword } from '../../src/utils/validation';
import { styles } from '../../src/styles/auth/login.styles';

type LoginMethod = 'mobile' | 'email';

export default function LoginScreen() {
  const router = useRouter();
  const t = useTranslation();
  const login = useAuthStore((state) => state.login);
  const authError = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);
  const awaitingGate = useAuthStore((state) => state.sessionUserId !== null);

  const [method, setMethod] = useState<LoginMethod>('email');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; mobile?: string; password?: string }>({});
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

  function handleMobileBlur() {
    if (mobile && !isValidMobile(mobile)) {
      setErrors((prev) => ({ ...prev, mobile: t.driver.login.enterValidMobile }));
    }
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

          {/* Mobile-number sign-in has no backend path (signIn only accepts
              email/password; there's no phone→email lookup) — added as a
              prototype control per request (2026-09-15): submission stays
              disabled on this tab with a "coming soon" notice rather than
              pretending it works. */}
          <View style={styles.methodTrack}>
            <SegmentedControl
              options={[
                { label: t.driver.login.mobileNumber, value: 'mobile' },
                { label: t.driver.login.email, value: 'email' },
              ]}
              value={method}
              onChange={setMethod}
            />
          </View>

          <View style={styles.fields}>
            {method === 'mobile' ? (
              <TextField
                label={t.driver.login.mobileNumber}
                placeholder="917 842 5510"
                value={mobile}
                onChangeText={setMobile}
                onBlur={handleMobileBlur}
                error={errors.mobile}
                keyboardType="phone-pad"
                autoComplete="tel"
                leftIcon={
                  <View style={styles.mobilePrefix}>
                    <Text style={styles.mobilePrefixText}>+63</Text>
                  </View>
                }
              />
            ) : (
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
            )}
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

          {method === 'mobile' && <Text style={styles.mobileNotice}>{t.driver.login.mobileComingSoon}</Text>}

          {authError ? <Text style={styles.authError}>{authError}</Text> : null}

          {/* P0-3 (2026-09-15 launch audit): the reset flow itself
              (app/(auth)/forgot-password.tsx) is still non-functional — Supabase's
              free tier can't have the recovery email template edited without custom
              SMTP, which is unfinished. Re-added on request (2026-09-15) as a real
              link regardless; submitting it won't currently send anything until
              SMTP is configured. */}
          <Pressable style={styles.forgotLink} onPress={() => router.push('/(auth)/forgot-password')}>
            <Text style={styles.forgotLinkText}>{t.driver.login.forgotPassword}</Text>
          </Pressable>

          <Button
            label={t.driver.login.logIn}
            onPress={handleLogin}
            loading={submitting || awaitingGate}
            disabled={method === 'mobile'}
            fullWidth
          />

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

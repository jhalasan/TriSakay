import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { BrandMotif, Button, GradientSurface, TextField, colors } from '@trisakay/ui';
import { HAS_SIGNED_IN_KEY } from '../../src/constants/walkthrough';
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

  // null while unresolved (the one frame before AsyncStorage answers) — the
  // title/subtitle below render a reserved-space placeholder in that frame
  // rather than flashing "Welcome back" then swapping to the first-visit copy.
  const [hasSignedIn, setHasSignedIn] = useState<boolean | null>(null);

  // Scrolling should only kick in when the form genuinely doesn't fit — a
  // short device, or the keyboard eating vertical space — not by default.
  // Comparing the ScrollView's measured content height against its own
  // available viewport height (both reported by RN, not guessed) is more
  // robust than hand-tuning the layout to a single reference device: it
  // stays correct across screen sizes and re-evaluates itself when the
  // keyboard opens/closes.
  const [scrollEnabled, setScrollEnabled] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (viewportHeight > 0 && contentHeight > 0) {
      setScrollEnabled(contentHeight > viewportHeight);
    }
  }, [viewportHeight, contentHeight]);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(HAS_SIGNED_IN_KEY)
      .catch(() => null)
      .then((value) => {
        if (!cancelled) setHasSignedIn(value !== null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogin() {
    const nextErrors: typeof errors = {};
    if (!isValidEmail(email)) nextErrors.email = t.auth.login.enterValidEmail;
    if (!isValidPassword(password)) nextErrors.password = t.auth.login.passwordMinLength;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    clearError();
    setSubmitting(true);
    await login(email, password);
    setSubmitting(false);
  }

  const title = hasSignedIn === null ? ' ' : hasSignedIn ? t.auth.login.welcomeBack : t.auth.login.welcomeNew;
  const subtitle =
    hasSignedIn === null
      ? ' '
      : hasSignedIn
        ? t.auth.login.subtitleReturning
        : t.auth.login.subtitleFirstTime;

  return (
    <View style={styles.screen}>
      <GradientSurface token="hero" direction="diagonal" style={styles.heroBand}>
        <BrandMotif size={210} color="#FFFFFF" opacity={0.12} style={styles.motif} />
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
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={scrollEnabled}
          bounces={scrollEnabled}
          onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
          onContentSizeChange={(_w, height) => setContentHeight(height)}
        >
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {/* P1-20 (2026-09-15 launch audit): the "N tries left before a
              5-minute lock" copy that used to render here was removed — the
              comment above its state ("there is no backend lockout rule
              yet") confirms it, and it does not disable anything, so it
              only misled users into thinking there was a lockout timer. */}
          {authError && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} style={styles.errorBannerIcon} />
              <Text style={styles.errorBannerText}>{authError}</Text>
            </View>
          )}

          {/* P1-20 (2026-09-15 launch audit): the Mobile/Email sign-in
              segmented control was removed — mobile-number sign-in has no
              backend path (signIn only accepts email/password; there's no
              phone→email lookup), so it always fell back to a disabled
              button and a "coming soon" notice. Email-only sign-in until
              that backend support exists. */}
          <View style={styles.fields}>
            <TextField
              label={t.auth.login.email}
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              error={errors.email}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <TextField
              label={t.auth.login.password}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              secureTextEntry
              autoComplete="password"
            />
          </View>

          {/* P0-3 (2026-09-15 launch audit): the reset flow itself
              (app/(auth)/forgot-password.tsx) is still non-functional — Supabase's
              free tier can't have the recovery email template edited without custom
              SMTP, which is unfinished. Re-added on request (2026-09-15) as a real
              link regardless; submitting it won't currently send anything until
              SMTP is configured. */}
          <Pressable style={styles.forgotLink} onPress={() => router.push('/(auth)/forgot-password')}>
            <Text style={styles.forgotLinkText}>{t.auth.login.forgotPassword}</Text>
          </Pressable>

          <Button label={t.auth.login.logIn} onPress={handleLogin} loading={submitting || awaitingGate} fullWidth />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t.auth.login.or}</Text>
            <View style={styles.dividerLine} />
          </View>

          <Button
            label={t.auth.login.createAccount}
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

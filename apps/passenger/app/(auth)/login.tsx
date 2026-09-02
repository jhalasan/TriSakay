import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Image, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { BrandMotif, Button, GradientSurface, SegmentedControl, TextField } from '@trisakay/ui';
import { HAS_SIGNED_IN_KEY } from '../../src/constants/walkthrough';
import { useAuthStore } from '../../src/store/useAuthStore';
import { isValidEmail, isValidMobile, isValidPassword } from '../../src/utils/validation';
import { styles } from '../../src/styles/auth/login.styles';

type LoginMethod = 'mobile' | 'email';

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

  const [method, setMethod] = useState<LoginMethod>('email');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; mobile?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  // null while unresolved (the one frame before AsyncStorage answers) — the
  // title/subtitle below render a reserved-space placeholder in that frame
  // rather than flashing "Welcome back" then swapping to the first-visit copy.
  const [hasSignedIn, setHasSignedIn] = useState<boolean | null>(null);

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
    if (!isValidEmail(email)) nextErrors.email = 'Enter a valid email address.';
    if (!isValidPassword(password)) nextErrors.password = 'Password must be at least 6 characters.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    clearError();
    setSubmitting(true);
    await login(email, password);
    setSubmitting(false);
  }

  function handleMobileBlur() {
    if (mobile && !isValidMobile(mobile)) {
      setErrors((prev) => ({ ...prev, mobile: 'Enter a valid 10-digit mobile number.' }));
    }
  }

  const title = hasSignedIn === null ? ' ' : hasSignedIn ? 'Welcome back' : 'Welcome to TriSakay';
  const subtitle =
    hasSignedIn === null
      ? ' '
      : hasSignedIn
        ? 'Log in to book your next ride.'
        : 'Log in to book your first ride.';

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
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <View style={styles.methodTrack}>
            <SegmentedControl
              options={[
                { label: 'Mobile number', value: 'mobile' },
                { label: 'Email', value: 'email' },
              ]}
              value={method}
              onChange={setMethod}
            />
          </View>

          <View style={styles.fields}>
            {method === 'mobile' ? (
              <TextField
                label="Mobile number"
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
                label="Email"
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
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              secureTextEntry
              autoComplete="password"
            />
          </View>

          {method === 'mobile' && (
            // Mobile-number sign-in has no backend path yet — signIn only
            // accepts email/password (packages/services/src/auth/index.ts)
            // and there's no phone→email lookup available to this app. The
            // control above is built to spec; submission stays on Email
            // until that backend support exists.
            <Text style={styles.mobileNotice}>Signing in with a mobile number is coming soon — use Email for now.</Text>
          )}

          {authError ? <Text style={styles.authError}>{authError}</Text> : null}

          <View style={styles.forgotLink}>
            <Text style={styles.forgotLinkText} onPress={() => router.push('/(auth)/forgot-password')}>
              Forgot password?
            </Text>
          </View>

          <Button
            label="Log in"
            onPress={handleLogin}
            loading={submitting || awaitingGate}
            disabled={method === 'mobile'}
            fullWidth
          />

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
    </View>
  );
}

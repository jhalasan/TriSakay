import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { CURRENT_PRIVACY_VERSION, CURRENT_TOS_VERSION, getSession, updateAvatarUrl, uploadAvatar } from '@trisakay/services';
import { BrandMotif, Button, Card, Checkbox, GradientSurface, TextField, colors } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useConsentStore } from '../../src/store/useConsentStore';
import { DISCLOSURES, POLICY_BODY } from '../../src/content/legalCopy';
import { isNonEmpty, isValidEmail, isValidPassword } from '../../src/utils/validation';
import { styles } from '../../src/styles/auth/register.styles';

interface FormState {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

const STEP_TITLE: Record<1 | 2, string> = {
  1: 'Create account',
  2: 'Terms & Privacy',
};

export default function RegisterScreen() {
  const router = useRouter();
  const register = useAuthStore((state) => state.register);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const authError = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);
  const acceptConsent = useConsentStore((state) => state.accept);
  // See login.tsx: registration that returns an immediate session leaves this
  // screen mounted while the consent gate decides, so the button has to stay
  // busy until the gate routes away rather than inviting a second submit.
  const awaitingGate = useAuthStore((state) => state.sessionUserId !== null);

  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [termsChecked, setTermsChecked] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handlePickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to set a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  }

  function handleNext() {
    const nextErrors: Partial<FormState> = {};
    if (!isNonEmpty(form.name)) nextErrors.name = 'Enter your full name.';
    if (!isValidEmail(form.email)) nextErrors.email = 'Enter a valid email address.';
    if (!isNonEmpty(form.phone)) nextErrors.phone = 'Enter a contact number.';
    if (!isValidPassword(form.password)) nextErrors.password = 'Password must be at least 6 characters.';
    if (form.confirmPassword !== form.password) nextErrors.confirmPassword = 'Passwords do not match.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setStep(2);
  }

  async function handleCreateAccount() {
    clearError();
    setSubmitting(true);
    const outcome = await register(form.name, form.email, form.phone, form.password);

    // Upload only when signUp returned an active session — Storage RLS
    // requires auth.uid(), which isn't available yet on the check_email
    // path (email confirmation pending). Those riders can add a photo
    // later from Profile once they've logged in.
    let avatarError: string | null = null;
    if (outcome === 'signed_in' && avatarUri) {
      const session = await getSession();
      if (session) {
        try {
          // `fetch(uri).arrayBuffer()` on a local picker URI is unreliable on
          // RN (silently empty on some Android setups) — reading through
          // `File` is the platform-native path for local file bytes.
          const bytes = await new File(avatarUri).arrayBuffer();
          const { publicUrl, error } = await uploadAvatar({ userId: session.user.id, data: bytes });
          if (publicUrl) {
            const { error: profileError } = await updateAvatarUrl(publicUrl);
            avatarError = profileError;
            // Store's `user` was already populated by the sign-up auth event,
            // before this upload finished — refetch so avatarUrl isn't stale
            // until the next full profile fetch (e.g. next app launch).
            if (!profileError) await refreshProfile();
          } else {
            avatarError = error;
          }
        } catch (err) {
          avatarError = err instanceof Error ? err.message : 'Could not read the selected photo.';
        }
      }
    }

    // Record the acceptance the rider already gave on this same screen right
    // away, so it's part of one continuous action rather than a separate
    // screen popping up after the account already exists. Only possible on
    // the signed_in path — recordConsent needs a live session (RLS), which
    // check_email doesn't have yet. That path (and any failure here) falls
    // back to the post-login consent gate (app/consent.tsx), unchanged.
    if (outcome === 'signed_in') {
      await acceptConsent();
    }

    setSubmitting(false);

    if (avatarError) {
      Alert.alert('Account created', `Your account is ready, but the profile photo didn't upload: ${avatarError}. You can add it later from Profile.`);
    }

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
      <ScreenHeader title={STEP_TITLE[step]} onBack={step === 2 ? () => setStep(1) : undefined} />

      <View style={styles.stepWrap}>
        <Text style={styles.stepLabel}>Step {step} of 2</Text>
        <View style={styles.stepTrack}>
          <View style={[styles.stepSegment, styles.stepSegmentActive]} />
          <View style={[styles.stepSegment, step === 2 && styles.stepSegmentActive]} />
        </View>
      </View>

      {step === 1 ? (
        <>
          <GradientSurface token="hero" direction="diagonal" style={styles.heroBand}>
            <BrandMotif size={140} color="#FFFFFF" opacity={0.1} style={styles.motif} />
            <View style={styles.markBadge}>
              <Image
                source={require('../../../../assets/brand/trisakay-mark.png')}
                style={styles.mark}
                resizeMode="contain"
                accessibilityLabel="TriSakay"
              />
            </View>
          </GradientSurface>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={avatarUri ? 'Change profile photo' : 'Add a profile photo'}
                style={styles.avatarWrap}
                onPress={handlePickAvatar}
              >
                <View style={[styles.avatarUpload, avatarUri && styles.avatarUploadFilled]}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatarImage} resizeMode="cover" />
                  ) : (
                    <Ionicons name="camera-outline" size={26} color={colors.inkSoft} />
                  )}
                </View>
                <View style={styles.avatarEditBadge}>
                  <Ionicons name={avatarUri ? 'pencil' : 'add'} size={14} color={colors.white} />
                </View>
              </Pressable>
              <Text style={styles.avatarUploadLabel}>
                {avatarUri ? 'Tap to change photo' : 'Add a profile photo (optional)'}
              </Text>
            </View>

            <View style={styles.fields}>
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
            </View>

            <Button label="Next" onPress={handleNext} fullWidth />
          </ScrollView>
        </>
      ) : (
        <ScrollView contentContainerStyle={[styles.scrollContent, styles.legalScrollContent]} keyboardShouldPersistTaps="handled">
          <Text style={styles.stepIntro}>
            Please read and accept these before your account is created.
          </Text>
          <Text style={styles.version}>
            Terms {CURRENT_TOS_VERSION} · Privacy {CURRENT_PRIVACY_VERSION}
          </Text>

          {POLICY_BODY.map((paragraph) => (
            <Text key={paragraph.slice(0, 24)} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}

          <Text style={styles.sectionLabel}>What we collect &amp; share</Text>
          <Card style={styles.disclosureCard}>
            {DISCLOSURES.map((item, index) => (
              <View key={item.title} style={[styles.disclosureRow, index > 0 && styles.disclosureRowDivided]}>
                <Text style={styles.disclosureTitle}>{item.title}</Text>
                <Text style={styles.disclosureBody}>{item.body}</Text>
              </View>
            ))}
          </Card>

          <Checkbox
            checked={termsChecked}
            onChange={setTermsChecked}
            label="I have read and accept the Terms of Service and Privacy Policy"
          />

          {authError ? <Text style={styles.authError}>{authError}</Text> : null}

          <Button
            label="Create account"
            onPress={handleCreateAccount}
            loading={submitting || awaitingGate}
            disabled={!termsChecked}
            fullWidth
          />
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

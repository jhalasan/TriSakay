import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { CURRENT_PRIVACY_VERSION, CURRENT_TOS_VERSION, getSession, updateAvatarUrl, uploadAvatar } from '@trisakay/services';
import { BrandMotif, Button, Card, Checkbox, GradientSurface, SegmentedControl, TextField, colors } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useConsentStore } from '../../src/store/useConsentStore';
import { DISCLOSURES, PRIVACY_POLICY, TERMS_OF_SERVICE } from '../../src/content/legalCopy';
import { isPasswordPolicyMet } from '@trisakay/utils';
import { interpolate } from '../../src/utils/interpolate';
import { isNonEmpty, isValidEmail } from '../../src/utils/validation';
import { styles } from '../../src/styles/auth/register.styles';

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

export default function RegisterScreen() {
  const router = useRouter();
  const t = useTranslation();
  const STEP_TITLE: Record<1 | 2, string> = {
    1: t.auth.register.stepTitleAccount,
    2: t.auth.register.stepTitleLegal,
  };
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
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [termsChecked, setTermsChecked] = useState(false);
  const [legalTab, setLegalTab] = useState<'terms' | 'privacy'>('terms');

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handlePickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t.auth.register.permissionNeededTitle, t.auth.register.permissionNeededMessage);
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
    if (!isNonEmpty(form.firstName)) nextErrors.firstName = t.auth.register.enterFirstName;
    if (!isNonEmpty(form.lastName)) nextErrors.lastName = t.auth.register.enterLastName;
    if (!isValidEmail(form.email)) nextErrors.email = t.auth.register.enterValidEmail;
    if (!isNonEmpty(form.phone)) nextErrors.phone = t.auth.register.enterContactNumber;
    if (!isPasswordPolicyMet(form.password)) nextErrors.password = t.auth.register.passwordMinLength;
    if (form.confirmPassword !== form.password) nextErrors.confirmPassword = t.auth.register.passwordsDoNotMatch;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setStep(2);
  }

  async function handleCreateAccount() {
    clearError();
    setSubmitting(true);
    const outcome = await register(form.firstName, form.lastName, form.email, form.phone, form.password);

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
          avatarError = err instanceof Error ? err.message : t.auth.register.couldNotReadPhoto;
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
      Alert.alert(
        t.auth.register.accountCreatedTitle,
        interpolate(t.auth.register.accountCreatedPhotoFailedMessage, { error: avatarError })
      );
    }

    if (outcome === 'check_email') {
      Alert.alert(
        t.auth.register.checkEmailTitle,
        interpolate(t.auth.register.checkEmailMessage, { email: form.email }),
        [{ text: t.common.ok, onPress: () => router.replace('/(auth)/login') }]
      );
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title={STEP_TITLE[step]} onBack={step === 2 ? () => setStep(1) : undefined} />

      <View style={styles.stepWrap}>
        <Text style={styles.stepLabel}>{interpolate(t.auth.register.stepLabel, { step })}</Text>
        <View style={styles.stepTrack}>
          <View style={[styles.stepSegment, styles.stepSegmentActive]} />
          <View style={[styles.stepSegment, step === 2 && styles.stepSegmentActive]} />
        </View>
      </View>

      {step === 1 ? (
        <>
          <GradientSurface token="hero" direction="diagonal" style={styles.heroBand}>
            <BrandMotif size={150} color="#FFFFFF" opacity={0.12} style={styles.motif} />
          </GradientSurface>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  avatarUri ? t.auth.register.changePhotoAccessibilityLabel : t.auth.register.addPhotoAccessibilityLabel
                }
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
                {avatarUri ? t.auth.register.tapToChangePhoto : t.auth.register.addPhotoOptional}
              </Text>
            </View>

            <View style={styles.fields}>
              <TextField
                label={t.auth.register.firstName}
                placeholder="Juan"
                value={form.firstName}
                onChangeText={(v) => update('firstName', v)}
                error={errors.firstName}
                autoCapitalize="words"
              />
              <TextField
                label={t.auth.register.lastName}
                placeholder="Dela Cruz"
                value={form.lastName}
                onChangeText={(v) => update('lastName', v)}
                error={errors.lastName}
                autoCapitalize="words"
              />
              <TextField
                label={t.auth.register.email}
                placeholder="you@example.com"
                value={form.email}
                onChangeText={(v) => update('email', v)}
                error={errors.email}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextField
                label={t.auth.register.phone}
                placeholder="09XX XXX XXXX"
                value={form.phone}
                onChangeText={(v) => update('phone', v)}
                error={errors.phone}
                keyboardType="phone-pad"
              />
              <TextField
                label={t.auth.register.password}
                placeholder="••••••••"
                value={form.password}
                onChangeText={(v) => update('password', v)}
                error={errors.password}
                secureTextEntry
              />
              <TextField
                label={t.auth.register.confirmPassword}
                placeholder="••••••••"
                value={form.confirmPassword}
                onChangeText={(v) => update('confirmPassword', v)}
                error={errors.confirmPassword}
                secureTextEntry
              />
            </View>

            <Button label={t.auth.register.next} onPress={handleNext} fullWidth />
          </ScrollView>
        </>
      ) : (
        <ScrollView contentContainerStyle={[styles.scrollContent, styles.legalScrollContent]} keyboardShouldPersistTaps="handled">
          <Text style={styles.stepIntro}>{t.auth.register.acceptTermsIntro}</Text>
          <Text style={styles.version}>
            {interpolate(t.auth.register.versionLabel, { tos: CURRENT_TOS_VERSION, privacy: CURRENT_PRIVACY_VERSION })}
          </Text>

          <SegmentedControl
            options={[
              { label: 'Terms of Service', value: 'terms' },
              { label: 'Privacy Policy', value: 'privacy' },
            ]}
            value={legalTab}
            onChange={setLegalTab}
          />

          {legalTab === 'terms'
            ? TERMS_OF_SERVICE.map((section) => (
                <View key={section.heading} style={styles.policySection}>
                  <Text style={styles.disclosureTitle}>{section.heading}</Text>
                  <Text style={styles.paragraph}>{section.body}</Text>
                </View>
              ))
            : (
                <>
                  <Text style={styles.sectionLabel}>{t.auth.register.whatWeCollect}</Text>
                  <Card style={styles.disclosureCard}>
                    {DISCLOSURES.map((item, index) => (
                      <View key={item.title} style={[styles.disclosureRow, index > 0 && styles.disclosureRowDivided]}>
                        <Text style={styles.disclosureTitle}>{item.title}</Text>
                        <Text style={styles.disclosureBody}>{item.body}</Text>
                      </View>
                    ))}
                  </Card>

                  {PRIVACY_POLICY.map((section) => (
                    <View key={section.heading} style={styles.policySection}>
                      <Text style={styles.disclosureTitle}>{section.heading}</Text>
                      <Text style={styles.paragraph}>{section.body}</Text>
                    </View>
                  ))}
                </>
              )}

          <Checkbox checked={termsChecked} onChange={setTermsChecked} label={t.auth.register.acceptTerms} />

          {authError ? <Text style={styles.authError}>{authError}</Text> : null}

          <Button
            label={t.auth.register.createAccountButton}
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

import { useState } from 'react';
import { useRouter } from 'expo-router';
import { File } from 'expo-file-system';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { submitDriverDocuments, type DriverDocumentInput } from '@trisakay/services';
import { BrandMotif, Button, GradientSurface, TextField } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { DocumentUploadRow } from '../../src/components/DocumentUploadRow';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useDocumentsStore } from '../../src/store/useDocumentsStore';
import { DOCUMENT_LABEL, DOCUMENT_TYPES } from '../../src/types/document';
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
  1: 'Register as driver',
  2: 'Documents & tricycle',
};

export default function RegisterScreen() {
  const router = useRouter();
  const register = useAuthStore((state) => state.register);
  const authError = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);
  const awaitingGate = useAuthStore((state) => state.sessionUserId !== null);
  const documents = useDocumentsStore((state) => state.documents);
  const submitDocument = useDocumentsStore((state) => state.submit);
  const removeDocument = useDocumentsStore((state) => state.remove);

  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<FormState>({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [submitting, setSubmitting] = useState(false);

  const allDocumentsUploaded = DOCUMENT_TYPES.every((type) => documents[type].status !== 'unsubmitted');

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
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

  async function uploadPickedDocuments(userId: string) {
    const inputs: DriverDocumentInput[] = [];
    for (const type of DOCUMENT_TYPES) {
      const uri = documents[type].uri;
      if (!uri) continue;
      // Same reasoning as uploadAvatar's callers: fetch(uri).arrayBuffer() on
      // a local picker URI is unreliable on RN, File is the reliable path.
      const data = await new File(uri).arrayBuffer();
      inputs.push({ type, data });
    }
    return submitDriverDocuments(userId, inputs);
  }

  async function handleSubmit() {
    clearError();
    setSubmitting(true);
    const { outcome, userId } = await register(form.name, form.email, form.phone, form.password);

    if (outcome === 'error') {
      setSubmitting(false);
      return;
    }

    const reviewNote =
      "Your documents are under review. We'll send you a text message or email once your account is approved to go online.";

    if (outcome === 'check_email') {
      // No live session yet — RLS requires an authenticated driver to
      // upload, so documents can't be submitted until the driver confirms
      // their email and logs in. Copy reflects that honestly rather than
      // implying the upload above already happened.
      setSubmitting(false);
      Alert.alert(
        'Check your email',
        `We sent a confirmation link to ${form.email}. Confirm it, then log in and upload your documents from there.`,
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
      return;
    }

    const { error: uploadError } = await uploadPickedDocuments(userId!);
    setSubmitting(false);

    if (uploadError) {
      Alert.alert(
        'Registered, but documents failed to upload',
        `${uploadError}\n\nPlease try registering again so your documents are on file for review.`
      );
      return;
    }

    Alert.alert('Documents submitted', reviewNote);
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
            <BrandMotif size={120} color="#FFFFFF" opacity={0.1} style={styles.motif} />
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

            <Button label="Next" onPress={handleNext} fullWidth />
          </ScrollView>
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.stepIntro}>
            Upload these so a PSO reviewer can verify your franchise before you go online.
          </Text>

          {DOCUMENT_TYPES.map((type) => (
            <DocumentUploadRow
              key={type}
              label={DOCUMENT_LABEL[type]}
              status={documents[type].status}
              uri={documents[type].uri}
              onUpload={(uri) => submitDocument(type, uri)}
              onRemove={() => removeDocument(type)}
            />
          ))}

          {authError ? <Text style={styles.authError}>{authError}</Text> : null}

          <Button
            label="Register"
            onPress={handleSubmit}
            loading={submitting || awaitingGate}
            disabled={!allDocumentsUploaded}
            fullWidth
          />

          <Text style={styles.legalText}>
            By registering, you agree to TriSakay's Terms of Service and Privacy Policy, and confirm you are a
            licensed tricycle driver.
          </Text>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

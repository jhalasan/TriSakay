import { useState } from 'react';
import { useRouter } from 'expo-router';
import { File } from 'expo-file-system';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { CURRENT_PRIVACY_VERSION, CURRENT_TOS_VERSION, submitDriverDocuments, type DriverDocumentInput } from '@trisakay/services';
import { BrandMotif, Button, Card, Checkbox, GradientSurface, TextField } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { DocumentUploadRow } from '../../src/components/DocumentUploadRow';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useConsentStore } from '../../src/store/useConsentStore';
import { useDocumentsStore } from '../../src/store/useDocumentsStore';
import { DISCLOSURES, POLICY_BODY } from '../../src/content/legalCopy';
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
  const acceptConsent = useConsentStore((state) => state.accept);
  const documents = useDocumentsStore((state) => state.documents);
  const submitDocument = useDocumentsStore((state) => state.submit);
  const removeDocument = useDocumentsStore((state) => state.remove);

  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<FormState>({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [plateNo, setPlateNo] = useState('');
  const [plateNoError, setPlateNoError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);

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
    return submitDriverDocuments(userId, plateNo.trim().toUpperCase(), inputs);
  }

  async function handleSubmit() {
    if (!isNonEmpty(plateNo)) {
      setPlateNoError('Enter your tricycle plate number.');
      return;
    }
    setPlateNoError(undefined);

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

    // Record the acceptance the driver already gave on this same step right
    // away, so it's part of one continuous action rather than a separate
    // screen popping up after the account already exists. Only possible on
    // the signed_in path — recordConsent needs a live session (RLS), which
    // check_email doesn't have yet (handled, and returned, above). Any
    // failure here falls back to the post-login consent gate (app/consent.tsx),
    // unchanged.
    await acceptConsent();

    let uploadError: string | null;
    try {
      ({ error: uploadError } = await uploadPickedDocuments(userId!));
    } catch {
      // A stale/expired picker URI throws on read rather than returning a
      // Supabase error — without this catch, setSubmitting(false) below
      // never runs and the button spins forever even though the account
      // was already created.
      uploadError = 'Could not read one of your selected files.';
    }
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

          <TextField
            label="Tricycle plate number"
            placeholder="e.g. GSC-1187"
            value={plateNo}
            onChangeText={(v) => {
              setPlateNo(v);
              if (plateNoError) setPlateNoError(undefined);
            }}
            error={plateNoError}
            autoCapitalize="characters"
          />

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

          <Text style={styles.stepIntro}>Please read and accept these before your account is created.</Text>
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
            label="I have read and accept the Terms of Service and Privacy Policy, and confirm I am a licensed tricycle driver"
          />

          {authError ? <Text style={styles.authError}>{authError}</Text> : null}

          <Button
            label="Register"
            onPress={handleSubmit}
            loading={submitting || awaitingGate}
            disabled={!isNonEmpty(plateNo) || !allDocumentsUploaded || !termsChecked}
            fullWidth
          />
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

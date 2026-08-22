import { useState } from 'react';
import { useRouter } from 'expo-router';
import { File } from 'expo-file-system';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { CURRENT_PRIVACY_VERSION, CURRENT_TOS_VERSION, submitDriverDocuments, type DriverDocumentInput } from '@trisakay/services';
import { BrandMotif, Button, Card, Checkbox, GradientSurface, TextField } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { DocumentUploadRow } from '../../src/components/DocumentUploadRow';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useConsentStore } from '../../src/store/useConsentStore';
import { useDocumentsStore } from '../../src/store/useDocumentsStore';
import { DISCLOSURES, POLICY_BODY } from '../../src/content/legalCopy';
import { DOCUMENT_TYPES } from '../../src/types/document';
import { interpolate } from '../../src/utils/interpolate';
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
  const t = useTranslation();
  const STEP_TITLE: Record<1 | 2, string> = {
    1: t.driver.register.stepTitleAccount,
    2: t.driver.register.stepTitleDocuments,
  };
  const DOCUMENT_LABEL: Record<(typeof DOCUMENT_TYPES)[number], string> = {
    drivers_license: t.driver.documents.driversLicense,
    or_cr: t.driver.documents.orCr,
    franchise_permit: t.driver.documents.franchisePermit,
    tricycle_photo: t.driver.documents.tricyclePhoto,
  };
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
    if (!isNonEmpty(form.name)) nextErrors.name = t.driver.register.enterFullName;
    if (!isValidEmail(form.email)) nextErrors.email = t.driver.register.enterValidEmail;
    if (!isNonEmpty(form.phone)) nextErrors.phone = t.driver.register.enterContactNumber;
    if (!isValidPassword(form.password)) nextErrors.password = t.driver.register.passwordMinLength;
    if (form.confirmPassword !== form.password) nextErrors.confirmPassword = t.driver.register.passwordsDoNotMatch;
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
      setPlateNoError(t.driver.register.enterPlateNumber);
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

    const reviewNote = t.driver.register.documentsSubmittedMessage;

    if (outcome === 'check_email') {
      // No live session yet — RLS requires an authenticated driver to
      // upload, so documents can't be submitted until the driver confirms
      // their email and logs in. Copy reflects that honestly rather than
      // implying the upload above already happened.
      setSubmitting(false);
      Alert.alert(
        t.driver.register.checkEmailTitle,
        interpolate(t.driver.register.checkEmailMessage, { email: form.email }),
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
      uploadError = t.driver.register.couldNotReadFile;
    }
    setSubmitting(false);

    if (uploadError) {
      Alert.alert(
        t.driver.register.registeredButFailedTitle,
        interpolate(t.driver.register.registeredButFailedMessage, { error: uploadError })
      );
      return;
    }

    Alert.alert(t.driver.register.documentsSubmittedTitle, reviewNote);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title={STEP_TITLE[step]} onBack={step === 2 ? () => setStep(1) : undefined} />

      <View style={styles.stepWrap}>
        <Text style={styles.stepLabel}>{interpolate(t.driver.register.stepLabel, { step })}</Text>
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
              label={t.driver.register.fullName}
              placeholder={t.driver.register.fullNamePlaceholder}
              value={form.name}
              onChangeText={(v) => update('name', v)}
              error={errors.name}
              autoCapitalize="words"
            />
            <TextField
              label={t.driver.register.email}
              placeholder={t.driver.register.emailPlaceholder}
              value={form.email}
              onChangeText={(v) => update('email', v)}
              error={errors.email}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextField
              label={t.driver.register.phone}
              placeholder={t.driver.register.phonePlaceholder}
              value={form.phone}
              onChangeText={(v) => update('phone', v)}
              error={errors.phone}
              keyboardType="phone-pad"
            />
            <TextField
              label={t.driver.register.password}
              placeholder="••••••••"
              value={form.password}
              onChangeText={(v) => update('password', v)}
              error={errors.password}
              secureTextEntry
            />
            <TextField
              label={t.driver.register.confirmPassword}
              placeholder="••••••••"
              value={form.confirmPassword}
              onChangeText={(v) => update('confirmPassword', v)}
              error={errors.confirmPassword}
              secureTextEntry
            />

            <Button label={t.driver.register.next} onPress={handleNext} fullWidth />
          </ScrollView>
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.stepIntro}>{t.driver.register.documentsIntro}</Text>

          <TextField
            label={t.driver.register.plateNumber}
            placeholder={t.driver.register.plateNumberPlaceholder}
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

          <Text style={styles.stepIntro}>{t.driver.register.acceptTermsIntro}</Text>
          <Text style={styles.version}>
            Terms {CURRENT_TOS_VERSION} · Privacy {CURRENT_PRIVACY_VERSION}
          </Text>

          {POLICY_BODY.map((paragraph) => (
            <Text key={paragraph.slice(0, 24)} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}

          <Text style={styles.sectionLabel}>{t.driver.register.whatWeCollect}</Text>
          <Card style={styles.disclosureCard}>
            {DISCLOSURES.map((item, index) => (
              <View key={item.title} style={[styles.disclosureRow, index > 0 && styles.disclosureRowDivided]}>
                <Text style={styles.disclosureTitle}>{item.title}</Text>
                <Text style={styles.disclosureBody}>{item.body}</Text>
              </View>
            ))}
          </Card>

          <Checkbox checked={termsChecked} onChange={setTermsChecked} label={t.driver.register.acceptTerms} />

          {authError ? <Text style={styles.authError}>{authError}</Text> : null}

          <Button
            label={t.driver.register.registerButton}
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

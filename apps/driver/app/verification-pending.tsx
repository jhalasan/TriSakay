import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { File } from 'expo-file-system';
import { ActivityIndicator, Alert, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  listOwnDriverDocuments,
  resubmitDriverDocuments,
  submitDriverDocuments,
  type DriverDocumentInput,
  type OwnDriverDocumentRow,
} from '@trisakay/services';
import { Badge, BrandMotif, Button, colors, TextField } from '@trisakay/ui';
import { DocumentUploadRow } from '../src/components/DocumentUploadRow';
import { useTranslation } from '../src/hooks/useTranslation';
import { useAuthStore } from '../src/store/useAuthStore';
import { useDocumentsStore } from '../src/store/useDocumentsStore';
import { useVerificationStore } from '../src/store/useVerificationStore';
import { DOCUMENT_TYPES } from '../src/types/document';
import { isNonEmpty } from '../src/utils/validation';
import { styles } from '../src/styles/verification-pending.styles';

/**
 * expo-file-system's `File` class is a no-op stub on web (every method warns
 * and does nothing) even though it's the reliable read path on native.
 * `fetch(uri).arrayBuffer()` is the flaky one on native, but on web the
 * picker's URI is a blob: URL that fetch reads fine, so branch per platform.
 */
async function readFileBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') return (await fetch(uri)).arrayBuffer();
  return new File(uri).arrayBuffer();
}

/**
 * A driver whose registration returned `check_email` has no session yet, so
 * `register.tsx` never got to call `submitDriverDocuments` — their
 * `driver_profiles.verification_status` is still 'unsubmitted', not
 * 'pending'. This screen is where they land (useProtectedRoute routes any
 * non-'approved' status here) once they've confirmed their email and logged
 * in for the first time, so it's the only place left that can finish the
 * job — reusing the same plate + 4-document form register.tsx's step 2 uses.
 *
 * UAT D5 (2026-09-21): also reused for a 'rejected' driver's resubmission.
 * `submit_driver_documents`'s live RPC body was reviewed and confirmed safe
 * to call a second time — its `on conflict ... do update` on both
 * `tricycles` and `driver_documents` resets status back to 'pending' and
 * clears the old remarks/reviewer fields on the existing rows rather than
 * creating duplicates, so a second full 4-document submission is exactly
 * what a resubmission needs.
 */
function UnsubmittedUpload({ rejectionReason }: { rejectionReason?: string | null }) {
  const t = useTranslation();
  const sessionUserId = useAuthStore((state) => state.sessionUserId);
  const check = useVerificationStore((state) => state.check);
  const documents = useDocumentsStore((state) => state.documents);
  const submitDocument = useDocumentsStore((state) => state.submit);
  const removeDocument = useDocumentsStore((state) => state.remove);

  const DOCUMENT_LABEL: Record<(typeof DOCUMENT_TYPES)[number], string> = {
    drivers_license: t.driver.documents.driversLicense,
    or_cr: t.driver.documents.orCr,
    franchise_permit: t.driver.documents.franchisePermit,
    tricycle_photo: t.driver.documents.tricyclePhoto,
  };

  const [plateNo, setPlateNo] = useState('');
  const [plateNoError, setPlateNoError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const allDocumentsUploaded = DOCUMENT_TYPES.every((type) => documents[type].status !== 'unsubmitted');

  async function handleSubmit() {
    if (!isNonEmpty(plateNo)) {
      setPlateNoError(t.driver.verificationPending.enterPlateNumber);
      return;
    }
    if (!sessionUserId) return;
    setPlateNoError(undefined);
    setSubmitError(null);
    setSubmitting(true);

    try {
      const inputs: DriverDocumentInput[] = [];
      for (const type of DOCUMENT_TYPES) {
        const uri = documents[type].uri;
        if (!uri) continue;
        inputs.push({ type, data: await readFileBytes(uri) });
      }

      const { error } = await submitDriverDocuments(sessionUserId, plateNo.trim().toUpperCase(), inputs);
      if (error) {
        setSubmitError(error);
        return;
      }

      Alert.alert(t.driver.verificationPending.documentsSubmittedTitle, t.driver.verificationPending.documentsSubmittedBody);
      await check();
    } catch {
      setSubmitError(t.driver.verificationPending.couldNotReadFile);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.uploadScroll} contentContainerStyle={styles.uploadScrollContent}>
      <View style={[styles.iconBadge, styles.centerSelf]}>
        <Ionicons name="document-attach-outline" size={30} color={colors.accentBluePressed} />
      </View>
      <Text style={styles.title}>{t.driver.verificationPending.unsubmittedTitle}</Text>
      <Text style={styles.body}>{t.driver.verificationPending.unsubmittedBody}</Text>

      {rejectionReason && (
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>{t.driver.verificationPending.rejectionReasonLabel}</Text>
          <Text style={styles.reasonText}>{rejectionReason}</Text>
        </View>
      )}

      <TextField
        label={t.driver.verificationPending.plateNumber}
        helperText={t.hints.plateNumber}
        placeholder={t.driver.verificationPending.plateNumberPlaceholder}
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
          hint={type === 'drivers_license' ? t.driver.documents.driversLicenseHint : undefined}
          status={documents[type].status}
          uri={documents[type].uri}
          onUpload={(uri) => submitDocument(type, uri)}
          onRemove={() => removeDocument(type)}
        />
      ))}

      {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

      <Button
        label={t.driver.verificationPending.submitDocuments}
        onPress={handleSubmit}
        loading={submitting}
        disabled={!isNonEmpty(plateNo) || !allDocumentsUploaded}
        fullWidth
      />
    </ScrollView>
  );
}

/**
 * A rejected application where the reviewer marked specific documents: the
 * driver sees which ones, why, and replaces only those. Everything else stays
 * as it was. If the list cannot be read, or no document is marked rejected
 * (an older rejection), it falls back to the full upload form above.
 */
function CorrectRejectedDocuments({ rejectionReason }: { rejectionReason?: string | null }) {
  const t = useTranslation();
  const v = t.driver.verificationPending;
  const sessionUserId = useAuthStore((state) => state.sessionUserId);
  const check = useVerificationStore((state) => state.check);
  const documents = useDocumentsStore((state) => state.documents);
  const submitDocument = useDocumentsStore((state) => state.submit);
  const removeDocument = useDocumentsStore((state) => state.remove);

  const [rows, setRows] = useState<OwnDriverDocumentRow[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const DOCUMENT_LABEL: Record<(typeof DOCUMENT_TYPES)[number], string> = {
    drivers_license: t.driver.documents.driversLicense,
    or_cr: t.driver.documents.orCr,
    franchise_permit: t.driver.documents.franchisePermit,
    tricycle_photo: t.driver.documents.tricyclePhoto,
  };

  useEffect(() => {
    let cancelled = false;
    void listOwnDriverDocuments().then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setLoadFailed(true);
        return;
      }
      // A file staged at registration for a rejected document must never be sent again by accident.
      for (const row of data) if (row.status === 'rejected') removeDocument(row.docType);
      setRows(data);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loadFailed) return <UnsubmittedUpload rejectionReason={rejectionReason} />;
  if (rows === null) {
    return (
      <View style={[styles.uploadScrollContent, styles.centerSelf]}>
        <ActivityIndicator color={colors.accentBluePressed} />
      </View>
    );
  }

  const rejected = DOCUMENT_TYPES.map((type) => rows.find((row) => row.docType === type)).filter(
    (row): row is OwnDriverDocumentRow => row !== undefined && row.status === 'rejected'
  );
  if (rejected.length === 0) return <UnsubmittedUpload rejectionReason={rejectionReason} />;

  const allChosen = rejected.every((row) => documents[row.docType].uri !== null);

  async function handleSend() {
    if (!sessionUserId || !allChosen) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const inputs: DriverDocumentInput[] = [];
      for (const row of rejected) {
        const uri = documents[row.docType].uri;
        if (uri) inputs.push({ type: row.docType, data: await readFileBytes(uri) });
      }
      const { error, remaining } = await resubmitDriverDocuments(sessionUserId, inputs);
      if (error) {
        setSubmitError(error);
        return;
      }
      for (const row of rejected) removeDocument(row.docType);
      Alert.alert(v.correctedSentTitle, v.correctedSentBody);
      await check();
      if (remaining) setSubmitError(v.stillRejected.replace('{count}', String(remaining)));
    } catch {
      setSubmitError(v.couldNotReadFile);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.uploadScroll} contentContainerStyle={styles.uploadScrollContent}>
      <View style={[styles.iconBadge, styles.centerSelf]}>
        <Ionicons name="alert-circle-outline" size={30} color={colors.accentBluePressed} />
      </View>
      <Text style={styles.title}>{v.fixTitle}</Text>
      <Text style={styles.body}>{v.fixBody}</Text>

      {DOCUMENT_TYPES.map((type) => {
        const row = rows.find((r) => r.docType === type);
        if (!row) return null;
        if (row.status !== 'rejected') {
          const approved = row.status === 'approved';
          return (
            <View key={type} style={styles.fixDoneRow}>
              <Text style={styles.fixDoneLabel}>{DOCUMENT_LABEL[type]}</Text>
              <Badge label={approved ? t.driver.documents.statusVerified : t.driver.documents.statusPending} tone={approved ? 'green' : 'neutral'} />
            </View>
          );
        }
        return (
          <View key={type} style={styles.fixCard}>
            {row.remarks ? (
              <Text style={styles.fixReason}>
                {v.reasonLabel}: {row.remarks}
              </Text>
            ) : null}
            <DocumentUploadRow
              label={DOCUMENT_LABEL[type]}
              status={documents[type].uri ? 'selected' : 'rejected'}
              uri={documents[type].uri}
              onUpload={(uri) => submitDocument(type, uri)}
              onRemove={() => removeDocument(type)}
            />
          </View>
        );
      })}

      {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
      {!allChosen ? <Text style={styles.body}>{v.chooseAllRejected}</Text> : null}

      <Button label={v.sendCorrected} onPress={handleSend} loading={submitting} disabled={!allChosen} fullWidth />
    </ScrollView>
  );
}

export default function VerificationPendingScreen() {
  const router = useRouter();
  const t = useTranslation();
  const status = useVerificationStore((state) => state.status);
  const rejectionReason = useVerificationStore((state) => state.rejectionReason);
  const error = useVerificationStore((state) => state.error);
  const check = useVerificationStore((state) => state.check);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await check();
    setRefreshing(false);
  }

  if (status === 'unsubmitted' || status === 'rejected') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {status === 'rejected' ? <CorrectRejectedDocuments rejectionReason={rejectionReason} /> : <UnsubmittedUpload />}
        <View style={styles.logoutFooter}>
          <Button label={t.driver.verificationPending.logOut} variant="ghost" tone="neutral" onPress={() => router.push('/logout')} fullWidth />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <BrandMotif size={240} color={colors.accentBlue} opacity={0.05} style={styles.motif} />
        <View style={styles.iconBadge}>
          <Ionicons name="time-outline" size={30} color={colors.accentBluePressed} />
        </View>
        <Text style={styles.title}>{t.driver.verificationPending.pendingTitle}</Text>
        <Text style={styles.body}>{t.driver.verificationPending.pendingBody}</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          <Button
            label={t.driver.verificationPending.refreshStatus}
            variant="outline"
            tone="neutral"
            icon={<Ionicons name="refresh" size={18} color={colors.ink} />}
            loading={refreshing || status === 'checking'}
            onPress={handleRefresh}
            fullWidth
          />
          <Button label={t.driver.verificationPending.logOut} variant="ghost" tone="neutral" onPress={() => router.push('/logout')} fullWidth />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

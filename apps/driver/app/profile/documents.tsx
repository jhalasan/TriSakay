import { useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Badge, Button, Card, TextField, type BadgeTone } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useDriverDocumentsStore } from '../../src/store/useDriverDocumentsStore';
import { DOCUMENT_TYPES, type DocumentType } from '../../src/types/document';
import type { OwnDriverDocumentRow } from '@trisakay/services';
import { styles } from '../../src/styles/profile/documents.styles';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EXPIRING_SOON_DAYS = 30;

type ExpiryStatus = 'notSet' | 'expired' | 'expiringSoon' | 'valid';

function expiryStatus(expiryDate: string | null): ExpiryStatus {
  if (!expiryDate) return 'notSet';
  const days = (new Date(expiryDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
  if (days < 0) return 'expired';
  if (days <= EXPIRING_SOON_DAYS) return 'expiringSoon';
  return 'valid';
}

const STATUS_TONE: Record<Exclude<ExpiryStatus, 'notSet'>, BadgeTone> = {
  expired: 'danger',
  expiringSoon: 'blue',
  valid: 'green',
};

/**
 * UAT D13 — self-reported document expiry dates, written directly to
 * driver_documents (documents_owner_rw RLS already permits a driver to
 * update their own rows) rather than through submit_driver_documents, an
 * untracked RPC not safe to extend blind. No proactive push-notification
 * scheduler — that's a separate, bigger piece deliberately left out; this
 * screen is the passive "can I tell it's expiring" half of the ask.
 */
export default function MyDocumentsScreen() {
  const t = useTranslation();
  const { documents, loading, error, saving, load, setExpiry } = useDriverDocumentsStore();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});

  useFocusEffect(
    useCallback(() => {
      void load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const doc of documents) next[doc.id] = doc.expiryDate ?? '';
    setDrafts(next);
  }, [documents]);

  const DOCUMENT_LABEL: Record<DocumentType, string> = {
    drivers_license: t.driver.documents.driversLicense,
    or_cr: t.driver.documents.orCr,
    franchise_permit: t.driver.documents.franchisePermit,
    tricycle_photo: t.driver.documents.tricyclePhoto,
  };

  const STATUS_LABEL: Record<ExpiryStatus, string> = {
    notSet: t.driver.documents.expiryNotSet,
    expired: t.driver.documents.expiryStatusExpired,
    expiringSoon: t.driver.documents.expiryStatusExpiringSoon,
    valid: t.driver.documents.expiryStatusValid,
  };

  async function handleSave(doc: OwnDriverDocumentRow) {
    const draft = (drafts[doc.id] ?? '').trim();
    if (draft && !DATE_RE.test(draft)) {
      setDraftErrors((prev) => ({ ...prev, [doc.id]: t.driver.documents.expiryInvalid }));
      return;
    }
    setDraftErrors((prev) => ({ ...prev, [doc.id]: '' }));
    await setExpiry(doc.id, draft || null);
  }

  // Every document type the driver could have uploaded, even one not
  // submitted yet — DOCUMENT_TYPES is the source of truth, documents is
  // only what's actually been created.
  const rows = DOCUMENT_TYPES.map((type) => documents.find((d) => d.docType === type));

  return (
    <View style={styles.container}>
      <ScreenHeader title={t.driver.documents.myDocumentsTitle} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.subtitle}>{t.driver.documents.myDocumentsSubtitle}</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        {!loading &&
          rows.map((doc, index) => {
            const type = DOCUMENT_TYPES[index];
            if (!doc) return null;
            const status = expiryStatus(doc.expiryDate);
            return (
              <Card key={doc.id} variant="raised" style={styles.card}>
                <View style={styles.headerRow}>
                  <Text style={styles.label}>{DOCUMENT_LABEL[type]}</Text>
                  {status === 'notSet' ? (
                    <Badge label={STATUS_LABEL.notSet} tone="neutral" />
                  ) : (
                    <Badge label={STATUS_LABEL[status]} tone={STATUS_TONE[status]} />
                  )}
                </View>
                <View style={styles.row}>
                  <View style={styles.fieldWrap}>
                    <TextField
                      label={t.driver.documents.expiryLabel}
                      placeholder={t.driver.documents.expiryPlaceholder}
                      value={drafts[doc.id] ?? ''}
                      onChangeText={(v) => setDrafts((prev) => ({ ...prev, [doc.id]: v }))}
                      error={draftErrors[doc.id] || undefined}
                    />
                  </View>
                  <Button
                    label={t.driver.documents.expirySave}
                    size="sm"
                    loading={saving === doc.id}
                    onPress={() => handleSave(doc)}
                  />
                </View>
              </Card>
            );
          })}
      </ScrollView>
    </View>
  );
}

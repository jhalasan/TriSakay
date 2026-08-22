import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Checkbox } from '@trisakay/ui';
import { CURRENT_PRIVACY_VERSION, CURRENT_TOS_VERSION } from '@trisakay/services';
import { useTranslation } from '../src/hooks/useTranslation';
import { useConsentStore } from '../src/store/useConsentStore';
import { DISCLOSURES, POLICY_BODY } from '../src/content/legalCopy';
import { styles } from '../src/styles/consent.styles';

export default function ConsentScreen() {
  const router = useRouter();
  const t = useTranslation();
  const error = useConsentStore((state) => state.error);
  const accept = useConsentStore((state) => state.accept);

  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleAccept() {
    setSubmitting(true);
    try {
      const saved = await accept();
      if (saved) router.replace('/(tabs)/dashboard');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.driver.consent.title}</Text>
        <Text style={styles.version}>
          Terms {CURRENT_TOS_VERSION} · Privacy {CURRENT_PRIVACY_VERSION}
        </Text>
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {POLICY_BODY.map((paragraph) => (
          <Text key={paragraph.slice(0, 24)} style={styles.paragraph}>
            {paragraph}
          </Text>
        ))}

        <Text style={styles.sectionLabel}>{t.driver.consent.whatWeCollect}</Text>
        <Card style={styles.disclosureCard}>
          {DISCLOSURES.map((item, index) => (
            <View key={item.title} style={[styles.disclosureRow, index > 0 && styles.disclosureRowDivided]}>
              <Text style={styles.disclosureTitle}>{item.title}</Text>
              <Text style={styles.disclosureBody}>{item.body}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Checkbox checked={checked} onChange={setChecked} label={t.driver.consent.checkboxLabel} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          label={t.driver.consent.acceptAndContinue}
          fullWidth
          disabled={!checked}
          loading={submitting}
          onPress={handleAccept}
        />
        <Button
          label={t.driver.consent.notYouLogOut}
          variant="ghost"
          tone="neutral"
          size="sm"
          fullWidth
          onPress={() => router.push('/logout')}
        />
      </View>
    </SafeAreaView>
  );
}

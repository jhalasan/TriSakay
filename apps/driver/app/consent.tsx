import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Checkbox } from '@trisakay/ui';
import { CURRENT_PRIVACY_VERSION, CURRENT_TOS_VERSION } from '@trisakay/services';
import { useConsentStore } from '../src/store/useConsentStore';
import { styles } from '../src/styles/consent.styles';

const POLICY_BODY = [
  'Placeholder — Terms of Service. By driving for TriSakay you agree to accept ride requests in good faith, treat passengers with respect, and follow the fare shown at trip completion. Fares follow City Ordinance No. 08, s. 2023.',
  'Placeholder — Privacy Policy. TriSakay collects only what matching a ride needs. The summary below is the short version; the full policy will describe each item, how long it is kept, and how to request deletion.',
  'Placeholder — Limitations. TriSakay is a prototype built for academic evaluation in Barangay Dadiangas West. Service availability is best-effort and carries no formal guarantee.',
];

const DISCLOSURES: { title: string; body: string }[] = [
  {
    title: 'Your name and contact number',
    body: 'Shared with a matched passenger only after acceptance, and only for that ride.',
  },
  {
    title: 'Your live location',
    body: 'Transmitted only while you are marked available or on an active trip. TriSakay does not keep a trail of where you go.',
  },
  {
    title: 'Trip and payment history',
    body: 'Kept on your account. PSO staff can see it as part of overseeing the tricycle service.',
  },
  {
    title: 'Verification documents',
    body: "Your license, OR/CR, franchise, and tricycle photo are visible to PSO staff for review only.",
  },
];

export default function ConsentScreen() {
  const router = useRouter();
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
        <Text style={styles.title}>Before you drive</Text>
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

        <Text style={styles.sectionLabel}>What we collect &amp; share</Text>
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
        <Checkbox
          checked={checked}
          onChange={setChecked}
          label="I have read and accept the Terms of Service and Privacy Policy"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label="Accept & Continue" fullWidth disabled={!checked} loading={submitting} onPress={handleAccept} />
      </View>
    </SafeAreaView>
  );
}

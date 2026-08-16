import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Checkbox } from '@trisakay/ui';
import { CURRENT_PRIVACY_VERSION, CURRENT_TOS_VERSION } from '@trisakay/services';
import { useConsentStore } from '../src/store/useConsentStore';
import { DISCLOSURES, POLICY_BODY } from '../src/content/legalCopy';
import { styles } from '../src/styles/consent.styles';

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
      // Only navigate on a confirmed write. On failure the store's `error` is
      // already set and renders below the button, and the user can retry.
      if (saved) router.replace('/(tabs)/home');
    } finally {
      // A gate has no back navigation, so a button left spinning is a
      // force-quit. accept() already swallows its own failures; this is the
      // second layer, covering anything thrown after it returns.
      setSubmitting(false);
    }
  }

  return (
    // No ScreenHeader: it renders a back chevron by default, and there is
    // nothing to go back to from a gate.
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Before you ride</Text>
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
        <Button
          label="Accept & Continue"
          fullWidth
          disabled={!checked}
          loading={submitting}
          onPress={handleAccept}
        />
      </View>
    </SafeAreaView>
  );
}

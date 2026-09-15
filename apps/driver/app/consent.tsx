import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Checkbox, SegmentedControl, colors } from '@trisakay/ui';
import { CURRENT_PRIVACY_VERSION, CURRENT_TOS_VERSION } from '@trisakay/services';
import { ScrollFade } from '../src/components/ScrollFade';
import { useTranslation } from '../src/hooks/useTranslation';
import { useConsentStore } from '../src/store/useConsentStore';
import { DISCLOSURES, PRIVACY_POLICY, TERMS_OF_SERVICE } from '../src/content/legalCopy';
import { styles } from '../src/styles/consent.styles';

type Tab = 'terms' | 'privacy';

export default function ConsentScreen() {
  const router = useRouter();
  const t = useTranslation();
  const error = useConsentStore((state) => state.error);
  const accept = useConsentStore((state) => state.accept);

  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<Tab>('terms');

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

      <View style={styles.tabsWrap}>
        <SegmentedControl
          options={[
            { label: 'Terms of Service', value: 'terms' },
            { label: 'Privacy Policy', value: 'privacy' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      <View style={styles.scrollWrap}>
        <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
          {tab === 'terms'
            ? TERMS_OF_SERVICE.map((section) => (
                <View key={section.heading} style={styles.policySection}>
                  <Text style={styles.disclosureTitle}>{section.heading}</Text>
                  <Text style={styles.paragraph}>{section.body}</Text>
                </View>
              ))
            : (
                <>
                  <Text style={styles.sectionLabel}>{t.driver.consent.whatWeCollect}</Text>
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
        </ScrollView>
        <ScrollFade />
      </View>

      <View style={styles.footer}>
        <Checkbox checked={checked} onChange={setChecked} label={t.driver.consent.checkboxLabel} />
        {error ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : null}
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

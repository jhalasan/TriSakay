import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Card, SegmentedControl } from '@trisakay/ui';
import { CURRENT_PRIVACY_VERSION, CURRENT_TOS_VERSION } from '@trisakay/services';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useTranslation } from '../../src/hooks/useTranslation';
import { DISCLOSURES, PRIVACY_POLICY, TERMS_OF_SERVICE } from '../../src/content/legalCopy';
import { styles } from '../../src/styles/profile/legal.styles';

type Tab = 'terms' | 'privacy';

export default function LegalScreen() {
  const t = useTranslation();
  const [tab, setTab] = useState<Tab>('terms');

  return (
    <View style={styles.container}>
      <ScreenHeader title={t.legal.title} />
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
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.version}>
          Terms {CURRENT_TOS_VERSION} · Privacy {CURRENT_PRIVACY_VERSION}
        </Text>

        {tab === 'terms'
          ? TERMS_OF_SERVICE.map((section) => (
              <View key={section.heading} style={styles.policySection}>
                <Text style={styles.disclosureTitle}>{section.heading}</Text>
                <Text style={styles.paragraph}>{section.body}</Text>
              </View>
            ))
          : (
              <>
                <Text style={styles.sectionLabel}>{t.legal.whatWeCollect}</Text>
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
    </View>
  );
}

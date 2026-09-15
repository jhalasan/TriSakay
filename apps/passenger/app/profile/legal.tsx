import { ScrollView, Text, View } from 'react-native';
import { Card } from '@trisakay/ui';
import { CURRENT_PRIVACY_VERSION, CURRENT_TOS_VERSION } from '@trisakay/services';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useTranslation } from '../../src/hooks/useTranslation';
import { DISCLOSURES, POLICY_BODY } from '../../src/content/legalCopy';
import { styles } from '../../src/styles/profile/legal.styles';

export default function LegalScreen() {
  const t = useTranslation();

  return (
    <View style={styles.container}>
      <ScreenHeader title={t.legal.title} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.version}>
          Terms {CURRENT_TOS_VERSION} · Privacy {CURRENT_PRIVACY_VERSION}
        </Text>

        {POLICY_BODY.map((paragraph) => (
          <Text key={paragraph.slice(0, 24)} style={styles.paragraph}>
            {paragraph}
          </Text>
        ))}

        <Text style={styles.sectionLabel}>{t.legal.whatWeCollect}</Text>
        <Card style={styles.disclosureCard}>
          {DISCLOSURES.map((item, index) => (
            <View key={item.title} style={[styles.disclosureRow, index > 0 && styles.disclosureRowDivided]}>
              <Text style={styles.disclosureTitle}>{item.title}</Text>
              <Text style={styles.disclosureBody}>{item.body}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

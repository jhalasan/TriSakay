import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { BrandMotif, Button, GradientSurface, colors } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useTranslation } from '../../src/hooks/useTranslation';
import { styles } from '../../src/styles/profile/safety.styles';

export default function SafetyScreen() {
  const router = useRouter();
  const t = useTranslation();
  const tips = [t.driver.safety.tip1, t.driver.safety.tip2, t.driver.safety.tip3];

  return (
    <View style={styles.container}>
      <ScreenHeader title={t.safety.title} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroShadowWrap}>
          <GradientSurface token="sos" direction="diagonal" style={styles.hero}>
            <BrandMotif size={150} color={colors.white} opacity={0.14} style={styles.heroMotif} />
            <View style={styles.heroIconTile}>
              <Ionicons name="shield-checkmark" size={22} color={colors.white} />
            </View>
            <Text style={styles.heroTitle}>{t.safety.title}</Text>
            <Text style={styles.heroSubtitle}>{t.safety.subtitle}</Text>
          </GradientSurface>
        </View>

        <Button label={t.safety.callButton} tone="danger" fullWidth onPress={() => Linking.openURL('tel:911')} />

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <View style={styles.cardIconTile}>
              <Ionicons name="hand-left-outline" size={16} color={colors.accentBluePressed} />
            </View>
            <Text style={styles.cardTitle}>{t.safety.howSosWorksTitle}</Text>
          </View>
          <Text style={styles.cardBody}>{t.driver.safety.howSosWorksBody}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.safety.tipsTitle}</Text>
          {tips.map((tip) => (
            <View key={tip} style={styles.tipRow}>
              <View style={styles.tipBullet} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
          <Pressable accessibilityRole="button" style={styles.linkRow} onPress={() => router.push('/complaints')}>
            <Text style={styles.link}>{t.safety.reportIssueLink}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

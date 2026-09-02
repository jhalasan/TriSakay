import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Badge, Card, ListRow, colors } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useTranslation } from '../../src/hooks/useTranslation';
import { styles } from '../../src/styles/profile/payment-methods.styles';

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const t = useTranslation();

  return (
    <View style={styles.container}>
      <ScreenHeader title={t.accountPages.paymentMethodsTitle} />
      <View style={styles.content}>
        <Card style={styles.card}>
          <ListRow
            title={t.accountPages.gcash}
            subtitle={t.accountPages.gcashLinkedNote}
            leading={
              <View style={[styles.iconTile, { backgroundColor: colors.accentBlueSoft }]}>
                <Ionicons name="card-outline" size={18} color={colors.accentBluePressed} />
              </View>
            }
            trailing={<Badge label={t.accountPages.available} tone="green" />}
          />
          <ListRow
            title={t.common.cash}
            subtitle={t.accountPages.cashDirectNote}
            leading={
              <View style={[styles.iconTile, { backgroundColor: colors.accentGreenSoft }]}>
                <Ionicons name="cash-outline" size={18} color={colors.accentGreenPressed} />
              </View>
            }
            trailing={<Badge label={t.accountPages.available} tone="green" />}
            divider={false}
          />
        </Card>
        <Card style={styles.card}>
          <ListRow
            title={t.accountPages.paymentHistoryRowTitle}
            leading={
              <View style={[styles.iconTile, { backgroundColor: colors.accentBlueSoft }]}>
                <Ionicons name="receipt-outline" size={18} color={colors.accentBluePressed} />
              </View>
            }
            onPress={() => router.push('/profile/payment-history')}
            chevron
            divider={false}
          />
        </Card>
        <View style={styles.noticeBox}>
          <Ionicons name="information-circle-outline" size={16} color={colors.inkSoft} style={styles.noticeIcon} />
          <Text style={styles.noticeText}>{t.accountPages.savingNotAvailableNotice}</Text>
        </View>
      </View>
    </View>
  );
}

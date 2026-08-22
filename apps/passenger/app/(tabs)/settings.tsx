import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Toggle, colors } from '@trisakay/ui';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useSettingsStore, type SettingsLanguage } from '../../src/store/useSettingsStore';
import { styles } from '../../src/styles/tabs/settings.styles';

const LANGUAGE_CODES: SettingsLanguage[] = ['en', 'fil'];

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

function IconBadge({ name }: { name: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.iconBadge}>
      <Ionicons name={name} size={16} color={colors.accentBluePressed} />
    </View>
  );
}

function ToggleRow({
  icon,
  label,
  value,
  onValueChange,
  divider = true,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  divider?: boolean;
}) {
  return (
    <View style={[styles.row, divider && styles.rowDivider]}>
      <View style={styles.rowLeading}>
        <IconBadge name={icon} />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Toggle value={value} onValueChange={onValueChange} />
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const t = useTranslation();
  const {
    pushNotificationsEnabled,
    locationTrackingEnabled,
    language,
    smsReceipts,
    emailReceipts,
    togglePushNotifications,
    toggleLocationTracking,
    setLanguage,
    toggleSmsReceipts,
    toggleEmailReceipts,
  } = useSettingsStore();

  const languageLabels: Record<SettingsLanguage, string> = {
    en: t.settings.languageEnglish,
    fil: t.settings.languageFilipino,
  };

  function cycleLanguage() {
    const nextIndex = (LANGUAGE_CODES.indexOf(language) + 1) % LANGUAGE_CODES.length;
    setLanguage(LANGUAGE_CODES[nextIndex]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerBlock}>
          <Text style={styles.title}>{t.settings.title}</Text>
          <Text style={styles.tagline}>{t.settings.tagline}</Text>
        </View>

        <SectionLabel label={t.settings.sectionNotifications} />
        <Card style={styles.card}>
          <ToggleRow
            icon="notifications-outline"
            label={t.settings.pushNotifications}
            value={pushNotificationsEnabled}
            onValueChange={togglePushNotifications}
          />
          <ToggleRow
            icon="chatbubble-ellipses-outline"
            label={t.settings.smsReceipts}
            value={smsReceipts}
            onValueChange={toggleSmsReceipts}
          />
          <ToggleRow
            icon="mail-outline"
            label={t.settings.emailReceipts}
            value={emailReceipts}
            onValueChange={toggleEmailReceipts}
            divider={false}
          />
        </Card>

        <SectionLabel label={t.settings.sectionPrivacy} />
        <Card style={styles.card}>
          <ToggleRow
            icon="location-outline"
            label={t.settings.locationTracking}
            value={locationTrackingEnabled}
            onValueChange={toggleLocationTracking}
            divider={false}
          />
        </Card>

        <SectionLabel label={t.settings.sectionPreferences} />
        <Card style={styles.card}>
          <Pressable style={styles.row} onPress={cycleLanguage} accessibilityRole="button">
            <View style={styles.rowLeading}>
              <IconBadge name="language-outline" />
              <Text style={styles.rowLabel}>{t.settings.language}</Text>
            </View>
            <View style={styles.rowValueSlot}>
              <Text style={styles.rowValue}>{languageLabels[language]}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
            </View>
          </Pressable>
        </Card>

        <View style={styles.logoutWrap}>
          <Button label={t.settings.logOut} variant="outline" tone="danger" fullWidth onPress={() => router.push('/logout')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

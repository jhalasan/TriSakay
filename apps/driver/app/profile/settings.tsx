import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Toggle, colors } from '@trisakay/ui';
import { CheckboxRow } from '../../src/components/CheckboxRow';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useSettingsStore, type SettingsLanguage } from '../../src/store/useSettingsStore';
import { styles } from '../../src/styles/profile/settings.styles';

const LANGUAGE_CODES: SettingsLanguage[] = ['en', 'fil'];

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
    <View style={styles.container}>
      <ScreenHeader title={t.settings.title} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t.settings.pushNotifications}</Text>
          <Toggle value={pushNotificationsEnabled} onValueChange={togglePushNotifications} />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t.settings.locationTracking}</Text>
          <Toggle value={locationTrackingEnabled} onValueChange={toggleLocationTracking} />
        </View>
        <Pressable style={styles.row} onPress={cycleLanguage} accessibilityRole="button">
          <Text style={styles.rowLabel}>{t.settings.language}</Text>
          <View style={styles.rowValueSlot}>
            <Text style={styles.rowValue}>{languageLabels[language]}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
          </View>
        </Pressable>
        <CheckboxRow label={t.settings.smsReceipts} checked={smsReceipts} onToggle={toggleSmsReceipts} />
        <CheckboxRow label={t.settings.emailReceipts} checked={emailReceipts} onToggle={toggleEmailReceipts} />

        <View style={styles.logoutWrap}>
          <Button label={t.settings.logOut} variant="outline" tone="danger" fullWidth onPress={() => router.push('/logout')} />
        </View>
      </ScrollView>
    </View>
  );
}

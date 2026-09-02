import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Toggle, colors } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useSettingsStore, type SettingsLanguage } from '../../src/store/useSettingsStore';
import { interpolate } from '../../src/utils/interpolate';
import { styles } from '../../src/styles/profile/settings.styles';

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
  sublabel,
  value,
  onValueChange,
  divider = true,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  divider?: boolean;
}) {
  return (
    <View style={[styles.row, divider && styles.rowDivider]}>
      <View style={styles.rowLeading}>
        <IconBadge name={icon} />
        <View style={styles.rowTextSlot}>
          <Text style={styles.rowLabel}>{label}</Text>
          {sublabel && (
            <Text style={styles.rowSublabel} numberOfLines={1}>
              {sublabel}
            </Text>
          )}
        </View>
      </View>
      <Toggle value={value} onValueChange={onValueChange} />
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const t = useTranslation();
  const user = useAuthStore((state) => state.user);
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
        <Text style={styles.subtitle}>{t.driver.settings.subtitle}</Text>

        <View>
          <SectionLabel label={t.settings.sectionNotifications} />
          <View style={styles.card}>
            <ToggleRow
              icon="notifications-outline"
              label={t.settings.pushNotifications}
              sublabel={t.driver.settings.pushNotificationsSubtitle}
              value={pushNotificationsEnabled}
              onValueChange={togglePushNotifications}
            />
            <ToggleRow
              icon="chatbubble-outline"
              label={t.settings.smsReceipts}
              sublabel={user?.phone ? interpolate(t.driver.settings.smsReceiptsSubtitle, { phone: user.phone }) : undefined}
              value={smsReceipts}
              onValueChange={toggleSmsReceipts}
            />
            <ToggleRow
              icon="mail-outline"
              label={t.settings.emailReceipts}
              sublabel={user?.email ? interpolate(t.driver.settings.emailReceiptsSubtitle, { email: user.email }) : undefined}
              value={emailReceipts}
              onValueChange={toggleEmailReceipts}
              divider={false}
            />
          </View>
        </View>

        <View>
          <SectionLabel label={t.settings.sectionPrivacy} />
          <View style={styles.card}>
            <ToggleRow
              icon="location-outline"
              label={t.settings.locationTracking}
              sublabel={t.driver.settings.locationTrackingSubtitle}
              value={locationTrackingEnabled}
              onValueChange={toggleLocationTracking}
              divider={false}
            />
          </View>
        </View>

        <View>
          <SectionLabel label={t.settings.sectionPreferences} />
          <View style={styles.card}>
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
          </View>
        </View>

        <View style={styles.logoutWrap}>
          <Button label={t.settings.logOut} variant="outline" tone="danger" fullWidth onPress={() => router.push('/logout')} />
          <Text style={styles.versionLine}>{t.driver.settings.versionLine}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

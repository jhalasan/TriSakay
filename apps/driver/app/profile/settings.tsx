import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Toggle, colors, useTutorial } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useSettingsStore, type SettingsLanguage } from '../../src/store/useSettingsStore';
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
  const tutorial = useTutorial();
  const { pushNotificationsEnabled, locationTrackingEnabled, language, togglePushNotifications, toggleLocationTracking, setLanguage } =
    useSettingsStore();

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
            {/* P1-20 (2026-09-15 launch audit): SMS/email receipt toggles
                removed — read by nothing, no SMS or email receipt is ever
                sent anywhere in the app. */}
            <ToggleRow
              icon="notifications-outline"
              label={t.settings.pushNotifications}
              sublabel={t.driver.settings.pushNotificationsSubtitle}
              value={pushNotificationsEnabled}
              onValueChange={togglePushNotifications}
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

        <View>
          <SectionLabel label={t.settings.sectionLegal} />
          <View style={styles.card}>
            <Pressable
              style={[styles.row, styles.rowDivider]}
              onPress={() => router.push('/profile/legal')}
              accessibilityRole="button"
            >
              <View style={styles.rowLeading}>
                <IconBadge name="document-text-outline" />
                <View style={styles.rowTextSlot}>
                  <Text style={styles.rowLabel}>{t.settings.legalTermsPrivacy}</Text>
                  <Text style={styles.rowSublabel} numberOfLines={1}>
                    {t.settings.legalTermsPrivacySubtitle}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
            </Pressable>
            <Pressable style={styles.row} onPress={() => router.push('/profile/safety')} accessibilityRole="button">
              <View style={styles.rowLeading}>
                <IconBadge name="shield-checkmark-outline" />
                <View style={styles.rowTextSlot}>
                  <Text style={styles.rowLabel}>{t.settings.legalSafetyCenter}</Text>
                  <Text style={styles.rowSublabel} numberOfLines={1}>
                    {t.settings.legalSafetyCenterSubtitle}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
            </Pressable>
          </View>
        </View>

        <View>
          <SectionLabel label={t.settings.sectionHelp} />
          <View style={styles.card}>
            <Pressable style={styles.row} onPress={tutorial.start} accessibilityRole="button">
              <View style={styles.rowLeading}>
                <IconBadge name="help-circle-outline" />
                <View style={styles.rowTextSlot}>
                  <Text style={styles.rowLabel}>{t.settings.replayTour}</Text>
                  <Text style={styles.rowSublabel} numberOfLines={1}>
                    {t.settings.replayTourSubtitle}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
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

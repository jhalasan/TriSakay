import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Toggle, colors, useTutorial } from '@trisakay/ui';
import { OfflineState } from '../../src/components/OfflineState';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useConnectivityStore } from '../../src/store/useConnectivityStore';
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
  subtitle,
  value,
  onValueChange,
  divider = true,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
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
          {subtitle && (
            <Text style={styles.rowSubtitle} numberOfLines={1}>
              {subtitle}
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
  const { pushNotificationsEnabled, language, togglePushNotifications, setLanguage } = useSettingsStore();
  const isOffline = useConnectivityStore((state) => state.isOffline);

  const languageLabels: Record<SettingsLanguage, string> = {
    en: t.settings.languageEnglish,
    fil: t.settings.languageFilipino,
  };

  function cycleLanguage() {
    const nextIndex = (LANGUAGE_CODES.indexOf(language) + 1) % LANGUAGE_CODES.length;
    setLanguage(LANGUAGE_CODES[nextIndex]);
  }

  if (isOffline) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <OfflineState />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerBlock}>
          <Text style={styles.title}>{t.settings.title}</Text>
          <Text style={styles.tagline}>{t.settings.tagline}</Text>
        </View>

        {/* P1-20 (2026-09-15 launch audit): SMS/email receipt toggles and the
            Privacy section's Location tracking toggle were removed here —
            each was read by nothing (no SMS/email is ever sent; location
            tracking is not gated by any flag anywhere in the app). See
            useSettingsStore.ts. */}
        <SectionLabel label={t.settings.sectionNotifications} />
        <Card variant="raised" style={styles.card}>
          <ToggleRow
            icon="notifications-outline"
            label={t.settings.pushNotifications}
            subtitle={t.settings.pushNotificationsSubtitle}
            value={pushNotificationsEnabled}
            onValueChange={togglePushNotifications}
            divider={false}
          />
        </Card>

        <SectionLabel label={t.settings.sectionPreferences} />
        <Card variant="raised" style={styles.card}>
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

        <SectionLabel label={t.settings.sectionLegal} />
        <Card variant="raised" style={styles.card}>
          <Pressable
            style={[styles.row, styles.rowDivider]}
            onPress={() => router.push('/profile/legal')}
            accessibilityRole="button"
          >
            <View style={styles.rowLeading}>
              <IconBadge name="document-text-outline" />
              <View style={styles.rowTextSlot}>
                <Text style={styles.rowLabel}>{t.settings.legalTermsPrivacy}</Text>
                <Text style={styles.rowSubtitle} numberOfLines={1}>
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
                <Text style={styles.rowSubtitle} numberOfLines={1}>
                  {t.settings.legalSafetyCenterSubtitle}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
          </Pressable>
        </Card>

        <SectionLabel label={t.settings.sectionHelp} />
        <Card variant="raised" style={styles.card}>
          <Pressable style={styles.row} onPress={tutorial.start} accessibilityRole="button">
            <View style={styles.rowLeading}>
              <IconBadge name="help-circle-outline" />
              <View style={styles.rowTextSlot}>
                <Text style={styles.rowLabel}>{t.settings.replayTour}</Text>
                <Text style={styles.rowSubtitle} numberOfLines={1}>
                  {t.settings.replayTourSubtitle}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
          </Pressable>
        </Card>

        <View style={styles.logoutWrap}>
          <Button label={t.settings.logOut} variant="outline" tone="danger" fullWidth onPress={() => router.push('/logout')} />
          <Text style={styles.versionFooter}>{t.settings.versionFooter}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

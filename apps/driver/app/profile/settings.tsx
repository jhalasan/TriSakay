import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Toggle, colors } from '@trisakay/ui';
import { CheckboxRow } from '../../src/components/CheckboxRow';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useSettingsStore } from '../../src/store/useSettingsStore';
import { styles } from '../../src/styles/profile/settings.styles';

const LANGUAGES = ['English', 'Filipino'];

export default function SettingsScreen() {
  const router = useRouter();
  const {
    pushNotificationsEnabled,
    locationTrackingEnabled,
    language,
    smsReceipts,
    emailReceipts,
    togglePushNotifications,
    toggleLocationTracking,
    toggleSmsReceipts,
    toggleEmailReceipts,
  } = useSettingsStore();

  function cycleLanguage() {
    const nextIndex = (LANGUAGES.indexOf(language) + 1) % LANGUAGES.length;
    useSettingsStore.setState({ language: LANGUAGES[nextIndex] });
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Settings" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Push notifications</Text>
          <Toggle value={pushNotificationsEnabled} onValueChange={togglePushNotifications} />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Location tracking</Text>
          <Toggle value={locationTrackingEnabled} onValueChange={toggleLocationTracking} />
        </View>
        <Pressable style={styles.row} onPress={cycleLanguage} accessibilityRole="button">
          <Text style={styles.rowLabel}>Language</Text>
          <View style={styles.rowValueSlot}>
            <Text style={styles.rowValue}>{language}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
          </View>
        </Pressable>
        <CheckboxRow label="SMS receipts" checked={smsReceipts} onToggle={toggleSmsReceipts} />
        <CheckboxRow label="Email receipts" checked={emailReceipts} onToggle={toggleEmailReceipts} />

        <View style={styles.logoutWrap}>
          <Button label="Log out" variant="outline" tone="danger" fullWidth onPress={() => router.push('/logout')} />
        </View>
      </ScrollView>
    </View>
  );
}

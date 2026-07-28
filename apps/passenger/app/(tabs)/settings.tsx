import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Toggle, colors } from '@trisakay/ui';
import { useSettingsStore } from '../../src/store/useSettingsStore';
import { styles } from './settings.styles';

const LANGUAGES = ['English', 'Filipino'];

function CheckboxRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      style={styles.row}
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Ionicons name="checkmark" size={15} color={colors.white} />}
      </View>
    </Pressable>
  );
}

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
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Settings</Text>

        <View>
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
        </View>

        <View style={styles.logoutWrap}>
          <Button label="Log out" variant="outline" tone="danger" fullWidth onPress={() => router.push('/logout')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

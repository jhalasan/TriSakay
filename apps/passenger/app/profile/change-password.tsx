import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, PasswordField, PasswordStrengthMeter, colors } from '@trisakay/ui';
import { updatePassword, verifyCurrentPassword } from '@trisakay/services';
import { passwordRuleList } from '@trisakay/shared';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useTranslation } from '../../src/hooks/useTranslation';
import { styles } from '../../src/styles/profile/change-password.styles';

/** Voluntary password change: re-checks the current password, sets the new one, and signs out every other device. */
export default function ChangePasswordScreen() {
  const router = useRouter();
  const t = useTranslation();
  const c = t.changePassword;
  const insets = useSafeAreaInsets();
  const email = useAuthStore((state) => state.user?.email);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [currentError, setCurrentError] = useState<string | null>(null);

  // Only flag a mismatch once the confirmation is as long as the new password.
  const mismatch = confirmNewPassword.length >= newPassword.length && confirmNewPassword.length > 0 && confirmNewPassword !== newPassword;

  const rules = passwordRuleList(c, newPassword);
  const canSave = currentPassword.length > 0 && rules.every((rule) => rule.met) && newPassword === confirmNewPassword && !saving;

  async function handleSave() {
    if (!email || !canSave) return;
    setSaving(true);
    setCurrentError(null);
    const check = await verifyCurrentPassword(email, currentPassword);
    if (check.error) {
      setSaving(false);
      setCurrentError(c.currentIncorrect);
      return;
    }
    const result = await updatePassword(newPassword);
    setSaving(false);
    if (result.error) {
      Alert.alert(c.updateFailedTitle, result.error);
      return;
    }
    Alert.alert(c.updatedTitle, c.updatedMessage, [{ text: t.common.ok, onPress: () => router.back() }]);
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={c.title} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <PasswordField
            label={c.currentPassword}
            value={currentPassword}
            onChangeText={(value) => {
              setCurrentPassword(value);
              setCurrentError(null);
            }}
            error={currentError ?? undefined}
            placeholder="••••••••"
            showLabel={c.showPasswordA11y}
            hideLabel={c.hidePasswordA11y}
            autoComplete="current-password"
            disableAutofill
          />
          <PasswordField
            label={c.newPassword}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="••••••••"
            showLabel={c.showPasswordA11y}
            hideLabel={c.hidePasswordA11y}
            autoComplete="new-password"
            disableAutofill
          />
          <PasswordStrengthMeter rules={rules} labels={{ weak: c.strengthWeak, fair: c.strengthFair, strong: c.strengthStrong }} />
          <PasswordField
            label={c.confirmNewPassword}
            value={confirmNewPassword}
            onChangeText={setConfirmNewPassword}
            placeholder={c.confirmPlaceholder}
            error={mismatch ? c.mismatch : undefined}
            showLabel={c.showPasswordA11y}
            hideLabel={c.hidePasswordA11y}
            autoComplete="new-password"
            disableAutofill
          />
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: Math.max(14, insets.bottom + 6) }]}>
          <Button label={c.saveButton} fullWidth disabled={!canSave} loading={saving} onPress={handleSave} icon={<Ionicons name="lock-closed" size={16} color={canSave ? colors.white : colors.inkFaint} />} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

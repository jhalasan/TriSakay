import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, PasswordField, PasswordStrengthMeter, colors } from '@trisakay/ui';
import { passwordRuleList } from '@trisakay/shared';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useTranslation } from '../../src/hooks/useTranslation';
import { styles } from '../../src/styles/profile/change-password.styles';

/**
 * Prototype-only, on request: the row exists in the Privacy & Safety Center
 * so the account-security surface is honestly present rather than silently
 * missing, but it can't actually work yet — there is no in-app path to
 * re-authenticate and update a password independent of the still-broken
 * password reset flow (P0-3). The fields and the live rule checklist are
 * real; the submit button stays disabled with an explicit notice.
 */
export default function ChangePasswordScreen() {
  const t = useTranslation();
  const c = t.changePassword;
  const insets = useSafeAreaInsets();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Only flag a mismatch once the confirmation is as long as the new password.
  const mismatch = confirmNewPassword.length >= newPassword.length && confirmNewPassword.length > 0 && confirmNewPassword !== newPassword;

  return (
    <View style={styles.container}>
      <ScreenHeader title={c.title} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.statusCard}>
            <View style={styles.statusTile}>
              <Ionicons name="lock-closed" size={18} color={colors.accentBluePressed} />
            </View>
            <View style={styles.statusBody}>
              <Text style={styles.statusTitle}>{c.notAvailableTitle}</Text>
              <Text style={styles.statusText}>{c.notAvailableNotice}</Text>
            </View>
          </View>

          <PasswordField
            label={c.currentPassword}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="••••••••"
            showLabel={c.showPasswordA11y}
            hideLabel={c.hidePasswordA11y}
            autoComplete="current-password"
          />
          <PasswordField
            label={c.newPassword}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="••••••••"
            showLabel={c.showPasswordA11y}
            hideLabel={c.hidePasswordA11y}
            autoComplete="new-password"
          />
          <PasswordStrengthMeter rules={passwordRuleList(c, newPassword)} labels={{ weak: c.strengthWeak, fair: c.strengthFair, strong: c.strengthStrong }} />
          <PasswordField
            label={c.confirmNewPassword}
            value={confirmNewPassword}
            onChangeText={setConfirmNewPassword}
            placeholder={c.confirmPlaceholder}
            error={mismatch ? c.mismatch : undefined}
            showLabel={c.showPasswordA11y}
            hideLabel={c.hidePasswordA11y}
            autoComplete="new-password"
          />
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: Math.max(14, insets.bottom + 6) }]}>
          <Button label={c.saveButton} fullWidth disabled icon={<Ionicons name="lock-closed" size={16} color={colors.inkFaint} />} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

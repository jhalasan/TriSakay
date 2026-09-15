import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, Text, View } from 'react-native';
import { Button, TextField, colors } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useTranslation } from '../../src/hooks/useTranslation';
import { styles } from '../../src/styles/profile/change-password.styles';

/**
 * Mirrors apps/passenger/app/profile/change-password.tsx. Prototype-only,
 * on request: the row exists in the Privacy & Safety Center so the
 * account-security surface is honestly present rather than silently
 * missing, but it can't actually work yet — there is no in-app path to
 * re-authenticate and update a password independent of the still-broken
 * password reset flow (P0-3). Fields are real and typable; the submit
 * button stays disabled with an explicit notice, the same pattern already
 * used for the mobile-number sign-in tab.
 */
export default function ChangePasswordScreen() {
  const t = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  return (
    <View style={styles.container}>
      <ScreenHeader title={t.changePassword.title} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.noticeBox}>
          <Ionicons name="information-circle-outline" size={16} color={colors.inkSoft} style={styles.noticeIcon} />
          <Text style={styles.noticeText}>{t.changePassword.notAvailableNotice}</Text>
        </View>

        <View style={styles.fields}>
          <TextField
            label={t.changePassword.currentPassword}
            placeholder="••••••••"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
          />
          <TextField
            label={t.changePassword.newPassword}
            placeholder="••••••••"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
          />
          <TextField
            label={t.changePassword.confirmNewPassword}
            placeholder="••••••••"
            value={confirmNewPassword}
            onChangeText={setConfirmNewPassword}
            secureTextEntry
          />
        </View>

        <Button label={t.changePassword.saveButton} fullWidth disabled />
      </ScrollView>
    </View>
  );
}

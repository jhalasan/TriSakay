import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Modal, ScrollView, Text, View } from 'react-native';
import { getMfaStatus, updateProfile, verifyCurrentPassword } from '@trisakay/services';
import { maskEmail, maskPhone } from '@trisakay/shared';
import { Button, Card, ListRow, TextField, colors } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useTranslation } from '../../src/hooks/useTranslation';
import { styles } from '../../src/styles/profile/account.styles';

/** How long the email and phone stay readable after the password check, before they mask again. */
const REVEAL_MS = 60_000;

function IconTile({ name }: { name: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.iconTile}>
      <Ionicons name={name} size={18} color={colors.accentBluePressed} />
    </View>
  );
}

/** One place for personal details: masked by default, shown only after re-entering the password. */
export default function AccountScreen() {
  const router = useRouter();
  const t = useTranslation();
  const a = t.accountMgmt;
  const user = useAuthStore((state) => state.user);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const [revealed, setRevealed] = useState(false);
  const [askingPassword, setAskingPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [savingPhone, setSavingPhone] = useState(false);
  const [mfaOn, setMfaOn] = useState<boolean | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getMfaStatus()
      .then((status) => setMfaOn(status.enrolled))
      .catch(() => setMfaOn(null));
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function hide() {
    if (timer.current) clearTimeout(timer.current);
    setRevealed(false);
    setEditingPhone(false);
  }

  function startReveal() {
    setPassword('');
    setPasswordError(null);
    setAskingPassword(true);
  }

  async function confirmReveal() {
    if (!user?.email) return;
    setChecking(true);
    const { error } = await verifyCurrentPassword(user.email, password);
    setChecking(false);
    if (error) {
      setPasswordError(a.incorrect);
      return;
    }
    setAskingPassword(false);
    setPhone(user.phone ?? '');
    setRevealed(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(hide, REVEAL_MS);
  }

  async function savePhone() {
    setSavingPhone(true);
    const { error } = await updateProfile({ firstName: user?.firstName ?? '', lastName: user?.lastName ?? '', phone });
    setSavingPhone(false);
    if (error) {
      Alert.alert(a.title, error);
      return;
    }
    await refreshProfile();
    setEditingPhone(false);
    Alert.alert(a.phoneSaved);
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={a.title} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={styles.sectionLabel}>{a.detailsSection}</Text>
          <Card variant="raised" style={styles.card}>
            <View style={styles.detailRow}>
              <IconTile name="mail-outline" />
              <View style={styles.detailBody}>
                <Text style={styles.detailLabel}>{a.email}</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {revealed ? (user?.email ?? '—') : maskEmail(user?.email)}
                </Text>
              </View>
              <Button label={revealed ? a.hide : a.show} variant="ghost" tone="neutral" onPress={revealed ? hide : startReveal} />
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <IconTile name="call-outline" />
              <View style={styles.detailBody}>
                <Text style={styles.detailLabel}>{a.phone}</Text>
                {editingPhone ? (
                  <TextField value={phone} onChangeText={setPhone} keyboardType="phone-pad" helperText={t.hints.phone} />
                ) : (
                  <Text style={styles.detailValue}>{revealed ? (user?.phone ?? '—') : maskPhone(user?.phone)}</Text>
                )}
              </View>
              {revealed && !editingPhone && <Button label={a.editPhone} variant="ghost" tone="neutral" onPress={() => setEditingPhone(true)} />}
              {editingPhone && <Button label={a.savePhone} loading={savingPhone} onPress={savePhone} />}
            </View>
          </Card>
        </View>

        <View>
          <Text style={styles.sectionLabel}>{a.securitySection}</Text>
          <Card variant="raised" style={styles.navGroup}>
            <ListRow title={a.changePassword} leading={<IconTile name="lock-closed-outline" />} onPress={() => router.push('/profile/change-password')} chevron />
            <ListRow
              title={a.twoFactor}
              subtitle={mfaOn === null ? undefined : mfaOn ? a.twoFactorOn : a.twoFactorOff}
              leading={<IconTile name="shield-checkmark-outline" />}
              onPress={() => router.push('/profile/two-factor')}
              chevron
            />
            <ListRow title={a.devices} leading={<IconTile name="phone-portrait-outline" />} onPress={() => router.push('/profile/devices')} chevron divider={false} />
          </Card>
        </View>

        <View>
          <Text style={styles.sectionLabel}>{a.dangerSection}</Text>
          <Card variant="raised" style={styles.navGroup}>
            <ListRow
              title={a.deactivate}
              subtitle={a.deactivateSubtitle}
              leading={<IconTile name="person-remove-outline" />}
              onPress={() => router.push('/deactivate-account')}
              chevron
              divider={false}
            />
          </Card>
        </View>
      </ScrollView>

      <Modal visible={askingPassword} transparent animationType="fade" onRequestClose={() => setAskingPassword(false)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>{a.showTitle}</Text>
            <Text style={styles.dialogBody}>{a.showMessage}</Text>
            <TextField
              label={a.passwordLabel}
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setPasswordError(null);
              }}
              secureTextEntry
              error={passwordError ?? undefined}
            />
            <View style={styles.dialogActions}>
              <View style={styles.dialogAction}>
                <Button label={t.common.cancel} variant="outline" tone="neutral" fullWidth disabled={checking} onPress={() => setAskingPassword(false)} />
              </View>
              <View style={styles.dialogAction}>
                <Button label={a.confirm} fullWidth loading={checking} disabled={password.length === 0} onPress={confirmReveal} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

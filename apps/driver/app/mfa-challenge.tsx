import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMfaStatus, verifyMfaCode } from '@trisakay/services';
import { Button, TextField, colors } from '@trisakay/ui';
import { useMfaStore } from '../src/store/useMfaStore';
import { useTranslation } from '../src/hooks/useTranslation';
import { styles } from '../src/styles/mfa.styles';

/** Shown after the password when the account has MFA on: the app stays closed until a valid code is entered. */
export default function MfaChallengeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  const a = t.accountMgmt;
  const markOk = useMfaStore((state) => state.markOk);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      const { factorId } = await getMfaStatus();
      if (!factorId) throw new Error('no factor');
      const { error: failure } = await verifyMfaCode(factorId, code.trim());
      if (failure) {
        setError(a.mfaWrongCode);
        return;
      }
      markOk();
      router.replace({ pathname: '/splash', params: { fast: '1' } });
    } catch {
      setError(a.mfaUnavailable);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.challengeContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.challengeTile}>
            <Ionicons name="shield-checkmark" size={30} color={colors.accentBluePressed} />
          </View>
          <Text style={styles.challengeTitle}>{a.mfaChallengeTitle}</Text>
          <Text style={styles.challengeBody}>{a.mfaChallengeBody}</Text>
          <TextField
            label={a.mfaCodeLabel}
            value={code}
            onChangeText={(value) => {
              setCode(value.replace(/\D/g, ''));
              setError(null);
            }}
            keyboardType="number-pad"
            maxLength={6}
            autoComplete="one-time-code"
            error={error ?? undefined}
          />
        </ScrollView>
        <View style={[styles.bottomBar, { paddingBottom: Math.max(14, insets.bottom + 6) }]}>
          <Button label={a.mfaChallengeSubmit} fullWidth loading={busy} disabled={code.length !== 6} onPress={handleSubmit} />
          <Button label={t.accountSuspended.logOut} variant="ghost" tone="neutral" fullWidth onPress={() => router.push('/logout')} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

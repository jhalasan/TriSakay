import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, Text, View } from 'react-native';
import { confirmMfaEnrollment, disableMfa, getMfaStatus, startMfaEnrollment } from '@trisakay/services';
import { Button, TextField, colors } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useMfaStore } from '../../src/store/useMfaStore';
import { useTranslation } from '../../src/hooks/useTranslation';
import { styles } from '../../src/styles/mfa.styles';

type Stage = 'loading' | 'off' | 'setup' | 'on';

/** Optional MFA: set up an authenticator app, or turn it off again. */
export default function TwoFactorScreen() {
  const t = useTranslation();
  const a = t.accountMgmt;
  const markOk = useMfaStore((state) => state.markOk);
  const [stage, setStage] = useState<Stage>('loading');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMfaStatus()
      .then((status) => {
        setFactorId(status.factorId);
        setStage(status.enrolled ? 'on' : 'off');
      })
      .catch(() => {
        setError(a.mfaUnavailable);
        setStage('off');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleStart() {
    setBusy(true);
    setError(null);
    const result = await startMfaEnrollment();
    setBusy(false);
    if (result.error || !result.factorId) {
      setError(a.mfaUnavailable);
      return;
    }
    setFactorId(result.factorId);
    setSecret(result.secret);
    setUri(result.uri);
    setCode('');
    setStage('setup');
  }

  function handleOpenApp() {
    if (!uri) return;
    Linking.openURL(uri).catch(() => Alert.alert(a.mfaOpenAppFailed));
  }

  async function handleVerify() {
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const { error: failure } = await confirmMfaEnrollment(factorId, code.trim());
    setBusy(false);
    if (failure) {
      setError(a.mfaWrongCode);
      return;
    }
    // Verifying the first code raises this session to MFA level; the sign-in gate must not ask again.
    markOk();
    setStage('on');
  }

  function handleDisable() {
    if (!factorId) return;
    Alert.alert(a.mfaDisableConfirm, a.mfaDisableMessage, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: a.mfaDisable,
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          const { error: failure } = await disableMfa(factorId);
          setBusy(false);
          if (failure) {
            setError(failure);
            return;
          }
          setFactorId(null);
          setStage('off');
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={a.mfaTitle} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.infoCard}>
            <View style={styles.infoTile}>
              <Ionicons name="shield-checkmark" size={18} color={colors.accentBluePressed} />
            </View>
            <Text style={styles.infoText}>{stage === 'on' ? a.mfaEnabled : a.mfaIntro}</Text>
          </View>

          {stage === 'setup' && (
            <>
              <Button label={a.mfaOpenApp} variant="outline" tone="neutral" fullWidth onPress={handleOpenApp} />
              <View style={styles.secretBox}>
                <Text style={styles.secretLabel}>{a.mfaSecretLabel}</Text>
                <Text selectable style={styles.secretValue}>
                  {secret}
                </Text>
              </View>
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
            </>
          )}

          {stage !== 'setup' && error && <Text style={styles.errorText}>{error}</Text>}
        </ScrollView>

        <View style={styles.bottomBar}>
          {stage === 'off' && <Button label={a.mfaStart} fullWidth loading={busy} onPress={handleStart} />}
          {stage === 'setup' && <Button label={a.mfaVerify} fullWidth loading={busy} disabled={code.length !== 6} onPress={handleVerify} />}
          {stage === 'on' && <Button label={a.mfaDisable} variant="outline" tone="danger" fullWidth loading={busy} onPress={handleDisable} />}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

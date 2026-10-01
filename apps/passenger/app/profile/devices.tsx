import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
import { listMySessions, revokeMySession, signOutOtherDevices, type AccountSession } from '@trisakay/services';
import { describeDevice, relativeTime } from '@trisakay/shared';
import { Button, Card, colors } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useTranslation } from '../../src/hooks/useTranslation';
import { styles } from '../../src/styles/profile/devices.styles';

/** Every device signed in to this account, with a way to sign the others out. */
export default function DevicesScreen() {
  const a = useTranslation().accountMgmt;
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [signingOutAll, setSigningOutAll] = useState(false);

  const load = useCallback(async () => {
    const result = await listMySessions();
    if (result.error) Alert.alert(a.devicesTitle, result.error);
    else setSessions(result.sessions);
    setLoading(false);
  }, [a.devicesTitle]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSignOut(id: string) {
    setBusyId(id);
    const { error } = await revokeMySession(id);
    setBusyId(null);
    if (error) Alert.alert(a.devicesTitle, error);
    await load();
  }

  async function handleSignOutOthers() {
    setSigningOutAll(true);
    await signOutOtherDevices();
    setSigningOutAll(false);
    await load();
  }

  function deviceName(session: AccountSession): string {
    const device = describeDevice(session.userAgent);
    if (device.kind === 'android') return a.devicesAndroidApp;
    return device.kind === 'unknown' ? a.devicesUnknown : device.text;
  }

  const others = sessions.filter((session) => !session.isCurrent);

  return (
    <View style={styles.container}>
      <ScreenHeader title={a.devicesTitle} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        <Card variant="raised" style={styles.card}>
          {sessions.map((session, index) => (
            <View key={session.id} style={[styles.row, index > 0 && styles.rowDivider]}>
              <View style={styles.tile}>
                <Ionicons name="phone-portrait-outline" size={18} color={colors.accentBluePressed} />
              </View>
              <View style={styles.body}>
                <Text style={styles.name} numberOfLines={1}>
                  {deviceName(session)}
                </Text>
                <Text style={styles.meta}>
                  {session.isCurrent ? a.devicesThisDevice : `${a.devicesLastActive} · ${relativeTime(session.updatedAt)}`}
                </Text>
              </View>
              {!session.isCurrent && (
                <Button label={a.devicesSignOut} variant="ghost" tone="danger" loading={busyId === session.id} onPress={() => handleSignOut(session.id)} />
              )}
            </View>
          ))}
        </Card>

        {!loading && others.length === 0 && <Text style={styles.empty}>{a.devicesNone}</Text>}
      </ScrollView>

      {others.length > 0 && (
        <View style={styles.bottomBar}>
          <Button label={a.devicesSignOutOthers} variant="outline" tone="danger" fullWidth loading={signingOutAll} onPress={handleSignOutOthers} />
        </View>
      )}
    </View>
  );
}

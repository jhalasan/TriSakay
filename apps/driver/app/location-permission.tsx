import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Modal, Text, View } from 'react-native';
import { Button, colors } from '@trisakay/ui';
import { useLocationPermission } from '../src/hooks/useLocationPermission';
import { styles } from '../src/styles/location-permission.styles';

export default function LocationPermissionScreen() {
  const router = useRouter();
  const { state, refresh, request, dismiss } = useLocationPermission();
  const [working, setWorking] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (state === 'granted') router.dismiss();
  }, [state, router]);

  const isBlocked = state === 'blocked';

  async function handleEnable() {
    setWorking(true);
    await request();
    setWorking(false);
  }

  function handleNotNow() {
    dismiss();
    router.dismiss();
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleNotNow}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconBadge}>
            <Ionicons name="location-outline" size={26} color={colors.accentBluePressed} />
          </View>

          <Text style={styles.title}>Turn on location</Text>
          <Text style={styles.body}>
            TriSakay needs your location to match you with nearby drivers and estimate pickup accurately.
          </Text>

          {isBlocked ? (
            <Text style={styles.blockedNote}>
              Location is off for TriSakay in your device settings. Open settings to turn it on.
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Button label={isBlocked ? 'Open settings' : 'Enable location'} fullWidth loading={working} onPress={handleEnable} />
            <Button label="Not now" variant="ghost" tone="neutral" fullWidth disabled={working} onPress={handleNotNow} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

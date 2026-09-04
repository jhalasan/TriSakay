import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { Pressable, Text, View } from 'react-native';
import { Button, colors } from '@trisakay/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { useHistoryStore } from '../../store/useHistoryStore';
import { styles } from './OfflineState.styles';

/**
 * The standard offline body — per the redesign's system-states spec, every
 * tab falls back to this (icon tile, title, cause, Try again, cached-receipt
 * link) while `useConnectivityStore`'s `isOffline` is true, not just Home.
 * Each screen still owns its own `isOffline` early-return; this only owns
 * the body those returns render, so it stays identical everywhere.
 */
export function OfflineState() {
  const router = useRouter();
  const t = useTranslation();
  const lastRideId = useHistoryStore((state) => state.items[0]?.id);

  return (
    <View style={styles.wrap}>
      <View style={styles.iconTile}>
        <Ionicons name="locate-outline" size={22} color={colors.accentBlue} />
      </View>
      <Text style={styles.title}>{t.offline.title}</Text>
      <Text style={styles.message}>{t.offline.cause}</Text>
      <View style={styles.button}>
        <Button label={t.offline.tryAgain} fullWidth onPress={() => void NetInfo.fetch()} />
      </View>
      {lastRideId && (
        <Pressable accessibilityRole="button" onPress={() => router.push(`/history/${lastRideId}`)}>
          <Text style={styles.receiptLink}>{t.offline.viewLastReceipt}</Text>
        </Pressable>
      )}
    </View>
  );
}

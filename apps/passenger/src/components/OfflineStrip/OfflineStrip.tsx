import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useConnectivityStore } from '../../store/useConnectivityStore';
import { useTranslation } from '../../hooks/useTranslation';
import { styles } from './OfflineStrip.styles';

/**
 * The only element allowed to sit above a screen's own header band, per the
 * redesign's system-states spec. Rendered once at the tab-navigator level so
 * it persists across every tab rather than being duplicated per screen.
 */
export function OfflineStrip() {
  const isOffline = useConnectivityStore((state) => state.isOffline);
  const t = useTranslation();

  if (!isOffline) return null;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.row}>
        <View style={styles.dot} />
        <Text style={styles.text}>{t.offline.stripMessage}</Text>
      </View>
    </SafeAreaView>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { colors } from '@trisakay/ui';
import { useLocationPermission } from '../../hooks/useLocationPermission';
import { styles } from './LocationRequiredNotice.styles';

/**
 * Renders nothing once permission is granted, so call sites can drop it in
 * unconditionally next to the control it explains. Routes to the same prompt
 * the app shows on resume — tapping here bypasses the "Not now" dismissal,
 * which is the point: the user is asking for the feature right now.
 */
export function LocationRequiredNotice() {
  const router = useRouter();
  const { isGranted } = useLocationPermission();

  if (isGranted) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Location required — tap to enable"
      hitSlop={8}
      style={styles.row}
      onPress={() => router.push('/location-permission')}
    >
      <Ionicons name="location-outline" size={14} color={colors.danger} />
      <Text style={styles.text}>Location required — tap to enable</Text>
    </Pressable>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { colors } from '@trisakay/ui';
import { useLocationPermission } from '../../hooks/useLocationPermission';
import { useTranslation } from '../../hooks/useTranslation';
import { styles } from './LocationRequiredNotice.styles';

/**
 * The same reason, phrased for the button rather than for the notice. Call
 * sites pass this as the `accessibilityHint` of the control this notice
 * explains, so a screen-reader user hears why the button is dead without
 * having to find and focus a second element. Apply it only while that control
 * is actually disabled.
 */
export function useLocationRequiredHint() {
  return useTranslation().common.locationRequiredNotice;
}

/**
 * Renders nothing once permission is granted, so call sites can drop it in
 * unconditionally next to the control it explains. Routes to the same prompt
 * the app shows on resume — tapping here bypasses the "Not now" dismissal,
 * which is the point: the user is asking for the feature right now.
 */
export function LocationRequiredNotice() {
  const router = useRouter();
  const { isGranted } = useLocationPermission();
  const label = useLocationRequiredHint();

  if (isGranted) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={styles.row}
      onPress={() => router.push('/location-permission')}
    >
      <Ionicons name="location-outline" size={14} color={colors.danger} />
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

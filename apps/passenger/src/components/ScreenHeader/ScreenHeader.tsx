import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@trisakay/ui';
import { styles } from './ScreenHeader.styles';

export interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  showBack?: boolean;
  right?: React.ReactNode;
}

/**
 * Screens that use this component sit directly in the root Stack, which
 * renders with `headerShown: false` and no safe-area wrapper of its own (see
 * `app/_layout.tsx`) — so the inset has to be applied here, once, rather than
 * trusted to every screen that renders this header.
 */
export function ScreenHeader({ title, onBack, showBack = true, right }: ScreenHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.row, { paddingTop: styles.row.paddingVertical + insets.top }]}>
      {showBack && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          onPress={onBack ?? (() => router.back())}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
      )}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {right && <View style={styles.rightSlot}>{right}</View>}
    </View>
  );
}

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
          // A screen reached via router.replace() (e.g. the guided tour jumping
          // straight to a step's screen) has no history to pop — router.back()
          // then throws "GO_BACK was not handled by any navigator". Dashboard is
          // always a safe landing spot in that case.
          onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard')))}
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

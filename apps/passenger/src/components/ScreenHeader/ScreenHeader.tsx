import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
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

  return (
    <View style={styles.row}>
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

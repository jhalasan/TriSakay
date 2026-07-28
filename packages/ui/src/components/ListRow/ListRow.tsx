import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { colors } from '../../theme';
import { styles } from './ListRow.styles';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  divider?: boolean;
}

export function ListRow({ title, subtitle, leading, trailing, onPress, chevron, divider = true }: ListRowProps) {
  const content = (
    <View style={styles.row}>
      {leading && <View style={styles.leadingSlot}>{leading}</View>}
      <View style={styles.textSlot}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {trailing && <View style={styles.trailingSlot}>{trailing}</View>}
      {chevron && <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />}
    </View>
  );

  return (
    <View>
      {onPress ? (
        <Pressable onPress={onPress} accessibilityRole="button">
          {content}
        </Pressable>
      ) : (
        content
      )}
      {divider && <View style={styles.divider} />}
    </View>
  );
}

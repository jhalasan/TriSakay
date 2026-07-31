import { Text, View } from 'react-native';
import { colors } from '../../theme';
import { BrandMotif } from '../BrandMotif';
import { styles } from './EmptyState.styles';

export interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: React.ReactNode;
}

/**
 * A faint BrandMotif watermark sits behind every empty state — the app
 * ships with no invented sample content (see DESIGN.md's "Empty by
 * default"), so this is the one place an empty list gets some presence
 * without resorting to fake data.
 */
export function EmptyState({ title, message, icon }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.motifSlot} pointerEvents="none">
        <BrandMotif size={160} color={colors.accentBlue} opacity={0.05} />
      </View>
      {icon && <View style={styles.iconSlot}>{icon}</View>}
      <Text style={styles.title}>{title}</Text>
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { colors } from '../../theme';
import { styles } from './StarRating.styles';

export interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  max?: number;
  size?: number;
}

export function StarRating({ value, onChange, max = 5, size = 22 }: StarRatingProps) {
  const editable = !!onChange;
  const stars = Array.from({ length: max }, (_, i) => i + 1);

  return (
    <View style={styles.row} accessibilityRole={editable ? 'adjustable' : 'text'}>
      {stars.map((star) =>
        editable ? (
          <Pressable
            key={star}
            onPress={() => onChange?.(star)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Rate ${star} out of ${max} stars`}
          >
            <Ionicons
              name={star <= value ? 'star' : 'star-outline'}
              size={size}
              color={star <= value ? colors.accentBlue : colors.inkFaint}
            />
          </Pressable>
        ) : (
          <Ionicons
            key={star}
            name={star <= value ? 'star' : 'star-outline'}
            size={size}
            color={star <= value ? colors.accentBlue : colors.inkFaint}
          />
        ),
      )}
    </View>
  );
}

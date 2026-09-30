import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View, type AccessibilityActionEvent } from 'react-native';
import { colors } from '../../theme';

export interface StarPickerProps {
  /** 0 = nothing chosen yet. */
  value: number;
  onChange: (value: number) => void;
  /** 44 on the rate page, 36 on trip complete. */
  size?: number;
  /** Colour of the filled stars — the caller maps score to tone (1-2 red, 3 navy, 4-5 green). */
  activeColor?: string;
  /** Unfilled stars. */
  emptyColor?: string;
  gap?: number;
  max?: number;
  /** Screen-reader name for the whole control, e.g. "Rating". */
  accessibilityLabel?: string;
  /** Per-star label, e.g. (n) => `${n} stars`. */
  starLabel?: (star: number) => string;
}

/**
 * The redesign's interactive star row. It reads as one adjustable control to
 * a screen reader (swipe up/down changes the score, `accessibilityValue`
 * reports it) while each star stays a ≥44px touch target for everyone else.
 */
export function StarPicker({
  value,
  onChange,
  size = 44,
  activeColor = colors.accentBlue,
  emptyColor = colors.line,
  gap = 10,
  max = 5,
  accessibilityLabel = 'Rating',
  starLabel = (star) => `${star} of ${max}`,
}: StarPickerProps) {
  function handleAccessibilityAction(event: AccessibilityActionEvent) {
    if (event.nativeEvent.actionName === 'increment') onChange(Math.min(max, value + 1));
    if (event.nativeEvent.actionName === 'decrement') onChange(Math.max(1, value - 1));
  }

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={handleAccessibilityAction}
      style={[styles.row, { gap }]}
    >
      {Array.from({ length: max }, (_, i) => i + 1).map((star) => {
        const filled = star <= value;
        return (
          <Pressable
            key={star}
            accessible={false}
            importantForAccessibility="no"
            accessibilityLabel={starLabel(star)}
            hitSlop={Math.max(0, Math.ceil((44 - size) / 2))}
            onPress={() => onChange(star)}
          >
            <Ionicons name="star" size={size} color={filled ? activeColor : emptyColor} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});

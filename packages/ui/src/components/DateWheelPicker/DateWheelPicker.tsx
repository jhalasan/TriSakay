import { useEffect, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { colors, fontFamily, radius } from '../../theme';

const ITEM_HEIGHT = 38;
const VISIBLE_ROWS = 5;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

interface WheelProps {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  accessibilityLabel: string;
  flex: number;
}

/** One snapping column. Tracks its own scroll position and reports the settled row. */
function Wheel({ items, selectedIndex, onSelect, accessibilityLabel, flex }: WheelProps) {
  const ref = useRef<ScrollView>(null);

  useEffect(() => {
    ref.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
  }, [selectedIndex, items.length]);

  function settle(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    onSelect(Math.min(items.length - 1, Math.max(0, index)));
  }

  function handleAccessibilityAction(event: AccessibilityActionEvent) {
    if (event.nativeEvent.actionName === 'increment') onSelect(Math.min(items.length - 1, selectedIndex + 1));
    if (event.nativeEvent.actionName === 'decrement') onSelect(Math.max(0, selectedIndex - 1));
  }

  return (
    <View
      style={{ flex }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: items[selectedIndex] }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={handleAccessibilityAction}
    >
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        nestedScrollEnabled
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * Math.floor(VISIBLE_ROWS / 2) }}
      >
        {items.map((label, index) => (
          <View key={`${label}-${index}`} style={styles.item}>
            <Text style={[styles.itemText, index === selectedIndex && styles.itemTextActive]}>{label}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export interface DateWheelPickerProps {
  value: Date;
  onChange: (value: Date) => void;
  minYear: number;
  maxYear: number;
  /** Screen-reader names for the three columns. */
  monthLabel?: string;
  dayLabel?: string;
  yearLabel?: string;
}

/**
 * A month / day / year wheel in plain React Native, so it looks and behaves
 * the same on iOS and Android with no native date-picker dependency. The day
 * column clamps to the month's length (Jan 31 -> Feb becomes Feb 28/29).
 */
export function DateWheelPicker({
  value,
  onChange,
  minYear,
  maxYear,
  monthLabel = 'Month',
  dayLabel = 'Day',
  yearLabel = 'Year',
}: DateWheelPickerProps) {
  const year = Math.min(maxYear, Math.max(minYear, value.getFullYear()));
  const monthIndex = value.getMonth();
  const dayCount = daysInMonth(year, monthIndex);
  const day = Math.min(value.getDate(), dayCount);

  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => String(minYear + i));
  const days = Array.from({ length: dayCount }, (_, i) => String(i + 1));

  function emit(nextYear: number, nextMonth: number, nextDay: number) {
    onChange(new Date(nextYear, nextMonth, Math.min(nextDay, daysInMonth(nextYear, nextMonth))));
  }

  return (
    <View style={styles.well}>
      <View style={styles.band} pointerEvents="none" />
      <Wheel flex={1.3} items={MONTHS} selectedIndex={monthIndex} accessibilityLabel={monthLabel} onSelect={(i) => emit(year, i, day)} />
      <Wheel flex={0.9} items={days} selectedIndex={day - 1} accessibilityLabel={dayLabel} onSelect={(i) => emit(year, monthIndex, i + 1)} />
      <Wheel flex={1.1} items={years} selectedIndex={year - minYear} accessibilityLabel={yearLabel} onSelect={(i) => emit(minYear + i, monthIndex, day)} />
    </View>
  );
}

const styles = StyleSheet.create({
  well: {
    flexDirection: 'row',
    height: ITEM_HEIGHT * VISIBLE_ROWS,
    backgroundColor: colors.bg,
    borderRadius: radius.md3,
    overflow: 'hidden',
    paddingHorizontal: 8,
  },
  // The white selection band sits behind the centre row.
  band: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: ITEM_HEIGHT * Math.floor(VISIBLE_ROWS / 2),
    height: ITEM_HEIGHT,
    borderRadius: 10,
    backgroundColor: colors.white,
  },
  item: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontFamily: fontFamily.regular, fontSize: 17, lineHeight: 22, color: colors.inkFaint },
  itemTextActive: { fontFamily: fontFamily.semibold, color: colors.ink },
});

import { Text, View } from 'react-native';
import type { DailyEarning } from '../../types/earnings';
import { styles } from './EarningsBarChart.styles';

export interface EarningsBarChartProps {
  data: DailyEarning[];
  height?: number;
  todayLabel: string;
}

const LABEL_HEIGHT = 44;

function formatCompact(amount: number): string {
  if (amount >= 1000) return `₱${(amount / 1000).toFixed(1)}K`;
  return `₱${Math.round(amount)}`;
}

function formatDayLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { weekday: 'short' });
}

function isToday(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA') === new Date().toLocaleDateString('en-CA');
}

/**
 * Plain flex/percentage-height bars rather than react-native-svg — a fixed-
 * height parent lets RN size a percentage-height child directly, no
 * viewBox/preserveAspectRatio needed. Shows at most the 7 most recent days
 * the driver has completed/paid rides on; `v_driver_earnings` only ever
 * returns rows for days with at least one, so every bar is non-zero.
 */
export function EarningsBarChart({ data, height = 160, todayLabel }: EarningsBarChartProps) {
  const recent = data.slice(-7);
  const trackHeight = Math.max(height - LABEL_HEIGHT, 40);
  const max = Math.max(...recent.map((day) => day.totalCollected), 1);

  return (
    <View style={styles.container}>
      <View style={[styles.barsRow, { height }]}>
        {recent.map((day) => {
          const barHeightPercent = Math.max((day.totalCollected / max) * 100, 8);
          const today = isToday(day.date);
          return (
            <View key={day.date} style={styles.barColumn}>
              <Text style={styles.barValue} numberOfLines={1}>
                {formatCompact(day.totalCollected)}
              </Text>
              <View style={[styles.barTrack, { height: trackHeight }]}>
                <View style={[styles.bar, today ? styles.barToday : styles.barPast, { height: `${barHeightPercent}%` }]} />
              </View>
              <Text style={[styles.barLabel, today && styles.barLabelToday]}>{today ? todayLabel : formatDayLabel(day.date)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

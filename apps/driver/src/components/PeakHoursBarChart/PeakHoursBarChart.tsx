import { Text, View } from 'react-native';
import type { PeakHourBucket } from '../../types/earnings';
import { styles } from './PeakHoursBarChart.styles';

export interface PeakHoursBarChartProps {
  data: PeakHourBucket[];
  height?: number;
}

const LABEL_HEIGHT = 30;

/**
 * Plain flex/percentage-height bars, same approach as EarningsBarChart —
 * a fixed-height parent lets RN size a percentage-height child directly,
 * no react-native-svg needed. All 12 two-hour buckets are always shown
 * (the backing RPC zero-fills empty ones), so a driver can see quiet
 * hours as flat bars, not missing ones. Labels are abbreviated to just
 * the bucket's start hour (e.g. "6A", "2P") to fit 12 columns on a phone
 * screen — the full "6:00 AM–8:00 AM" range lives in hourLabel for
 * anything that needs the unabbreviated form later.
 */
function shortLabel(hourLabel: string): string {
  const startPart = hourLabel.split('–')[0]; // "6:00 AM"
  const [time, period] = startPart.split(' ');
  const hour = time.split(':')[0];
  return `${hour}${period[0]}`;
}

export function PeakHoursBarChart({ data, height = 130 }: PeakHoursBarChartProps) {
  const trackHeight = Math.max(height - LABEL_HEIGHT, 32);
  const max = Math.max(...data.map((bucket) => bucket.count), 1);
  const peakIndex = data.reduce((best, bucket, i) => (bucket.count > data[best].count ? i : best), 0);

  return (
    <View style={styles.container}>
      <View style={[styles.barsRow, { height }]}>
        {data.map((bucket, i) => {
          const barHeightPercent = Math.max((bucket.count / max) * 100, 4);
          const isPeak = i === peakIndex && bucket.count > 0;
          return (
            <View key={bucket.hourLabel} style={styles.barColumn}>
              <View style={[styles.barTrack, { height: trackHeight }]}>
                <View style={[styles.bar, isPeak ? styles.barPeak : styles.barPast, { height: `${barHeightPercent}%` }]} />
              </View>
              <Text style={[styles.barLabel, isPeak && styles.barLabelPeak]} numberOfLines={1}>
                {shortLabel(bucket.hourLabel)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

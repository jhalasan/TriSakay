import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PeakHourBucket } from '../../types/report';
import { AXIS_COLOR, GRID_COLOR, LINE_COLOR, MONO_FONT, TOOLTIP_BG, TOOLTIP_BORDER } from './chartTheme';
import { SkeletonChart } from '../Skeleton';
import styles from './charts.module.css';

export interface PeakHoursChartProps {
  data: PeakHourBucket[];
  loading?: boolean;
}

const AXIS_TICK = { fill: AXIS_COLOR, fontFamily: MONO_FONT, fontSize: 9 };

/**
 * "12:00 AM–2:00 AM" is the right amount of detail for the StatTile ("Peak
 * Hour") and the tooltip, both of which have room for it — but as a
 * rotated axis tick it was long enough that no combination of angle/margin
 * kept the whole label inside the chart's own bounding box (tried -30° with
 * increasingly generous left margins; it just moved the clipping around
 * instead of fixing it). Collapsing "12:00 AM–2:00 AM" to "12–2 AM" is
 * short enough to sit flat, unrotated, so there's nothing left to clip.
 */
function shortAxisLabel(label: string): string {
  const m = label.match(/^(\d+):00 (AM|PM)–(\d+):00 (AM|PM)$/);
  if (!m) return label;
  const [, startHour, startPeriod, endHour, endPeriod] = m;
  if (startPeriod === endPeriod) return `${startHour}–${endHour} ${startPeriod}`;
  return `${startHour}${startPeriod[0]}–${endHour}${endPeriod[0]}`;
}

/** "Peak Hours" report panel — completed rides per 2-hour window across the selected range. */
export function PeakHoursChart({ data, loading = false }: PeakHoursChartProps) {
  if (loading) {
    return <SkeletonChart height={220} />;
  }
  if (data.length === 0) {
    return <div className={`ph-box ${styles.loading}`}>No rides in this range.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="hourLabel" tickFormatter={shortAxisLabel} tick={AXIS_TICK} axisLine={{ stroke: GRID_COLOR }} tickLine={false} interval={1} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: TOOLTIP_BG, border: `1px solid ${TOOLTIP_BORDER}`, borderRadius: 8, fontSize: 12 }}
          formatter={(value) => (typeof value === 'number' ? [`${value} rides`, 'Completed'] : null)}
        />
        <Bar dataKey="count" name="Completed rides" fill={LINE_COLOR} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

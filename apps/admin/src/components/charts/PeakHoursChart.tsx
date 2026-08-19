import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PeakHourBucket } from '../../types/report';
import { AXIS_COLOR, GRID_COLOR, LINE_COLOR, MONO_FONT, TOOLTIP_BG, TOOLTIP_BORDER } from './chartTheme';
import styles from './charts.module.css';

export interface PeakHoursChartProps {
  data: PeakHourBucket[];
  loading?: boolean;
}

const AXIS_TICK = { fill: AXIS_COLOR, fontFamily: MONO_FONT, fontSize: 9 };

/** "Peak Hours" report panel — completed rides per 2-hour window across the selected range. */
export function PeakHoursChart({ data, loading = false }: PeakHoursChartProps) {
  if (loading) {
    return <div className={styles.loading}>Loading…</div>;
  }
  if (data.length === 0) {
    return <div className={styles.loading}>No rides in this range.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="hourLabel" tick={AXIS_TICK} axisLine={{ stroke: GRID_COLOR }} tickLine={false} interval={1} angle={-30} textAnchor="end" height={40} />
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

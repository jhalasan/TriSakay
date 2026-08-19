import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { RidesPerDayPoint } from '../../services/dashboard';
import { AXIS_COLOR, GRID_COLOR, LINE_COLOR, MONO_FONT, TOOLTIP_BG, TOOLTIP_BORDER } from './chartTheme';
import styles from './charts.module.css';

export interface RidesOverTimeChartProps {
  data: RidesPerDayPoint[];
  loading?: boolean;
}

const AXIS_TICK = { fill: AXIS_COLOR, fontFamily: MONO_FONT, fontSize: 10 };

/** "Rides Over Time (Week)" dashboard panel — completed rides per day, oldest to newest. */
export function RidesOverTimeChart({ data, loading = false }: RidesOverTimeChartProps) {
  if (loading) {
    return <div className={styles.loading}>Loading…</div>;
  }
  if (data.length === 0) {
    return <div className={styles.loading}>No rides recorded yet.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="day" tick={AXIS_TICK} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: TOOLTIP_BG, border: `1px solid ${TOOLTIP_BORDER}`, borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: AXIS_COLOR, fontFamily: MONO_FONT, fontSize: 10 }}
          formatter={(value) => (typeof value === 'number' ? [`${value} rides`, 'Completed'] : null)}
        />
        <Line type="monotone" dataKey="count" name="Completed rides" stroke={LINE_COLOR} strokeWidth={2} dot={{ r: 3, fill: LINE_COLOR }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

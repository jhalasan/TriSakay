import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { RidesRevenuePoint } from '../../types/report';
import { formatCurrency } from '../../lib/format';
import { AXIS_COLOR, GRID_COLOR, LINE_COLOR, MONO_FONT, REVENUE_COLOR, TOOLTIP_BG, TOOLTIP_BORDER } from './chartTheme';
import styles from './charts.module.css';

export interface RidesRevenueChartProps {
  data: RidesRevenuePoint[];
  loading?: boolean;
}

const AXIS_TICK = { fill: AXIS_COLOR, fontFamily: MONO_FONT, fontSize: 10 };

/** "Rides / Revenue" report panel — completed rides (bars) and paid revenue (line) per day in the selected range. */
export function RidesRevenueChart({ data, loading = false }: RidesRevenueChartProps) {
  if (loading) {
    return <div className={styles.loading}>Loading…</div>;
  }
  if (data.length === 0) {
    return <div className={styles.loading}>No rides in this range.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="day" tick={AXIS_TICK} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
        <YAxis yAxisId="rides" tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis yAxisId="revenue" orientation="right" tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: TOOLTIP_BG, border: `1px solid ${TOOLTIP_BORDER}`, borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: AXIS_COLOR, fontFamily: MONO_FONT, fontSize: 10 }}
          formatter={(value, name) => (typeof value === 'number' ? (name === 'Revenue' ? [formatCurrency(value), name] : [`${value} rides`, name]) : null)}
        />
        <Bar yAxisId="rides" dataKey="rides" name="Rides" fill={LINE_COLOR} radius={[3, 3, 0, 0]} />
        <Line yAxisId="revenue" type="monotone" dataKey="revenue" name="Revenue" stroke={REVENUE_COLOR} strokeWidth={2} dot={{ r: 3, fill: REVENUE_COLOR }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { TripStatusCount } from '../../services/dashboard';
import { titleCaseLabel } from '../../lib/format';
import { AXIS_COLOR, MONO_FONT, STATUS_COLORS, TOOLTIP_BG, TOOLTIP_BORDER } from './chartTheme';
import styles from './charts.module.css';

export interface RideStatusChartProps {
  data: TripStatusCount[];
  loading?: boolean;
}

const LEGEND_STYLE = { fontFamily: MONO_FONT, fontSize: 11, color: AXIS_COLOR };

/** "Ride Status" dashboard panel — all-time ride counts grouped by TripStatus. */
export function RideStatusChart({ data, loading = false }: RideStatusChartProps) {
  if (loading) {
    return <div className={styles.loading}>Loading…</div>;
  }

  const nonZero = data.filter((d) => d.count > 0);
  if (nonZero.length === 0) {
    return <div className={styles.loading}>No rides recorded yet.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={nonZero}
          dataKey="count"
          nameKey="status"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
          labelLine={false}
          label={(props) => {
            const name = props.name ?? '';
            const percent = props.percent ?? 0;
            return `${titleCaseLabel(name)} ${Math.round(percent * 100)}%`;
          }}
        >
          {nonZero.map((entry) => (
            <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} stroke={TOOLTIP_BG} strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: TOOLTIP_BG, border: `1px solid ${TOOLTIP_BORDER}`, borderRadius: 8, fontSize: 12 }}
          formatter={(value, name) => (typeof value === 'number' ? [`${value} rides`, titleCaseLabel(String(name ?? ''))] : null)}
        />
        <Legend formatter={(value: string) => titleCaseLabel(value)} wrapperStyle={LEGEND_STYLE} iconType="circle" iconSize={8} />
      </PieChart>
    </ResponsiveContainer>
  );
}

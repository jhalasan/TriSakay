import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { RideStatusCount } from '../../services/dashboard';
import { titleCaseLabel } from '../../lib/format';
import { STATUS_COLORS, TOOLTIP_BG, TOOLTIP_BORDER } from './chartTheme';
import { SkeletonDonut } from '../Skeleton';
import styles from './charts.module.css';

export interface RideStatusChartProps {
  data: RideStatusCount[];
  loading?: boolean;
}

const STATUS_ORDER: RideStatusCount['status'][] = ['completed', 'ongoing', 'assigned', 'pending', 'cancelled'];

const STATUS_LABEL: Record<RideStatusCount['status'], string> = {
  completed: 'Completed',
  ongoing: 'Ongoing',
  assigned: 'Assigned',
  pending: 'Waiting for driver',
  cancelled: 'Cancelled',
};

/**
 * "Ride Status" dashboard panel — README §03 wants a 124px donut with the
 * total in the hole and the legend as a right-hand list carrying each
 * status's own count, which Recharts' built-in <Legend/> can't produce (it
 * only pairs a swatch with a name). Same Pie/data binding as before, just a
 * custom legend list and a centered total overlay in place of <Legend/>.
 */
export function RideStatusChart({ data, loading = false }: RideStatusChartProps) {
  if (loading) {
    return <SkeletonDonut />;
  }

  const total = data.reduce((sum, d) => sum + d.count, 0);
  if (total === 0) {
    return <div className={`ph-box ${styles.loading}`}>No rides recorded yet.</div>;
  }

  const byStatus = new Map(data.map((d) => [d.status, d.count]));
  const ordered = STATUS_ORDER.map((status) => ({ status, count: byStatus.get(status) ?? 0 }));
  const nonZero = ordered.filter((d) => d.count > 0);

  return (
    <div className={styles.donutRow}>
      <div className={styles.donutWrap}>
        <ResponsiveContainer width={124} height={124}>
          <PieChart>
            <Pie data={nonZero} dataKey="count" nameKey="status" innerRadius={42} outerRadius={62} paddingAngle={2}>
              {nonZero.map((entry) => (
                <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} stroke={TOOLTIP_BG} strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: TOOLTIP_BG, border: `1px solid ${TOOLTIP_BORDER}`, borderRadius: 8, fontSize: 12 }}
              formatter={(value, name) => (typeof value === 'number' ? [`${value} rides`, STATUS_LABEL[name as RideStatusCount['status']] ?? titleCaseLabel(String(name ?? ''))] : null)}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className={styles.donutCenter}>
          <span className={styles.donutTotal}>{total}</span>
          <span className={styles.donutTotalLabel}>Rides</span>
        </div>
      </div>
      <ul className={styles.donutLegend}>
        {ordered.map((entry) => (
          <li key={entry.status} className={styles.donutLegendRow}>
            <span className={styles.donutDot} style={{ background: STATUS_COLORS[entry.status] }} />
            <span className={styles.donutLegendLabel}>{STATUS_LABEL[entry.status]}</span>
            <span className={styles.donutLegendCount}>{entry.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

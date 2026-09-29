import styles from './Skeleton.module.css';

/**
 * Shared shimmer-loading primitives, replacing the static crossed-`ph-box`
 * ("wireframe kit §Part 0 chart/map/image" — a literal X drawn in CSS,
 * see globals.css) wherever it was standing in for "still loading" rather
 * than its intended meaning of "no chart library/image asset here." A
 * genuinely unbuilt visual still uses `ph-box`/`PlaceholderBox`; anything
 * that's just waiting on a real fetch uses one of these instead, matching
 * the pulse timing DataTable's own row skeletons already established.
 */

export interface SkeletonBarProps {
  width?: number | string;
  height?: number;
}

/** A single shimmering text-line stand-in — for small inline "Loading…" spots. */
export function SkeletonBar({ width = '100%', height = 12 }: SkeletonBarProps) {
  return <span className={styles.bar} style={{ width, height }} aria-hidden="true" />;
}

export interface SkeletonAvatarProps {
  size?: number;
}

/** A shimmering circle — for an Avatar-shaped placeholder in a loading list row. */
export function SkeletonAvatar({ size = 28 }: SkeletonAvatarProps) {
  return <span className={styles.avatar} style={{ width: size, height: size }} aria-hidden="true" />;
}

export interface SkeletonBlockProps {
  height: number;
  width?: number | string;
}

/** A shimmering rectangle — for a single image/map/photo-shaped area. */
export function SkeletonBlock({ height, width = '100%' }: SkeletonBlockProps) {
  return <div className={styles.block} style={{ height, width }} aria-hidden="true" />;
}

export interface SkeletonChartProps {
  height?: number;
}

/** A row of uneven shimmering bars — stands in for any bar/line/composed chart while its data loads. */
export function SkeletonChart({ height = 220 }: SkeletonChartProps) {
  // Fixed, deliberately uneven heights (not random) so the skeleton looks
  // the same on every render instead of visibly reshuffling on re-mount.
  const bars = [0.4, 0.65, 0.5, 0.8, 0.55, 0.7, 0.45, 0.6, 0.35, 0.75];
  return (
    <div className={styles.chart} style={{ height }} aria-hidden="true">
      {bars.map((f, i) => (
        <div key={i} className={styles.chartBar} style={{ height: `${f * 100}%`, animationDelay: `${i * 60}ms` }} />
      ))}
    </div>
  );
}

/** A ring + legend-line stand-in for RideStatusChart's donut while its data loads. */
export function SkeletonDonut() {
  return (
    <div className={styles.donutRow} aria-hidden="true">
      <div className={styles.donutRing} />
      <div className={styles.donutLegend}>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBar key={i} width={`${70 - i * 8}%`} height={14} />
        ))}
      </div>
    </div>
  );
}

export interface SkeletonRowsProps {
  count?: number;
}

/** A few case/list-row-shaped placeholders — for custom accordion/list layouts DataTable's own skeleton doesn't cover (verification queues, ride log's initial load, a sessions list). */
export function SkeletonRows({ count = 3 }: SkeletonRowsProps) {
  return (
    <div className={styles.rows} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.row} style={{ animationDelay: `${i * 90}ms` }}>
          <SkeletonBar width="40%" height={13} />
          <SkeletonBar width="65%" height={11} />
        </div>
      ))}
    </div>
  );
}

export interface SkeletonPageProps {
  blocks?: number;
}

/** A couple of panel-shaped placeholders — for a whole route still loading (a lazy chunk, or a page's initial fetch) before its real layout is known. */
export function SkeletonPage({ blocks = 2 }: SkeletonPageProps) {
  return (
    <div className="page" aria-hidden="true">
      {Array.from({ length: blocks }).map((_, i) => (
        <div key={i} className={styles.pageBlock} style={{ animationDelay: `${i * 90}ms` }}>
          <SkeletonBar width="30%" height={14} />
          <SkeletonBar width="80%" height={11} />
          <SkeletonBar width="60%" height={11} />
        </div>
      ))}
    </div>
  );
}
